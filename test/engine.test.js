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
