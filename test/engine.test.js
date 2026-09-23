import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TypingTest, countChars } from '../src/engine.js';

const type = (t, text, now = 1000) => { for (const char of text) t.insert(char, now++); };

test('space cannot skip empty word, but commits incomplete and incorrect words', () => {
  const t = new TypingTest(['cat', 'dog', 'end']);
  assert.equal(t.insert(' '), false);
  type(t, 'ca ');
  assert.equal(t.index, 1);
  assert.equal(t.history[0], 'ca ');
  type(t, 'dxg ');
  assert.equal(t.index, 2);
  assert.equal(t.ended, null);
  type(t, 'end');
  assert.notEqual(t.ended, null);
});

test('backspace crosses only incorrect words, whole-word deletion clears destination', () => {
  const t = new TypingTest(['cat', 'dog', 'end']);
  type(t, 'ca d');
  t.backspace();
  assert.equal(t.input, '');
  t.backspace();
  assert.equal(t.index, 0);
  assert.equal(t.input, 'ca');
  type(t, 't ');
  assert.equal(t.backspace(), false);
  assert.equal(t.input, '');
  const freedom = new TypingTest(['cat', 'dog'], { freedom: true });
  type(freedom, 'cat ');
  assert.equal(freedom.backspace(true), true);
  assert.equal(freedom.input, '');
});

test('strict space counts a leading space without advancing; letter stop rejects mistakes', () => {
  const t = new TypingTest(['cat', 'dog'], { strictSpace: true, stopOnError: 'letter' });
  t.insert(' ');
  assert.equal(t.index, 0);
  assert.equal(t.input, '');
  type(t, 'cx');
  assert.equal(t.input, 'c');
  assert.equal(t.errors, 2);
});

test('word stop blocks erroneous commits; delete-on-error removes preceding progress', () => {
  const t = new TypingTest(['cat', 'dog'], { stopOnError: 'word' });
  type(t, 'cx ');
  assert.equal(t.index, 0);
  assert.equal(t.input, 'cx ');
  t.backspace(); t.backspace(); type(t, 'at ');
  assert.equal(t.index, 1);
  const d = new TypingTest(['cat', 'dog'], { deleteOnError: 'letter' });
  type(d, 'cx');
  assert.equal(d.input, '');
  assert.equal(d.errors, 1);
});

test('expert fails on bad word commit, master fails on wrong letter', () => {
  const e = new TypingTest(['cat', 'dog'], { difficulty: 'expert' });
  type(e, 'ca ');
  assert.equal(e.failed, true);
  const m = new TypingTest(['cat'], { difficulty: 'master' });
  type(m, 'x');
  assert.equal(m.failed, true);
});

test('final word ends on exact match or committed wrong word, not earlier word', () => {
  const t = new TypingTest(['a', 'bc']);
  type(t, 'a ');
  assert.equal(t.ended, null);
  type(t, 'bx ');
  assert.notEqual(t.ended, null);
  const u = new TypingTest(['a', 'bc']);
  type(u, 'a bc');
  assert.notEqual(u.ended, null);
});

test('time begins on accepted input, extends generated words, credits correct partial prefix', () => {
  const t = new TypingTest(['cat'], { time: 2, nextWord: () => 'long' });
  assert.equal(t.insert(' ', 100), false);
  type(t, 'cat ', 500);
  assert.equal(t.words.length, 2);
  type(t, 'lo', 600);
  t.tick(2499);
  assert.equal(t.ended, null);
  t.tick(2500);
  assert.equal(t.ended, 2500);
  assert.equal(countChars('lo', 'long ', true).correctWord, 2);
  assert.equal(countChars('lx', 'long ', true).correctWord, 0);
});

test('counts distinguish missing, incorrect, extra, and bad-word separator', () => {
  assert.deepEqual(countChars('cx ', 'cat ', false),
    { allCorrect: 1, correctWord: 0, incorrect: 2, extra: 0, missed: 1 });
  assert.equal(countChars('catx', 'cat ', false).extra, 1);
});

// Source-derived traces: Monkeytype input/handlers/{before-insert-text,insert-text,
// before-delete,delete}.ts and input/helpers/{validation,word-navigation}.ts.
// Each fixture checks the state after a competing interpretation would diverge.
test('correction-mode traces match upstream navigation and deletion rules', () => {
  const cases = [
    {
      name: 'strict space at empty input is an error, not a skip',
      options: { strictSpace: true }, actions: [' '],
      expected: [0, ' ', 1, false],
    },
    {
      name: 'word stop holds an incorrect separator in the same word',
      options: { stopOnError: 'word' }, actions: ['c', 'x', ' '],
      expected: [0, 'cx ', 2, false],
    },
    {
      name: 'hard delete at first character returns to previous word',
      options: { deleteOnError: 'letter_hard' }, actions: ['c', 'a', 't', ' ', 'x'],
      expected: [0, 'cat', 1, false],
    },
    {
      name: 'confidence on forbids returning to a skipped word',
      options: { confidence: 'on' }, actions: ['c', 'a', ' ', 'backspace'],
      expected: [1, '', 1, false],
    },
    {
      name: 'freedom bypasses correct-word and max-confidence locks',
      options: { confidence: 'max', freedom: true }, actions: ['c', 'a', 't', ' ', 'backspace'],
      expected: [0, 'cat', 0, false],
    },
  ];
  for (const { name, options, actions, expected } of cases) {
    const t = new TypingTest(['cat', 'dog'], options);
    for (const action of actions) action === 'backspace' ? t.backspace() : t.insert(action, 1000);
    assert.deepEqual([t.index, t.input, t.errors, t.failed], expected, name);
  }
});

test('Unicode spaces commit, typographic variants normalize to target before validation', () => {
  const t = new TypingTest(["don't", '“yes”', 'go—now', 'end']);
  type(t, "don't");
  t.insert('　');
  assert.equal(t.index, 1);
  assert.equal(t.history[0], "don't ");
  type(t, '"yes" ');
  assert.equal(t.history[1], '“yes” ');
  type(t, 'go-now ');
  assert.equal(t.history[2], 'go—now ');
  assert.equal(t.errors, 0);
  const q = new TypingTest(['don’t', 'end']);
  type(q, "don't ");
  assert.equal(q.history[0], 'don’t ');
});

test('ellipsis expands into three input events when the target expects periods', () => {
  const t = new TypingTest(['wait...']);
  type(t, 'wait');
  t.insert('…', 1004);
  assert.equal(t.input, 'wait...');
  assert.equal(t.keystrokes, 7);
  assert.equal(t.ended, 1004);
});

test('quick end, input cap and timed partial statistics follow source boundaries', () => {
  const quick = new TypingTest(['cat'], { quickEnd: true });
  type(quick, 'cax');
  assert.notEqual(quick.ended, null);
  const stopped = new TypingTest(['cat'], { quickEnd: true, stopOnError: 'word' });
  type(stopped, 'cax');
  assert.equal(stopped.ended, null);
  const capped = new TypingTest(['a', 'end']);
  type(capped, 'x'.repeat(22));
  assert.equal(capped.input.length, 22);
  assert.equal(capped.insert('x'), false);
  assert.equal(capped.insert(' '), true);
  assert.equal(capped.index, 1);
  const timed = new TypingTest(['cat', 'long'], { time: 2 });
  type(timed, 'cat ', 1000);
  type(timed, 'lo', 1200);
  timed.tick(3000);
  assert.equal(timed.stats(3000).correctWord, 6);
  assert.equal(timed.stats(3000).missed, 0);
});

test('expert ignores a leading separator while master fails on its incorrect keystroke', () => {
  const expert = new TypingTest(['cat', 'dog'], { difficulty: 'expert' });
  expert.insert(' ');
  assert.equal(expert.input, ' ');
  assert.equal(expert.failed, false);
  const master = new TypingTest(['cat', 'dog'], { difficulty: 'master' });
  master.insert(' ');
  assert.equal(master.index, 0);
  assert.equal(master.failed, true);
});
