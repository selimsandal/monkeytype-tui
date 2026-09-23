# monkeytype-tui

A terminal typing test inspired by [Monkeytype](https://github.com/monkeytypegame/monkeytype). Requires Node.js 20+, pnpm, and an interactive terminal. The app has no runtime dependencies.

```sh
cd monkeytype-tui
pnpm start
pnpm start --words 50
pnpm start --time 30
pnpm start --mode quote --quote-length medium
pnpm start --text "one two three" --stop-on-error word
pnpm test
```

The default is Monkeytype's English **time 30** test, with punctuation and numbers off. The fullscreen interface uses the serika-dark palette, a centered three-line test, a mode bar, and a separate results state. F1/F2/F3 switch between time, words, and quote; F4 selects custom text when supplied with `--text`. F5/F6 cycle Monkeytype's time (15/30/60/120), word (10/25/50/100), or quote-length (short/medium/long/thicc) presets. Tab restarts; Esc quits. Changing modes or lengths starts a new test.

Run `node src/cli.js --help` for correction settings and keys. Incorrect characters and missed letters appear red, extra characters dark red, correct characters light, and untyped characters muted. Space commits a partially typed word in normal mode. Backspace edits the current word, and Ctrl+W or Ctrl+Backspace clears it. From an empty word, deletion can return to a previous incorrect word; it cannot return to an already correct word unless `--freedom` is set. The timer starts with the first accepted character.

This is an initial port of the input loop, not feature parity with the website. English word, time, quote, and custom space-separated text modes work. Other languages, punctuation generation, newline/code input, IME composition, funboxes, replays, website statistics, and account features are not implemented. Terminal key handling depends on the emulator; Ctrl+W is available when Ctrl+Backspace is sent as plain Backspace.
