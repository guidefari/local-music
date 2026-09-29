# local-music

A local-file-first music library and playlist manager built with [GPUI Kit](https://gpui-kit.com/).

## Run

On macOS, install the Xcode Command Line Tools, then run:

```sh
cargo run
```

For a macOS app bundle with the local-music Dock icon, run `scripts/package-macos.sh` and open `target/debug/local-music.app`.

The pinned Rust toolchain is installed by rustup when needed. Choose a folder of local audio files in the app. The current slice scans MP3, M4A, FLAC, WAV, AIFF, OGG, and Opus files, reads their embedded metadata, and lets you search tracks, artists, albums, and file paths. It does not write to your music files.

This is the first slice of [the wayfinder journey](wayfinder/tickets/01-first-journey.md). Playlist editing, playback, metadata correction, and library persistence are not implemented yet. The [wayfinder map](wayfinder/map.md) tracks the remaining product decisions.
