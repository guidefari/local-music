#!/usr/bin/env bash
set -euo pipefail

iconset="$(mktemp -d "${TMPDIR:-/tmp}/local-music.XXXXXX.iconset")"
trap 'rm -rf "$iconset"' EXIT

for size in 16 32 128 256 512; do
  rsvg-convert -w "$size" -h "$size" assets/app-icon.svg -o "$iconset/icon_${size}x${size}.png"
  double=$((size * 2))
  rsvg-convert -w "$double" -h "$double" assets/app-icon.svg -o "$iconset/icon_${size}x${size}@2x.png"
done

iconutil -c icns "$iconset" -o assets/local-music.icns
