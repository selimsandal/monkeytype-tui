#!/usr/bin/env node
import readline from 'node:readline';
import english from '../data/english.json' with { type: 'json' };
import englishQuotes from '../data/quotes-english.json' with { type: 'json' };
import { TypingTest } from './engine.js';
import { applyWindowsUpdate, cleanupWindowsUpdate, findUpdate, installUpdate } from './updater.js';

const corpus = english.words;
const quotes = englishQuotes.quotes;
const version = typeof BUILD_VERSION === 'string' ? BUILD_VERSION : 'dev';
const timeChoices = [15, 30, 60, 120];
const wordChoices = [10, 25, 50, 100];
const quoteChoices = ['short', 'medium', 'long', 'thicc'];
const quoteRanges = [[0, 100], [101, 300], [301, 600], [601, Infinity]];
const usage = `Usage: monkeytype-tui [--mode time|words|quote|custom] [--words N | --time SECONDS] [--text "custom words"]
  monkeytype-tui update  check for and install the latest native release
  --quote-length short|medium|long|thicc
  --version  print the embedded release version
  --strict-space --stop-on-error off|letter|word
  --delete-on-error off|letter|word|letter_hard|word_hard
  --difficulty normal|expert|master --confidence off|on|max
  --freedom --quick-end

Backspace: erase character  Ctrl+Backspace/Ctrl+W: erase word
F1/F2/F3/F4: time/words/quote/custom  F5/F6: change length
Tab: restart  Esc/Ctrl+C: quit`;

function args(argv) {
  const config = { mode: 'time', words: 50, time: 30, quoteLength: 'medium', text: null, strictSpace: false,
    stopOnError: 'off', deleteOnError: 'off', difficulty: 'normal',
    confidence: 'off', freedom: false, quickEnd: false };
  const names = { '--words': 'words', '--time': 'time', '--text': 'text',
    '--mode': 'mode', '--quote-length': 'quoteLength',
    '--stop-on-error': 'stopOnError', '--delete-on-error': 'deleteOnError',
    '--difficulty': 'difficulty', '--confidence': 'confidence' };
  const flags = { '--strict-space': 'strictSpace', '--freedom': 'freedom', '--quick-end': 'quickEnd' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { console.log(usage); process.exit(0); }
    if (arg === '--version') { console.log(version); process.exit(0); }
    if (flags[arg]) config[flags[arg]] = true;
    else if (names[arg] && argv[i + 1]) {
      config[names[arg]] = argv[++i];
      if (arg === '--words') config.mode = 'words';
      if (arg === '--time') config.mode = 'time';
      if (arg === '--text') config.mode = 'custom';
    }
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  config.words = Number(config.words);
  config.time = Number(config.time);
  if (!Number.isInteger(config.words) || config.words < 1 ||
      !Number.isInteger(config.time) || config.time < 0 ||
      !['off', 'letter', 'word'].includes(config.stopOnError) ||
      !['off', 'letter', 'word', 'letter_hard', 'word_hard'].includes(config.deleteOnError) ||
      !['normal', 'expert', 'master'].includes(config.difficulty) ||
      !['off', 'on', 'max'].includes(config.confidence) ||
      !['time', 'words', 'quote', 'custom'].includes(config.mode) ||
      !quoteChoices.includes(config.quoteLength) ||
      (config.mode === 'time' && config.time === 0) ||
      (config.mode === 'custom' && !config.text?.trim())) throw new Error('Invalid option value');
  return config;
}

function randomWord(previous) {
  const choices = corpus.filter(word => !previous.slice(-2).includes(word));
  return choices[Math.floor(Math.random() * choices.length)];
}

function randomQuote(length) {
  const [min, max] = quoteRanges[quoteChoices.indexOf(length)];
  const options = quotes.filter(q => q.length >= min && q.length <= max && !/[\r\n]/.test(q.text));
  return options[Math.floor(Math.random() * options.length)];
}

const background = '\x1b[48;2;50;52;55m';
const muted = '\x1b[38;2;100;102;105m';
const text = '\x1b[38;2;209;208;197m';
const accent = '\x1b[38;2;226;183;20m';
const error = '\x1b[38;2;202;71;84m';
const extra = '\x1b[38;2;126;42;51m';
const reset = '\x1b[0m';
const move = (row, col) => `\x1b[${row};${col}H`;

function paintedWord(test, index) {
  const target = test.words[index];
  const active = index === test.index && test.ended === null;
  const input = active ? test.input :
    (index === test.index ? test.input : test.history[index]).replace(/ $/, '');
  const visible = active ? input : input.slice(0, target.length);
  let result = !active && input.length > target.length ? '\x1b[4m' : '';
  for (let i = 0; i < Math.max(target.length, visible.length) + (active ? 1 : 0); i++) {
    const ch = visible[i] ?? target[i] ?? ' ';
    const color = visible[i] === undefined ? (index < test.index ? error : muted) :
      i >= target.length ? extra : ch === target[i] ? text : error;
    result += `${background}${color}${ch}`;
  }
  return result + `\x1b[24m${muted}${' '.repeat(active ? 1 : 2)}`;
}

function graph(samples, width, height) {
  const points = samples.slice(-width);
  const peak = Math.max(10, ...points.flatMap(point => [point.wpm, point.raw]));
  const cells = Array.from({ length: height }, () => Array(width).fill(' '));
  const errorMarks = Array(width).fill(' ');
  for (const [field, marker] of [['raw', '·'], ['wpm', '●']]) {
    let previous = null;
    for (let x = 0; x < points.length; x++) {
      const y = height - 1 - Math.round(points[x][field] / peak * (height - 1));
      const column = points.length === 1 ? width - 1 : Math.round(x * (width - 1) / (points.length - 1));
      cells[y][column] = marker;
      if (points[x].errors) errorMarks[column] = '×';
      if (previous && column - previous.x > 1) {
        for (let step = previous.x + 1; step < column; step++) {
          const middle = Math.round(previous.y + (y - previous.y) * (step - previous.x) / (column - previous.x));
          cells[middle][step] = marker === '●' ? '─' : '·';
        }
      }
      previous = { x: column, y };
    }
  }
  return { peak, rows: cells.map(row => row.map(cell =>
    cell === '●' || cell === '─' ? accent + cell : cell === '·' ? text + cell : ' ').join('')),
  errors: `${error}${errorMarks.join('')}` };
}

function render(test, config, quoteSource, samples) {
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;
  const contentWidth = Math.max(20, Math.min(90, width - 6));
  const left = Math.max(1, Math.floor((width - contentWidth) / 2) + 1);
  const lines = [];
  let line = [], length = 0;
  let activeLine = 0;
  let cursorColumn = left;
  for (let i = 0; i < test.words.length; i++) {
    const size = Math.max(test.words[i].length,
      i === test.index && test.ended === null ? test.input.length : 0) + 2;
    if (length && length + size > contentWidth) {
      lines.push(line.join('')); line = []; length = 0;
    }
    if (i === test.index) {
      activeLine = lines.length;
      cursorColumn = left + length + test.input.length;
    }
    line.push(paintedWord(test, i));
    length += size;
  }
  if (line.length) lines.push(line.join(''));
  const start = Math.max(0, activeLine - 1);
  const shown = lines.slice(start, start + 3);
  const remaining = test.options.time && test.started !== null
    ? Math.max(0, Math.ceil(test.options.time - (Date.now() - test.started) / 1000))
    : null;
  const stat = test.stats();
  const center = (s) => Math.max(1, Math.floor((width - s.length) / 2) + 1);
  const modes = ['time', 'words', 'quote', ...(config.text ? ['custom'] : [])];
  const selection = config.mode === 'time' ? timeChoices.map(String) :
    config.mode === 'words' ? wordChoices.map(String) :
      config.mode === 'quote' ? quoteChoices : [];
  const chosen = String(config.mode === 'time' ? config.time :
    config.mode === 'words' ? config.words : config.quoteLength);
  const rows = new Map();
  const at = (row, col, value) => {
    if (row > 0 && row <= height) rows.set(row, (rows.get(row) ?? '') + `${move(row, col)}${value}`);
  };
  at(2, left, `${accent}monkeytype${muted}  tui`);
  if (width >= 50) at(2, width - 17, `${muted}english`);
  if (test.ended === null) {
    const menu = modes.map((mode, i) => `${config.mode === mode ? accent : muted}${width < 60 ? '' : `${i + 1} `}${mode}`)
      .join(width < 60 ? `${muted}  ` : `${muted}  /  `);
    at(5, center(menu.replace(/\x1b\[[0-9;]*m/g, '')), menu);
    if (selection.length) {
      const choices = selection.map(v => `${v === chosen ? accent : muted}${v}`).join(`${muted}   `);
      at(7, center(choices.replace(/\x1b\[[0-9;]*m/g, '')), choices);
    }
  }
  const top = Math.max(10, Math.floor(height / 2) - 2);
  if (test.ended !== null) {
    const chartTop = Math.max(10, top + 1);
    const chartHeight = Math.min(9, Math.max(0, height - chartTop - 6));
    at(top - 3, left, `${test.failed ? error + 'test failed' : accent + 'test complete'}`);
    at(top - 1, left, `${accent}${stat.wpm} ${muted}wpm       ${accent}${stat.accuracy}% ${muted}accuracy`);
    if (chartHeight) {
      const chartWidth = Math.max(1, contentWidth - 5);
      const chart = graph(samples, chartWidth, chartHeight);
      chart.rows.forEach((row, i) => at(chartTop + i, left, `${muted}${i ? '  │ ' : String(chart.peak).padStart(3)}${row}`));
      at(chartTop + chartHeight, left, `${muted}  └${'─'.repeat(chartWidth + 1)}`);
      at(chartTop + chartHeight + 1, left, `${muted}    ${chart.errors}`);
      at(chartTop + chartHeight + 2, left, `${accent}● wpm  ${text}· raw  ${error}× errors`);
    }
    const totals = `correct ${stat.correctWord}   incorrect ${stat.incorrect}   extra ${stat.extra}   missed ${stat.missed}`;
    if (totals.length > contentWidth) {
      at(height - 3, left, `${muted}correct ${stat.correctWord}   incorrect ${stat.incorrect}`);
      at(height - 2, left, `${muted}extra ${stat.extra}   missed ${stat.missed}`);
    } else at(height - 2, left, `${muted}${totals}`);
  } else {
    const label = test.options.time ? `${remaining ?? test.options.time}` :
      `${test.index + 1} / ${test.words.length}`;
    at(top - 2, left, `${accent}${label}`);
    shown.forEach((value, i) => at(top + i * 2, left, value));
    if (config.mode === 'quote' && quoteSource) at(top + 7, left, `${muted}— ${quoteSource.slice(0, contentWidth - 2)}`);
    const hint = width < 60 ? 'tab restart   f1-f4 mode   esc quit' :
      'tab restart   f1-f4 mode   f5/f6 length   esc quit';
    at(height - 2, center(hint), `${muted}${hint}`);
  }
  return { rows, width, height, cursor: test.ended === null ?
    { row: top + (activeLine - start) * 2, col: Math.min(width, cursorColumn) } : null };
}

function main(argv) {
  const config = args(argv);
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this in an interactive terminal');
  const custom = config.text?.trim().split(/\s+/);
  let quoteSource = '';
  const make = () => {
    const quote = config.mode === 'quote' ? randomQuote(config.quoteLength) : null;
    quoteSource = quote?.source ?? '';
    const words = config.mode === 'custom' ? [...custom] : quote ? quote.text.replace(/…/g, '...').trim().split(/\s+/) : [];
    if (!words.length) for (let i = 0; i < (config.mode === 'time' ? 100 : config.words); i++) words.push(randomWord(words));
    return new TypingTest(words, { ...config, time: config.mode === 'time' ? config.time : 0,
      nextWord: config.mode === 'time' ? randomWord : null });
  };
  let test = make();
  let samples = [];
  let lastErrors = 0;
  let finished = false;
  const restart = () => { test = make(); samples = []; lastErrors = 0; finished = false; };
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write('\x1b[?1049h\x1b[6 q');
  let previous = new Map();
  let dimensions = '';
  let cursorState = '';
  const redraw = () => {
    if (test.started !== null && !finished) {
      const elapsed = Math.max(0, (Math.min(Date.now(), test.ended ?? Infinity) - test.started) / 1000);
      const seconds = Math.floor(elapsed);
      const record = duration => {
        const stats = test.stats();
        samples.push({ wpm: Math.round(stats.correctWord * 12 / duration),
          raw: Math.round(test.keystrokes * 12 / duration), errors: test.errors - lastErrors });
        lastErrors = test.errors;
      };
      while (samples.length < seconds) record(samples.length + 1);
      if (test.ended !== null) {
        if (elapsed > seconds || !samples.length) record(Math.max(elapsed, 0.001));
        finished = true;
      }
    }
    const { rows, width, height, cursor } = render(test, config, quoteSource, samples);
    const size = `${width}x${height}`;
    let output = '';
    if (size !== dimensions) {
      output += `${background}\x1b[2J`;
      dimensions = size;
      previous = new Map();
    }
    for (const row of new Set([...previous.keys(), ...rows.keys()])) {
      const value = rows.get(row) ?? '';
      if (value !== (previous.get(row) ?? '')) {
        output += `${move(row, 1)}${background}${' '.repeat(width)}${value}`;
      }
    }
    const placement = cursor ? `${move(cursor.row, cursor.col)}\x1b[?25h` : '\x1b[?25l';
    if (output || placement !== cursorState) process.stdout.write(output + reset + placement);
    cursorState = placement;
    previous = rows;
  };
  const timer = setInterval(() => { test.tick(); redraw(); }, 100);
  function exit() {
    clearInterval(timer);
    process.stdin.setRawMode(false);
    process.stdout.write('\x1b[?25h\x1b[0 q\x1b[?1049l\x1b[0m');
    process.exit(0);
  }
  process.on('SIGTERM', exit);
  process.stdout.on('resize', redraw);
  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return exit();
    if (key.name === 'tab') restart();
    else if (/^f[1-4]$/.test(key.name)) {
      const mode = ['time', 'words', 'quote', 'custom'][Number(key.name[1]) - 1];
      if (mode !== 'custom' || custom) { config.mode = mode; restart(); }
    } else if (key.name === 'f5' || key.name === 'f6') {
      const choices = config.mode === 'time' ? timeChoices :
        config.mode === 'words' ? wordChoices : config.mode === 'quote' ? quoteChoices : null;
      if (choices) {
        const field = config.mode === 'quote' ? 'quoteLength' : config.mode;
        const index = choices.indexOf(config[field]);
        config[field] = choices[(index + (key.name === 'f6' ? 1 : choices.length - 1)) % choices.length];
        restart();
      }
    }
    else if (key.name === 'backspace' || (key.ctrl && (key.name === 'w' || key.name === 'backspace'))) {
      test.backspace(!!key.ctrl);
    } else if (!key.ctrl && !key.meta && /^[^\x00-\x1f\x7f]+$/u.test(str)) {
      for (const ch of str) test.insert(ch);
    }
    redraw();
  });
  redraw();
}

async function start() {
  let argv = process.argv.slice(2);
  if (argv[0] === '--apply-update') {
    await applyWindowsUpdate(argv[1], argv[2], argv[3], argv[4], argv.slice(5));
    return;
  }
  if (argv[0] === '--cleanup-update') {
    await cleanupWindowsUpdate(argv[1]);
    if (argv[2] === 'manual') { console.log(`Updated to ${version}`); return; }
    argv = argv.slice(3);
    main(argv);
    return;
  }
  if (argv[0] === 'update') {
    if (version === 'dev') throw new Error('Update is available only in a standalone release');
    const update = await findUpdate(version);
    if (!update) { console.log(`Already up to date (${version})`); return; }
    console.log(`Downloading ${update.version}...`);
    const status = await installUpdate(update, [], false);
    if (status === 'installed') console.log(`Updated to ${update.version}`);
    return;
  }
  if (version !== 'dev' && !['--help', '--version'].includes(argv[0]) &&
      process.stdin.isTTY && process.stdout.isTTY) {
    try {
      const update = await findUpdate(version);
      if (update) {
        console.log(`Updating to ${update.version}...`);
        await installUpdate(update, argv, true);
        return;
      }
    } catch (error) {
      // Network failures must not prevent an offline typing test.
      console.error(`Update skipped: ${error.message}`);
    }
  }
  main(argv);
}

start().catch(error => { console.error(error.message); process.exitCode = 1; });
