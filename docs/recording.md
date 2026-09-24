# Recording in an Amp orb

`.agents/setup` uses the orb's Node.js 22+ and `uv`, installs pnpm 12, Bun 1.3.10, ffmpeg, Xvfb, Openbox, DejaVu fonts, and Ghostty 1.3.1, and caches pinned `pexpect`, `pyte`, Pillow, and `mss` packages. The Ghostty Linux AppImage comes from a [community build](https://github.com/pkgforge-dev/ghostty-appimage), not the Ghostty maintainers; setup checks its SHA-256 before installing it.

Build a native executable and open a Ghostty window on the virtual display:

```sh
pnpm test
bun build --compile src/cli.js --outfile /tmp/monkeytype-tui-demo
xvfb-run -a -s '-screen 0 1700x1100x24' dbus-run-session -- bash -c '
  export LIBGL_ALWAYS_SOFTWARE=1 MESA_GL_VERSION_OVERRIDE=4.5 MESA_GLSL_VERSION_OVERRIDE=450 GDK_BACKEND=x11
  openbox &
  ghostty --gtk-single-instance=false --font-size=14 --window-width=100 --window-height=30 \
    -e bash -lc "/tmp/monkeytype-tui-demo"
'
```

For a release-identical binary, run `sh scripts/build-release.sh`, unpack the Linux x64 archive from `dist/`, and use that binary instead. Window width and height are in terminal cells. For the shell launch footage, replace `-e bash -lc "/tmp/monkeytype-tui-demo"` with `-e bash`, then type the command in Ghostty. Run `uv run --no-project --with pexpect==4.9.0 --with pyte==0.8.2 --with pillow==12.3.0 --with mss==10.2.0 python your-recording-script.py` for PTY playback or screen capture. Use `pexpect` to drive the native binary in a 100×30 PTY, `pyte` to retain the screen including ANSI colors, Pillow to draw frames with DejaVu Mono, and ffmpeg to encode MP4/GIF.

The README demo combines a Ghostty shell launch with rendered frames from the native executable's PTY output. Direct Xvfb captures may stall for many frames during software rendering; PTY rendering avoided that choppy playback. Speed up footage only when the README says so. Keep intermediate captures outside `docs/media/` and `.amp/in/artifacts/`; put only reviewed, final demo files there.
