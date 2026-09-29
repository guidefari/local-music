#!/usr/bin/env bash
set -euo pipefail

profile="${1:-debug}"
if [[ "$profile" != "debug" && "$profile" != "release" ]]; then
  echo "Usage: scripts/package-macos.sh [debug|release]" >&2
  exit 1
fi

if [[ "$profile" == "release" ]]; then
  cargo build --release
else
  cargo build
fi

app="target/$profile/local-music.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "target/$profile/local-music" "$app/Contents/MacOS/local-music"
cp assets/local-music.icns "$app/Contents/Resources/local-music.icns"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>local-music</string>
  <key>CFBundleDisplayName</key><string>local-music</string>
  <key>CFBundleIdentifier</key><string>dev.localmusic.app</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleExecutable</key><string>local-music</string>
  <key>CFBundleIconFile</key><string>local-music.icns</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

echo "$app"
