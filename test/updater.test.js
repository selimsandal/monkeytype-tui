import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, deflateRawSync } from 'node:zlib';
import { applyWindowsUpdate, archiveName, extractBinary, findUpdate, verifiedBinary } from '../src/updater.js';

const oldVersion = '0.0.100-g123abcd';
const newVersion = '0.0.101-gabcdef0';

function tarFixture(data) {
  const header = Buffer.alloc(512);
  header.write('monkeytype-tui');
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
  header[156] = 48;
  return gzipSync(Buffer.concat([header, data, Buffer.alloc(512 - data.length % 512)]));
}

function zipFixture(data) {
  const name = Buffer.from('monkeytype-tui.exe');
  const compressed = deflateRawSync(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return Buffer.concat([local, name, compressed, central, name, end]);
}

test('selects only a newer release and the current platform archive without authentication', async () => {
  const name = archiveName(newVersion);
  const release = { tag_name: newVersion, assets: [
    { name, browser_download_url: 'https://example.test/archive' },
    { name: 'SHA256SUMS', browser_download_url: 'https://example.test/checksums' },
  ] };
  const request = async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify(release));
  };
  assert.equal(archiveName(newVersion, 'win32', 'arm64'), `monkeytype-tui_${newVersion}_windows_arm64.zip`);
  assert.deepEqual(await findUpdate(oldVersion, 'https://example.test/latest', request),
    { version: newVersion, name, archive: 'https://example.test/archive', checksums: 'https://example.test/checksums' });
  release.tag_name = oldVersion;
  assert.equal(await findUpdate(oldVersion, 'https://example.test/latest', request), null);
  release.tag_name = '0.0.99-gabcdef0';
  assert.equal(await findUpdate(oldVersion, 'https://example.test/latest', request), null);
  release.tag_name = '0.0.100-gabcdef0';
  release.assets[0].name = archiveName(release.tag_name);
  assert.equal((await findUpdate(oldVersion, 'https://example.test/latest', request)).version, release.tag_name);
  assert.equal(await findUpdate('dev', 'https://example.test/latest', request), null);
});

test('extracts exactly the executable from tar.gz and deflated Windows zip', () => {
  assert.equal(extractBinary(tarFixture(Buffer.from('linux executable')), false).toString(), 'linux executable');
  assert.equal(extractBinary(zipFixture(Buffer.from('windows executable')), true).toString(), 'windows executable');
  assert.throws(() => extractBinary(Buffer.from('not a zip'), true));
});

test('checks downloaded archive digest before extracting any executable', async () => {
  const archive = tarFixture(Buffer.from('verified binary'));
  const name = archiveName(newVersion, 'linux', 'x64');
  const hash = createHash('sha256').update(archive).digest('hex');
  const update = { name, checksums: 'https://example.test/checksums', archive: 'https://example.test/archive' };
  let checksum = `${hash}  ./${name}\n`;
  const request = async url => new Response(url === update.checksums ? checksum : archive);
  assert.equal((await verifiedBinary(update, request)).toString(), 'verified binary');
  checksum = `${'0'.repeat(64)}  ./${name}\n`;
  await assert.rejects(verifiedBinary(update, request), /checksum mismatch/);
});

test('Windows helper restores the old executable and records replacement failures', async () => {
  const root = mkdtempSync(join(tmpdir(), 'monkeytype-update-test-'));
  const stage = join(root, 'stage');
  const target = join(root, 'monkeytype-tui.exe');
  mkdirSync(stage);
  writeFileSync(target, 'old executable');
  try {
    await assert.rejects(applyWindowsUpdate(target, join(stage, 'missing.exe'), stage, 'manual'), /ENOENT/);
    assert.equal(readFileSync(target, 'utf8'), 'old executable');
    assert.equal(existsSync(join(stage, 'previous.exe')), false);
    assert.match(readFileSync(join(stage, 'failed'), 'utf8'), /ENOENT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
