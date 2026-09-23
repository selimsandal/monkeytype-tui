# monkeytype-tui

A terminal typing test inspired by [Monkeytype](https://github.com/monkeytypegame/monkeytype). Requires Node.js 20+ and an interactive terminal. No installation or network connection is needed.

```sh
cd monkeytype-tui
npm start
npm start -- --words 50
npm start -- --time 30
npm start -- --text "one two three" --stop-on-error word
npm test
```

Run `node src/cli.js --help` for correction settings and keys. Incorrect characters remain visible in red, extra characters in yellow, correct characters in green; untyped characters are gray. Space commits a partially typed word in normal mode. Backspace edits the current word, and Ctrl+W or Ctrl+Backspace clears it. From an empty word, deletion can return to a previous incorrect word; it cannot return to an already correct word unless `--freedom` is set. The timer starts with the first accepted character.

This is an initial port of the input loop, not feature parity with the website. English word tests, timed tests, and custom space-separated text work. Quotes, other languages, punctuation generation, newline/code input, IME composition, funboxes, replays, website statistics, and account features are not implemented. Terminal key handling depends on the emulator; Ctrl+W is available when Ctrl+Backspace is sent as plain Backspace.

Typing rules were adapted from Monkeytype's `frontend/src/ts/input` and `frontend/src/ts/utils/strings.ts`, at commit `4bd46c6ca1c2b02ba0203b83b6f0b32a2a5a53ec`. `data/english.json` is copied from `frontend/static/languages/english.json` at that commit. Copyright remains with the Monkeytype contributors. This project and adapted material are licensed under GPL-3.0; see `LICENSE`.
