import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languages, randomQuote, randomWord } from '../src/content.js';

test('language selections use their own word lists and quote banks', () => {
  const first = { english: 'the', spanish: 'como', french: 'a', german: 'der', turkish: 'bir' };
  for (const [language, word] of Object.entries(first)) {
    assert.equal(randomWord([], { language, punctuation: false, numbers: false }, 10, () => 0), word);
    const quote = randomQuote(language, 'medium', () => 0);
    assert.ok(quote.length >= 101 && quote.length <= 300);
    assert.ok(quote.source);
    assert.ok(languages[language].words.length > 100);
  }
  for (const language of ['french', 'german', 'turkish']) {
    for (let i = 0; i < 100; i++) {
      assert.doesNotMatch(randomWord([], { language, punctuation: false, numbers: false }, 10,
        () => i / 100), /\s/);
    }
  }
});

test('Turkish sentence capitals and duplicate exclusion use dotted and dotless I', () => {
  const config = { language: 'turkish', punctuation: true, numbers: false };
  const draws = [4 / 298, 0.5, 0.5];
  assert.equal(randomWord([], config, 10, () => draws.shift()), 'İçin');
  assert.equal(randomWord(['İÇİN'], { ...config, punctuation: false }, 10, () => 4 / 297), 'o');
});

test('punctuation capitalizes sentence starts and ends the final word; numbers replace words', () => {
  const config = { language: 'english', punctuation: true, numbers: false };
  const firstDraws = [0, 0.5, 0.5];
  assert.equal(randomWord([], config, 3, () => firstDraws.shift()), 'The');
  assert.equal(randomWord(['The'], config, 3, () => 0), 'be,');
  assert.equal(randomWord(['The', 'be,'], config, 3, () => 0), 'of.');
  const numbers = { language: 'spanish', punctuation: false, numbers: true };
  const draws = [0, 0.05, 0.1234];
  assert.equal(randomWord([], numbers, 10, () => draws.shift()), '1234');
});
