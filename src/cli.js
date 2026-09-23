#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { TypingTest } from './engine.js';

const corpus = JSON.parse(readFileSync(new URL('../data/english.json', import.meta.url))).words;
const usage = `Usage: node src/cli.js [--words N | --time SECONDS] [--text "custom words"]
  --strict-space --stop-on-error off|letter|word
  --delete-on-error off|letter|word|letter_hard|word_hard
  --difficulty normal|expert|master --confidence off|on|max
  --freedom --quick-end

Backspace: erase character  Ctrl+Backspace/Ctrl+W: erase word
Tab: restart  Esc/Ctrl+C: quit`;

function args(argv) {
  const config = { words: 25, time: 0, text: null, strictSpace: false,
    stopOnError: 'off', deleteOnError: 'off', difficulty: 'normal',
    confidence: 'off', freedom: false, quickEnd: false };
  const names = { '--words': 'words', '--time': 'time', '--text': 'text',
    '--stop-on-error': 'stopOnError', '--delete-on-error': 'deleteOnError',
    '--difficulty': 'difficulty', '--confidence': 'confidence' };
  const flags = { '--strict-space': 'strictSpace', '--freedom': 'freedom', '--quick-end': 'quickEnd' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { console.log(usage); process.exit(0); }
    if (flags[arg]) config[flags[arg]] = true;
    else if (names[arg] && argv[i + 1]) config[names[arg]] = argv[++i];
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  config.words = Number(config.words);
  config.time = Number(config.time);
  if (!Number.isInteger(config.words) || config.words < 1 ||
      !Number.isInteger(config.time) || config.time < 0 ||
      !['off', 'letter', 'word'].includes(config.stopOnError) ||
      !['off', 'letter', 'word', 'letter_hard', 'word_hard'].includes(config.deleteOnError) ||
      !['normal', 'expert', 'master'].includes(config.difficulty) ||
      !['off', 'on', 'max'].includes(config.confidence)) throw new Error('Invalid option value');
  return config;
}

function randomWord(previous) {
  const choices = corpus.filter(word => !previous.slice(-2).includes(word));
  return choices[Math.floor(Math.random() * choices.length)];
}

const gray = '\x1b[90m', red = '\x1b[31m', green = '\x1b[32m',
  yellow = '\x1b[33m', reset = '\x1b[0m', caret = '\x1b[7m';

function paintedWord(test, index) {
  const target = test.words[index];
  const input = index === test.index ? test.input : test.history[index];
  const active = index === test.index && test.ended === null;
  let result = '';
  for (let i = 0; i < Math.max(target.length, input.length + (active ? 1 : 0)); i++) {
    const ch = input[i] ?? target[i] ?? ' ';
    const color = input[i] === undefined ? (index < test.index ? red : gray) :
      i >= target.length ? yellow : ch === target[i] ? green : red;
    result += `${color}${active && i === input.length ? caret : ''}${ch}${reset}`;
  }
  return result;
}

function render(test) {
  const width = Math.max(20, process.stdout.columns || 80);
  const height = Math.max(8, process.stdout.rows || 24);
  const lines = [];
  let line = [], length = 0;
  let activeLine = 0;
  for (let i = 0; i < test.words.length; i++) {
    const size = Math.max(test.words[i].length, i === test.index ? test.input.length + 1 : 0);
    if (length && length + size + 1 > width - 2) {
      lines.push(line.join(' ')); line = []; length = 0;
    }
    if (i === test.index) activeLine = lines.length;
    line.push(paintedWord(test, i));
    length += size + (length ? 1 : 0);
    if (lines.length > activeLine + height) break;
  }
  if (line.length) lines.push(line.join(' '));
  const start = Math.max(0, activeLine - 1);
  const shown = lines.slice(start, start + Math.max(3, height - 7));
  const remaining = test.options.time && test.started !== null
    ? Math.max(0, Math.ceil(test.options.time - (Date.now() - test.started) / 1000))
    : null;
  const stat = test.stats();
  const title = ` monkeytype-tui  ${test.options.time ? `${remaining ?? test.options.time}s` : `${test.index + 1}/${test.words.length} words`} `;
  const footer = test.ended !== null
    ? `${test.failed ? 'FAILED' : 'FINISHED'}  ${stat.wpm} wpm  ${stat.accuracy}% accuracy  Tab restart / Esc quit`
    : `${stat.wpm} wpm  ${stat.accuracy}% accuracy  Tab restart / Esc quit`;
  process.stdout.write(`\x1b[H\x1b[J${title}\n\n${shown.join('\n')}\n\n${footer}${reset}`);
}

function main() {
  const config = args(process.argv.slice(2));
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this in an interactive terminal');
  const custom = config.text?.trim().split(/\s+/);
  if (config.text !== null && !config.text?.trim()) throw new Error('Custom text must contain words');
  const make = () => {
    const words = custom ? [...custom] : [];
    if (!custom) for (let i = 0; i < (config.time ? 100 : config.words); i++) words.push(randomWord(words));
    return new TypingTest(words, { ...config, nextWord: config.time ? randomWord : null });
  };
  let test = make();
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write('\x1b[?25l');
  const timer = setInterval(() => { test.tick(); render(test); }, 100);
  function exit() {
    clearInterval(timer);
    process.stdin.setRawMode(false);
    process.stdout.write('\x1b[?25h\x1b[0m\n');
    process.exit(0);
  }
  process.on('SIGTERM', exit);
  process.stdout.on('resize', () => render(test));
  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return exit();
    if (key.name === 'tab') test = make();
    else if (key.name === 'backspace' || (key.ctrl && (key.name === 'w' || key.name === 'backspace'))) {
      test.backspace(!!key.ctrl);
    } else if (!key.ctrl && !key.meta && /^[^\x00-\x1f\x7f]+$/u.test(str)) {
      for (const ch of str) test.insert(ch);
    }
    render(test);
  });
  render(test);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
