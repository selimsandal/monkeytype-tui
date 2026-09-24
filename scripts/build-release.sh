#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"
sha=$(git rev-parse HEAD)
short=$(printf '%s' "$sha" | cut -c1-7)
epoch=$(git show -s --format=%ct HEAD)
version="0.0.${epoch}-g${short}"
out=${RELEASE_OUT:-dist}
mkdir -p "$out"
out=$(CDPATH= cd -- "$out" && pwd)
rm -f "$out"/monkeytype-tui_*.tar.gz "$out"/monkeytype-tui_*.zip \
  "$out/SHA256SUMS" "$out/VERSION"
stage="$out/.stage"
trap 'rm -rf "$stage"' EXIT

for target in linux-x64 linux-arm64 darwin-x64 darwin-arm64 windows-x64 windows-arm64; do
  os=${target%-*}
  arch=${target#*-}
  name="monkeytype-tui_${version}_${os}_${arch}"
  mkdir -p "$stage/$name"
  binary=monkeytype-tui
  [ "$os" = windows ] && binary=monkeytype-tui.exe
  printf 'Building %s\n' "$target"
  bun build --compile --target="bun-$target" --define "BUILD_VERSION=\"$version\"" \
    src/cli.js --outfile "$stage/$name/$binary"
  cp LICENSE "$stage/$name/LICENSE"
  if [ "$target" = linux-x64 ]; then
    [ "$("$stage/$name/$binary" --version)" = "$version" ]
    "$stage/$name/$binary" --help >/dev/null
  fi
  if [ "$os" = windows ]; then
    (cd "$stage/$name" && python3 -m zipfile -c "$out/$name.zip" "$binary" LICENSE)
  else
    tar -C "$stage/$name" -czf "$out/$name.tar.gz" "$binary" LICENSE
  fi
done
(cd "$out" && sha256sum ./*.tar.gz ./*.zip > SHA256SUMS)
printf '%s\n' "$version" > "$out/VERSION"
printf 'Built %s in %s\n' "$version" "$out"
