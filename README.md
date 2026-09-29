# local-music

A local-file-first music library POC built with Electron, Solid, Tailwind CSS, and Effect. Rust is used for the read-only audio scanner, not for the desktop UI.

## Run

Install the JavaScript workspace with `bun install`, then run `bun run dev:electron`. This builds the Rust scanner and starts Electron. Choose a folder of local music to scan MP3, M4A, FLAC, WAV, AIFF, OGG, and Opus files. The app reads embedded metadata and artwork and lets you browse albums and search tracks, artists, albums, and paths. It does not write to your music files.

Bun builds the Electron main and preload processes, and Vite compiles the Solid renderer with Tailwind CSS v4. The warm light and charcoal dark tokens live in `apps/electron/src/styles.css`. Effect `4.0.0-rc.118` runs and validates scans. Drizzle is installed for the upcoming persistent library; no database or schema exists yet. The development-only FPS meter is implemented in Solid.

The Electron source is grouped by process: `src/main` owns native IPC and the scanner adapter, `src/preload` exposes the narrow renderer bridge, `src/shared` owns the library contract, and `src/renderer` owns the Solid UI. Scanner protocol tests live beside the main-process adapter.

Run `bun run lint`, `bun run format:check`, and `bun run check:effect` to check the TypeScript app. Oxlint includes Tailwind v4 checks and a vendored anti-slop plugin in `tools/oxlint/anti-slop`; Oxfmt uses the settings from the supplied gist. Effect's language service is configured in `apps/electron/tsconfig.json`, and its CLI check runs without patching the installed TypeScript compiler. Use `bun run lint:fix` and `bun run format` for fixes.

The Rust scanner lives in `crates/scanner`. It has no UI dependencies and sends a versioned, length-prefixed MessagePack scan result to Electron over stdout. Artwork crosses that process boundary as bytes, not base64; Electron prepares data URLs for the renderer. Run it directly with `cargo run -p local-music-scanner --bin local-music-scan -- /path/to/music > scan.msgpack` (the file includes a four-byte frame header). The Electron app is currently a development app, not a packaged distribution.

Run `cargo test`, `bun run check:electron`, and `bun run test:electron` to verify both sides. The [wayfinder map](wayfinder/map.md) tracks remaining product decisions. Playlist editing, playback, metadata correction, and library persistence are not implemented yet.
