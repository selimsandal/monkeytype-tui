import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const timeChoices = [15, 30, 60, 120];
export const wordChoices = [10, 25, 50, 100];
export const settingsRows = [
  { key: 'language', label: 'language', values: ['english', 'spanish', 'french', 'german'], section: 'TEXT' },
  { key: 'punctuation', label: 'punctuation', values: [false, true] },
  { key: 'numbers', label: 'numbers', values: [false, true] },
  { key: 'difficulty', label: 'difficulty', values: ['normal', 'expert', 'master'], section: 'CORRECTIONS' },
  { key: 'stopOnError', label: 'stop on error', shortLabel: 'stop error', values: ['off', 'letter', 'word'] },
  { key: 'deleteOnError', label: 'delete on error', shortLabel: 'delete error', values: ['off', 'letter', 'word', 'letter_hard', 'word_hard'] },
  { key: 'confidence', label: 'confidence', values: ['off', 'on', 'max'] },
  { key: 'strictSpace', label: 'strict space', values: [false, true] },
  { key: 'freedom', label: 'freedom', values: [false, true] },
  { key: 'quickEnd', label: 'quick end', values: [false, true] },
];

export const defaults = {
  mode: 'time', words: 50, time: 30, quoteLength: 'medium', text: null,
  language: 'english', punctuation: false, numbers: false,
  strictSpace: false, stopOnError: 'off', deleteOnError: 'off',
  difficulty: 'normal', confidence: 'off', freedom: false, quickEnd: false,
};

const configPath = join(process.platform === 'win32'
  ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  : process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'monkeytype-tui', 'settings.json');

export function loadSettings() {
  let saved;
  try { saved = JSON.parse(readFileSync(configPath, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return { ...defaults };
    throw error;
  }
  const config = { ...defaults };
  for (const row of settingsRows) {
    if (row.values.includes(saved?.[row.key])) config[row.key] = saved[row.key];
  }
  if (['time', 'words', 'quote'].includes(saved?.mode)) config.mode = saved.mode;
  if (Number.isInteger(saved?.time) && saved.time > 0) config.time = saved.time;
  if (Number.isInteger(saved?.words) && saved.words > 0) config.words = saved.words;
  if (['short', 'medium', 'long', 'thicc'].includes(saved?.quoteLength)) config.quoteLength = saved.quoteLength;
  return config;
}

export function saveSettings(config) {
  mkdirSync(dirname(configPath), { recursive: true });
  const saved = { mode: config.mode === 'custom' ? 'time' : config.mode,
    time: config.time, words: config.words, quoteLength: config.quoteLength };
  for (const row of settingsRows) saved[row.key] = config[row.key];
  writeFileSync(configPath, JSON.stringify(saved, null, 2) + '\n');
}
