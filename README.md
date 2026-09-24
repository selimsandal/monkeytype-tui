# monkeytype-tui

A terminal typing test inspired by [Monkeytype](https://github.com/monkeytypegame/monkeytype). Source runs require Node.js 20.10+, pnpm, and an interactive terminal. The app has no runtime dependencies.

```sh
cd monkeytype-tui
pnpm start
pnpm start --words 50
pnpm start --time 30
pnpm start --mode quote --quote-length medium
pnpm start --text "one two three" --stop-on-error word
pnpm test
```

## Native downloads

[GitHub Releases](https://github.com/selimsandal/monkeytype-tui/releases) provides standalone archives for Linux, macOS, and Windows on x64 and ARM64. Unpack the archive and run `monkeytype-tui` (or `monkeytype-tui.exe` on Windows); neither Node.js nor Bun is needed. Each archive includes `LICENSE`. Use `SHA256SUMS` on the release to verify the download. macOS binaries are not notarized.

Standalone executables check the public GitHub release on startup. On Linux and macOS, a newer version installs before the test opens. On Windows, the current test opens while the update waits to replace the executable after the test closes. Run `monkeytype-tui update` to check and install manually; on Windows this starts the replacement in the background and prints a log path if it fails. Updates download the archive for your OS and architecture, verify its SHA-256 checksum, and replace the executable in place. Keep the executable in a writable directory; an offline or failed startup check leaves the current version usable. Source runs with `pnpm start` do not update automatically.

Every push to `main` runs tests and publishes a release named `0.0.<commit-unix-time>-g<7-character-sha>`, following the generated identity format used by harness. The commit timestamp and SHA keep the version stable across workflow reruns. `monkeytype-tui --version` prints the embedded identity. For a local build, install Bun 1.3.10 and run `sh scripts/build-release.sh`; its six archives and checksums appear in `dist/`.

The default is Monkeytype's English **time 30** test, with punctuation and numbers off. The fullscreen interface uses the serika-dark palette, a centered three-line test, a mode bar, and a results graph of WPM, raw speed, and errors. The first two lines stay in place; after entering the third, each new line scrolls the active line into the middle with a line ahead. F1/F2/F3 switch between time, words, and quote; F4 selects custom text when supplied with `--text`. F5/F6 cycle Monkeytype's time (15/30/60/120), word (10/25/50/100), or quote-length (short/medium/long/thicc) presets. Click the mode and length labels to select them. Tab restarts; Esc quits.

Press F10 or click **settings** to open the menu. Use Up/Down to select, Left/Right or Enter to change, and Esc to close; clicking a setting cycles its value. Language choices are English, Spanish, French, German, and Turkish, with word lists and quotes from Monkeytype. Punctuation and numbers affect generated time/words tests, not quotes or custom text. The menu also exposes difficulty, stop/delete on error, confidence, strict space, freedom, and quick end. Changing a setting or opening the menu during an active test starts a fresh test. Choices are saved to your user config directory (`~/.config/monkeytype-tui/settings.json` on Linux/macOS, `%APPDATA%\monkeytype-tui\settings.json` on Windows).

Run `node src/cli.js --help` for correction settings and keys. Incorrect characters and missed letters appear red, extra characters dark red, correct characters light, and untyped characters muted. Extra letters appear inline while typing; after moving on, they are hidden and the word is underlined, while the result still counts them. Space commits a partially typed word in normal mode. Backspace edits the current word, and Ctrl+W or Ctrl+Backspace clears it. From an empty word, deletion can return to a previous incorrect word; it cannot return to an already correct word unless `--freedom` is set. The timer starts with the first accepted character.

This is an initial port of the input loop, not feature parity with the website. English, Spanish, French, German, and Turkish time, word, and quote modes and custom space-separated text work. Punctuation generation covers sentence capitalization, periods, and commas; Monkeytype's full punctuation rules, newline/code input, IME composition, funboxes, replays, website statistics, and account features are not implemented. Terminal key and mouse handling depends on the emulator; Ctrl+W is available when Ctrl+Backspace is sent as plain Backspace.
