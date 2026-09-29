# local-music

A local-file-first music library POC built with Electron, Solid, and Effect. Rust is used for the read-only audio scanner, not for the desktop UI.

## Run

Install the JavaScript workspace with `bun install`, then run `bun run dev:electron`. This builds the Rust scanner and starts Electron. Choose a folder of local music to scan MP3, M4A, FLAC, WAV, AIFF, OGG, and Opus files. The app reads embedded metadata and artwork and lets you browse albums and search tracks, artists, albums, and paths. It does not write to your music files.

Bun builds the Electron main and preload processes, and Vite compiles the Solid renderer. Effect `4.0.0-rc.118` runs and validates scans. Drizzle is installed for the upcoming persistent library; no database or schema exists yet. The development-only FPS meter is implemented in Solid.

The Rust scanner lives in `crates/scanner`. It has no UI dependencies and produces the same JSON response Electron currently consumes. Run it directly with `cargo run -p local-music-scanner --bin local-music-scan -- /path/to/music`. The Electron app is currently a development app, not a packaged distribution.

Run `cargo test`, `bun run check:electron`, and `bun run test:electron` to verify both sides. The [wayfinder map](wayfinder/map.md) tracks remaining product decisions. Playlist editing, playback, metadata correction, and library persistence are not implemented yet.
