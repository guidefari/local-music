# local-music

A local-file-first music library and playlist manager with two desktop frontends: Rust with [GPUI Kit](https://gpui-kit.com/) and Electron with Effect.

## Rust app

On macOS, install the Xcode Command Line Tools, then run:

```sh
cargo run -p local-music
```

For a macOS app bundle with the local-music Dock icon, run `apps/rust/scripts/package-macos.sh` and open `target/debug/local-music.app`.

The Rust interface follows macOS light or dark appearance, including changes while the app is open. Its color tokens live in `apps/rust/src/appearance.rs`; it uses the macOS system UI font for text and Menlo for track numbers and durations. The editable icon source is `apps/rust/assets/app-icon.svg`. To regenerate the macOS icon after editing it, run `apps/rust/scripts/generate-icon.sh` with `rsvg-convert` and `iconutil` installed.

The pinned Rust toolchain is installed by rustup when needed. Choose a folder of local audio files in the app. The current slice scans MP3, M4A, FLAC, WAV, AIFF, OGG, and Opus files, reads their embedded metadata, and lets you search tracks, artists, albums, and file paths. It does not write to your music files.

This is the first slice of [the wayfinder journey](wayfinder/tickets/01-first-journey.md). Playlist editing, playback, metadata correction, and library persistence are not implemented yet. The [wayfinder map](wayfinder/map.md) tracks the remaining product decisions.

## Electron app

Install the JavaScript workspace with `bun install`, then run `bun run dev:electron`. This builds the shared Rust scanner and starts Electron. The Electron app uses Effect `4.0.0-rc.118` to run and validate scans, React for the renderer, and a development-only FPS meter. No Vite or CSS framework is needed.

Both apps use the same read-only scanner for metadata and embedded album art. Electron invokes the scanner as a local process; it does not expose Node.js to the renderer. The Electron app is currently a development app, not a packaged distribution. Run `cargo test`, `bun run check:electron`, and `bun run test:electron` to verify both sides.
