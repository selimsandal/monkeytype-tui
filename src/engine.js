// Typing rules adapted from Monkeytype's input handlers (GPL-3.0).
const equivalent = [
  new Set(['’', '‘', "'", 'ʼ', '׳', 'ʻ', '᾽']),
  new Set(['"', '”', '“', '„']),
  new Set(['–', '—', '-', '‐', '‑']),
  new Set([',', '‚']),
];
const spaces = new Set([
  0x0020, 0x2002, 0x2003, 0x2009, 0x3000, 0x00a0, 0x1680,
  0x202f, 0xfeff, 0x2007, 0x2008, 0x2004, 0x200a, 0x200b,
]);
const isSpace = char => spaces.has(char.codePointAt(0));

export function countChars(input, target, partial = false) {
  const result = { allCorrect: 0, correctWord: 0, incorrect: 0, extra: 0, missed: 0 };
  const correct = input === target;
  const prefix = target.startsWith(input);
  for (let i = 0; i < Math.max(input.length, target.length); i++) {
    const a = input[i], b = target[i];
    if (a === b) {
      if (b === ' ' && !correct) result.extra++;
      else result.allCorrect++;
      if (correct || (partial && prefix)) result.correctWord++;
    } else if (a === undefined) {
      if (!partial) result.missed++;
    } else if (b === undefined || (b === ' ' && a !== ' ' && !input.includes(' '))) {
      result.extra++;
    } else result.incorrect++;
  }
  return result;
}

export class TypingTest {
  constructor(words, options = {}) {
    if (!words.length || words.some(word => !word || /\s/.test(word))) {
      throw new Error('Expected a nonempty list of words without whitespace');
    }
    this.words = [...words];
    this.options = {
      strictSpace: false, stopOnError: 'off', deleteOnError: 'off',
      difficulty: 'normal', confidence: 'off', freedom: false,
      quickEnd: false, time: 0, nextWord: null, ...options,
    };
    this.index = 0;
    this.input = '';
    this.history = Array(words.length).fill('');
    this.started = null;
    this.ended = null;
    this.failed = false;
    this.keystrokes = 0;
    this.errors = 0;
  }

  target(index = this.index) {
    return this.words[index] + (this.options.time || index < this.words.length - 1 ? ' ' : '');
  }

  insert(char, now = Date.now()) {
    if (this.ended !== null || char.length !== 1 || (char < ' ' && char !== '\n')) return false;
    // A newline is only a commit when the generated target contains one.
    if (char === '\n') return false;
    if (char === '…' && this.target()[this.input.length] !== '…') {
      for (const period of '...') this.insert(period, now);
      return true;
    }
    const o = this.options;
    const wordIndex = this.index;
    const before = this.input;
    const target = this.target();
    const expected = target[before.length];
    if (expected !== undefined && (equivalent.some(set => set.has(char) && set.has(expected)) ||
      (expected === ' ' && isSpace(char)))) char = expected;
    else if (isSpace(char)) char = ' ';
    const separator = char === ' ';
    const hard = o.deleteOnError.endsWith('_hard');
    if (separator && !before && !(o.strictSpace || o.difficulty !== 'normal' || hard)) return false;
    const correct = char === target[before.length];
    const exact = before + char === target;
    const advance = separator && !(before.length === 0 && (o.strictSpace || o.difficulty !== 'normal')) &&
      (o.stopOnError === 'off' || exact) && (o.deleteOnError === 'off' || exact);
    if (before.length >= target.length + 20 && !advance) return false;

    if (this.started === null) this.started = now;
    this.keystrokes++;
    if (!correct) this.errors++;
    if (o.stopOnError !== 'letter' || correct) this.input += char;
    if (o.deleteOnError !== 'off' && !correct && o.stopOnError !== 'letter') {
      this.input = o.deleteOnError.startsWith('word') ? '' : this.input.slice(0, -2);
      if (hard && before.length === 0 && this.index > 0) this.previous(o.deleteOnError.startsWith('word'));
    }
    if (advance) {
      this.history[this.index] = before + char;
      if (o.time && this.index === this.words.length - 1 && o.nextWord) {
        this.words.push(o.nextWord(this.words));
        this.history.push('');
      }
      if (this.index < this.words.length - 1) {
        this.index++;
        this.input = '';
        this.history[this.index] = '';
      }
    }
    if ((o.difficulty === 'master' && !correct) ||
        (o.difficulty === 'expert' && separator && before.length > 0 && !exact)) {
      this.failed = true;
      this.ended = now;
    } else if (!o.time && wordIndex === this.words.length - 1 &&
      (before + char === target || (o.quickEnd && before.length + 1 === target.length &&
        o.stopOnError === 'off' && o.deleteOnError === 'off') || advance)) {
      this.ended = now;
    }
    return true;
  }

  previous(whole = false) {
    this.index--;
    this.input = whole ? '' : this.history[this.index].replace(/ $/, '');
    this.history[this.index] = this.input;
  }

  backspace(whole = false) {
    if (this.ended !== null || (this.options.confidence === 'max' && !this.options.freedom)) return false;
    if (this.input) {
      this.input = whole ? '' : this.input.slice(0, -1);
      return true;
    }
    if (!this.index) return false;
    if (!this.options.freedom && (this.options.confidence === 'on' ||
      this.history[this.index - 1] === this.target(this.index - 1))) return false;
    this.previous(whole);
    return true;
  }

  tick(now = Date.now()) {
    if (this.options.time && this.started !== null && this.ended === null &&
        now - this.started >= this.options.time * 1000) this.ended = this.started + this.options.time * 1000;
  }

  stats(now = Date.now()) {
    const counts = { allCorrect: 0, correctWord: 0, incorrect: 0, extra: 0, missed: 0 };
    for (let i = 0; i <= this.index; i++) {
      const partial = !!this.options.time && i === this.index && this.history[i] === '';
      const input = i === this.index && this.ended === null ? this.input : (this.history[i] || this.input);
      if (!input && i === this.index) continue;
      const c = countChars(input, this.target(i), partial);
      for (const key of Object.keys(counts)) counts[key] += c[key];
    }
    const minutes = Math.max(1 / 60000, (Math.min(now, this.ended ?? now) - (this.started ?? now)) / 60000);
    return { ...counts, wpm: Math.round(counts.correctWord / 5 / minutes),
      accuracy: this.keystrokes ? Math.round(100 * (this.keystrokes - this.errors) / this.keystrokes) : 100 };
  }
}
