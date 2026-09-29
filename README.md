# local-music

A local-file-first desktop music library for macOS, built with Electron, Solid, Tailwind CSS, Effect, Drizzle, and SQLite.

## Run

```sh
bun install --frozen-lockfile
bun run dev:desktop
```

To send main-process library operation traces to the Planetaryescape collector, set the following
environment variables in the process that starts Electron (keep the bearer token in your secret
manager, not in this repository):

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.planetaryescape.co.za
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_TOKEN"
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=local
bun run dev:desktop
```

Without an endpoint, telemetry is disabled. Traces cover library load, folder addition, and
rescans, including their duration and failure status; paths, track metadata, and exception details
are not recorded. The public collector requires a valid bearer token; obtain it through your
private observability secret-management workflow. Search for `local-music-desktop` in Grafana Tempo.

Add one or more folders to index MP3, M4A, FLAC, WAV, AIFF, OGG, and Opus files. The app loads saved metadata at startup, then rescans each source. Adding or manually rescanning a folder touches only that source. It never changes audio files or embedded tags. Tracks that disappear remain in the library as missing until they return.

Embedded album art is copied to a bounded, content-addressed cache in Electron app data. The renderer loads binary covers by saved track ID through a narrow Electron protocol. It does not receive filesystem paths to arbitrary files or base64 artwork.

## Workspace

The private Bun workspace has one app, `@local-music/desktop` in `apps/electron`. Its `src/contracts` defines library and service boundaries; `src/implementation` contains the Electron main process, preload bridge, and Solid renderer. These are source boundaries, not separate packages: there is no second consumer to justify a package split yet. Imports use the `@/` alias for `apps/electron/src`, resolved by TypeScript, Bun, and Vite.

The root owns one `bun.lock`, shared lint and formatting, and aggregate scripts:

```sh
bun run verify
bun run build
bun run test
```

`bun run verify` checks lint, formatting, TypeScript, Effect diagnostics, tests, and the production build. The app is a development build, not a packaged distribution. Playlist editing, playback, and file moves are not implemented.

The [MVP decision map](https://github.com/guidefari/local-music/issues/1) and its tickets live in GitHub Issues.
