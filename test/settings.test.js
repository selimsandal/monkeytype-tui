import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('settings persist language, correction modes and presets while rejecting invalid saved values', async () => {
  const root = mkdtempSync(join(tmpdir(), 'monkeytype-settings-test-'));
  const original = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = root;
  try {
    const { loadSettings, saveSettings } = await import('../src/settings.js?settings-test');
    const config = loadSettings();
    assert.equal(config.language, 'english');
    saveSettings({ ...config, mode: 'words', words: 25, language: 'french', punctuation: true,
      stopOnError: 'word' });
    assert.deepEqual([loadSettings().mode, loadSettings().words, loadSettings().language,
      loadSettings().punctuation, loadSettings().stopOnError], ['words', 25, 'french', true, 'word']);
    const file = join(root, 'monkeytype-tui', 'settings.json');
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...saved, language: 'unknown', time: -1 }));
    assert.equal(loadSettings().language, 'english');
    assert.equal(loadSettings().time, 30);
  } finally {
    if (original === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = original;
    rmSync(root, { recursive: true, force: true });
  }
});
