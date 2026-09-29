# local-music

A local-file-first music library POC built with Electron, Solid, Tailwind CSS, and Effect. The read-only audio scanner runs in Electron main using Effect Stream and `music-metadata`.

## Run

Install the JavaScript workspace with `bun install`, then run `bun run dev:electron`. Choose a folder of local music to scan MP3, M4A, FLAC, WAV, AIFF, OGG, and Opus files. The app reads embedded metadata and artwork and lets you browse albums and search tracks, artists, albums, and paths. It does not write to your music files.

Bun builds the Electron main and preload processes, and Vite compiles the Solid renderer with Tailwind CSS v4. The warm light and charcoal dark tokens live in `apps/electron/src/styles.css`. Effect `4.0.0-rc.118` runs and validates scans. Drizzle is installed for the upcoming persistent library; no database or schema exists yet. The development-only FPS meter is implemented in Solid.

The Electron source is grouped by process: `src/main` owns native IPC and the scanner workflow, `src/preload` exposes the narrow renderer bridge, `src/shared` owns the library contract, and `src/renderer` owns the Solid UI.

Run `bun run lint`, `bun run format:check`, and `bun run check:effect` to check the TypeScript app. Oxlint includes Tailwind v4 checks and a vendored anti-slop plugin in `tools/oxlint/anti-slop`; Oxfmt uses the settings from the supplied gist. Effect's language service is configured in `apps/electron/tsconfig.json`, and its CLI check runs without patching the installed TypeScript compiler. Use `bun run lint:fix` and `bun run format` for fixes.

The scanner recursively walks folders without following symlinks and reads up to four audio files concurrently. It still returns an in-memory snapshot to the current renderer; durable storage is a later slice. The Electron app is currently a development app, not a packaged distribution.

Run `bun run check:electron` and `bun run test:electron` to verify the app. The [wayfinder map](wayfinder/map.md) tracks remaining product decisions. Playlist editing, playback, metadata correction, and library persistence are not implemented yet.
