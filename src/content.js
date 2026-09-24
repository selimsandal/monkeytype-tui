import english from '../data/english.json' with { type: 'json' };
import spanish from '../data/spanish.json' with { type: 'json' };
import french from '../data/french.json' with { type: 'json' };
import german from '../data/german.json' with { type: 'json' };
import englishQuotes from '../data/quotes-english.json' with { type: 'json' };
import spanishQuotes from '../data/quotes-spanish.json' with { type: 'json' };
import frenchQuotes from '../data/quotes-french.json' with { type: 'json' };
import germanQuotes from '../data/quotes-german.json' with { type: 'json' };

export const languages = {
  english: { words: english.words, quotes: englishQuotes.quotes },
  spanish: { words: spanish.words, quotes: spanishQuotes.quotes },
  french: { words: french.words, quotes: frenchQuotes.quotes },
  german: { words: german.words, quotes: germanQuotes.quotes },
};

const quoteRanges = [[0, 100], [101, 300], [301, 600], [601, Infinity]];
export const quoteChoices = ['short', 'medium', 'long', 'thicc'];

export function randomWord(previous, config, count = Infinity, random = Math.random) {
  const choices = languages[config.language].words.filter(word =>
    !/\s/.test(word) && !previous.slice(-2).some(prior =>
      prior.replace(/[.,?!]$/, '').toLocaleLowerCase() === word.toLocaleLowerCase()));
  let word = choices[Math.floor(random() * choices.length)];
  if (config.punctuation) {
    const prior = previous.at(-1) ?? '';
    if (!previous.length || /[.?!]$/.test(prior)) word = word[0].toLocaleUpperCase() + word.slice(1);
    if ((previous.length === count - 1 || (random() < 0.1 && !/[.,]$/.test(prior) && previous.length !== count - 2))) {
      word += '.';
    } else if (random() < 0.2 && !prior.endsWith(',')) word += ',';
  }
  if (config.numbers && random() < 0.1) {
    word = String(Math.floor(random() * 10000)).padStart(4, '0');
  }
  return word;
}

export function randomQuote(language, length, random = Math.random) {
  const [min, max] = quoteRanges[quoteChoices.indexOf(length)];
  const choices = languages[language].quotes.filter(quote =>
    quote.length >= min && quote.length <= max && !/[\r\n]/.test(quote.text));
  return choices[Math.floor(random() * choices.length)];
}
