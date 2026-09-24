import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFileSync, chmodSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { gunzipSync, inflateRawSync } from 'node:zlib';

const releaseUrl = 'https://api.github.com/repos/selimsandal/monkeytype-tui/releases/latest';
const versionPattern = /^0\.0\.(\d+)-g[0-9a-f]{7}$/;

export function archiveName(version, platform = process.platform, arch = process.arch) {
  const os = platform === 'win32' ? 'windows' : platform;
  if (!['windows', 'linux', 'darwin'].includes(os) || !['x64', 'arm64'].includes(arch)) {
    throw new Error(`No native release for ${platform}/${arch}`);
  }
  return `monkeytype-tui_${version}_${os}_${arch}.${os === 'windows' ? 'zip' : 'tar.gz'}`;
}

export async function findUpdate(current, url = releaseUrl, request = fetch) {
  if (!versionPattern.test(current)) return null;
  const response = await request(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'monkeytype-tui' },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Release check failed (HTTP ${response.status})`);
  const release = await response.json();
  const match = versionPattern.exec(release.tag_name ?? '');
  if (!match) throw new Error('Latest release has an unrecognized version');
  const installed = Number(versionPattern.exec(current)[1]);
  if (release.tag_name === current || Number(match[1]) < installed) return null;
  const name = archiveName(release.tag_name);
  const archive = release.assets?.find(asset => asset.name === name)?.browser_download_url;
  const checksums = release.assets?.find(asset => asset.name === 'SHA256SUMS')?.browser_download_url;
  if (!archive || !checksums) throw new Error(`Release ${release.tag_name} is missing update assets`);
  return { version: release.tag_name, name, archive, checksums };
}

async function download(url, request, timeout) {
  const response = await request(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export async function verifiedBinary(update, request = fetch) {
  const checksums = (await download(update.checksums, request, 10000)).toString('utf8');
  const line = checksums.split('\n').find(row => row.endsWith(`  ./${update.name}`));
  const expected = line?.slice(0, 64);
  if (!/^[0-9a-f]{64}$/.test(expected) || line !== `${expected}  ./${update.name}`) {
    throw new Error('Release checksum is missing or invalid');
  }
  const archive = await download(update.archive, request, 120000);
  if (createHash('sha256').update(archive).digest('hex') !== expected) {
    throw new Error('Release checksum mismatch; update was not installed');
  }
  return extractBinary(archive, update.name.endsWith('.zip'));
}

export function extractBinary(archive, windows) {
  const binary = windows ? 'monkeytype-tui.exe' : 'monkeytype-tui';
  if (!windows) {
    const tar = gunzipSync(archive);
    for (let offset = 0; offset + 512 <= tar.length;) {
      const header = tar.subarray(offset, offset + 512);
      const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
      const size = Number.parseInt(header.toString('ascii', 124, 136).replace(/\0.*$/, '').trim(), 8);
      if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) break;
      if (name === binary && (header[156] === 0 || header[156] === 48)) {
        return Buffer.from(tar.subarray(offset + 512, offset + 512 + size));
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
  } else {
    let end = -1;
    for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--) {
      if (archive.readUInt32LE(i) === 0x06054b50) { end = i; break; }
    }
    if (end >= 0) {
      let offset = archive.readUInt32LE(end + 16);
      for (let i = 0; i < archive.readUInt16LE(end + 10); i++) {
        if (archive.readUInt32LE(offset) !== 0x02014b50) break;
        const method = archive.readUInt16LE(offset + 10);
        const length = archive.readUInt32LE(offset + 20);
        const size = archive.readUInt32LE(offset + 24);
        const nameLength = archive.readUInt16LE(offset + 28);
        const extraLength = archive.readUInt16LE(offset + 30);
        const commentLength = archive.readUInt16LE(offset + 32);
        const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength);
        if (name === binary) {
          const local = archive.readUInt32LE(offset + 42);
          if (archive.readUInt32LE(local) !== 0x04034b50) break;
          const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
          const compressed = archive.subarray(start, start + length);
          const content = method === 8 ? inflateRawSync(compressed) : method === 0 ? compressed : null;
          if (content?.length === size) return Buffer.from(content);
          break;
        }
        offset += 46 + nameLength + extraLength + commentLength;
      }
    }
  }
  throw new Error(`Release archive does not contain ${binary}`);
}

function spawnAndWait(command, args, waitForExit = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    if (waitForExit) child.once('exit', resolve);
    else child.once('spawn', () => { child.unref(); resolve(); });
  });
}

export async function installUpdate(update, args, restart, request = fetch) {
  const binary = await verifiedBinary(update, request);
  const target = realpathSync(process.execPath);
  const stage = mkdtempSync(join(dirname(target), '.monkeytype-tui-update-'));
  const next = join(stage, basename(target));
  try {
    writeFileSync(next, binary, { mode: 0o755 });
    chmodSync(next, 0o755);
    if (process.platform === 'win32') {
      const helper = join(stage, 'helper.exe');
      copyFileSync(target, helper);
      await spawnAndWait(helper, ['--apply-update', target, next, stage, restart ? 'restart' : 'manual', ...args]);
      return 'scheduled';
    }
    renameSync(next, target);
    if (restart) await spawnAndWait(target, args, true);
    return 'installed';
  } finally {
    if (process.platform !== 'win32') rmSync(stage, { recursive: true, force: true });
  }
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function applyWindowsUpdate(target, next, stage, mode, args) {
  const backup = join(stage, 'previous.exe');
  for (let attempt = 0; attempt < 100; attempt++) {
    try { renameSync(target, backup); break; }
    catch (error) {
      if (!['EACCES', 'EPERM', 'EBUSY'].includes(error.code) || attempt === 99) throw error;
      await pause(100);
    }
  }
  try { renameSync(next, target); }
  catch (error) { renameSync(backup, target); throw error; }
  await spawnAndWait(target, ['--cleanup-update', stage, mode, ...args]);
}

export async function cleanupWindowsUpdate(stage) {
  if (dirname(stage) !== dirname(realpathSync(process.execPath)) ||
      !basename(stage).startsWith('.monkeytype-tui-update-')) return;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { rmSync(stage, { recursive: true, force: true }); return; }
    catch (error) {
      if (!['EACCES', 'EPERM', 'EBUSY'].includes(error.code)) throw error;
      await pause(100);
    }
  }
}
