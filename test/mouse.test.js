import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMouseParser } from '../src/mouse.js';

test('SGR mouse clicks survive Bun readline splitting and wheel/release events are ignored', () => {
  const parse = createMouseParser();
  assert.deepEqual(parse(undefined, { sequence: '\x1b[<' }), { consumed: true });
  for (const char of '0;27;8') assert.equal(parse(char, { sequence: char }).consumed, true);
  assert.deepEqual(parse('M', { sequence: 'M' }), { consumed: true, click: { col: 27, row: 8 } });
  assert.deepEqual(parse(undefined, { sequence: '\x1b[<64;27;8M' }), { consumed: true, click: null });
  assert.deepEqual(parse(undefined, { sequence: '\x1b[<0;27;8m' }), { consumed: true, click: null });
  assert.deepEqual(parse('a', { sequence: 'a' }), { consumed: false });
});

test('legacy mouse coordinates are decoded without turning bytes into typing input', () => {
  const parse = createMouseParser();
  assert.deepEqual(parse(undefined, { sequence: '\x1b[M' }), { consumed: true });
  for (const char of [String.fromCharCode(32), String.fromCharCode(52)]) {
    assert.equal(parse(char, { sequence: char }).consumed, true);
  }
  assert.deepEqual(parse(String.fromCharCode(44), { sequence: String.fromCharCode(44) }),
    { consumed: true, click: { col: 20, row: 12 } });
  assert.deepEqual(parse('b', { sequence: 'b' }), { consumed: false });
});
