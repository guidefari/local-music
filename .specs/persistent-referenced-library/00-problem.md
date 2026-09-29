# Persistent Referenced Library

## Summary

Make the Electron app remember several selected music folders and their discovered tracks across restarts. Import means registering and indexing files where they already live, not copying them. This slice establishes durable library identity before saved playlists, app-only metadata edits, and preview playback are built.

## Current State

- The Solid renderer calls a narrow Electron preload method to choose a folder. The main process invokes the shared read-only Rust scanner and returns its complete result to the renderer.
- The scanner reports paths, embedded title/artist/album, duration, artwork, and a skipped-file count in one framed MessagePack snapshot. The renderer holds the result only in memory. Relaunching the app loses the chosen folders and track list.
- Effect Schema validates scanner output and the preload response. Drizzle ORM and Drizzle Kit are installed, but there is no library schema, migration, database, or persistence workflow.
- The GPUI frontend has been removed. `crates/scanner` is a headless Rust executable and library used by the Electron POC.

## Problem

The current scan is a temporary view, not an imported library. Tracks have paths but no durable app identity. There is no record of which folder was selected, no way to restore the library on launch, and no defined behavior when a file disappears or a scan fails. Persisting playlists or app-owned annotations against paths alone would make them fragile when files move.

## Users / Callers

- A person chooses an existing folder, browses its music, closes Electron, and returns later.
- The Electron main process initiates scans and owns local storage; the Solid renderer requests actions and displays library state through preload.
- Future playlist and metadata-editing modules will refer to durable track IDs rather than filesystem paths.

## Goals

- Register several local folders by reference and display their indexed tracks without changing audio files or tags.
- Restore the registered folders and browsable library after an app restart, then lazily rescan the full library once the important UI work is complete.
- Give indexed tracks stable app IDs across rescans of unchanged files.
- Define observable states for present and missing tracks, and surface scan failures without silently erasing previously indexed work.
- Use SQLite owned by Electron main, Drizzle for schema, queries, and generated migrations, and Effect for the import workflow and typed failures. Keep database access out of the renderer.
- Keep application workflows, IPC calls, failure handling, and library projections in Effect on the renderer side too. Solid owns rendering and reactive UI state, not the library's business rules.
- Preserve the current album-art, search, system theme, and development FPS behavior while moving the data source from renderer memory to persisted library state.

## Non-Goals

- Copying, moving, renaming, deleting, or rewriting audio files or embedded tags.
- Saved playlists, library-wide notes and tags, displayed-metadata overrides, and playback in this slice. This slice should leave a usable ID for those later features.
- Automatically re-identifying moved or duplicated files, deduplicating overlapping folders, or importing streaming-service playlists.
- Rescanning before the saved UI is ready, or timer-based polling after the initial lazy rescan.
- A durable event log or event sourcing. If notifications are needed, they report committed state changes or scan progress; SQLite remains the source of truth.
- Packaging or distributing the Electron app.

## Constraints

- Files stay in their original locations. The app owns only its library records and eventual app-only edits.
- Electron main is the only process allowed to scan files or open SQLite. Preload is the typed IPC seam; Solid does not access Node or the database.
- The existing scanner emits one binary MessagePack snapshot with raw artwork bytes and has a 30-second process timeout and a 64 MiB output limit. Electron still projects artwork to data URLs for the renderer. Artwork stays visible in this slice; large-library behavior still needs incremental streaming or paging.
- Bun remains the package manager, script runner, test runner, and main/preload bundler. Electron's runtime is Node plus Chromium. Solid's renderer is compiled by Vite.
- No handwritten SQL in application query code; Drizzle defines schema, queries, and migrations. Database schema and any data migration require explicit approval before implementation.
- The first complete journey in `wayfinder/tickets/01-first-journey.md` continues beyond this slice; file moves and tag writes remain undecided in `wayfinder/tickets/02-file-ownership.md`.

## Invariants

- Indexing and rescanning never modify music files.
- A filesystem path is a current location, not the app's stable track identity.
- A missing file does not by itself erase the track record or future app-owned references to it.
- The renderer receives validated library projections through preload, not raw database rows or a database handle.
- A failed or incomplete library pass does not turn a previously indexed collection into an empty library.
- Failure to enumerate a folder is not proof that tracks beneath it were removed. A file that was enumerated but whose metadata is unreadable is a different case; it is present, not missing.

## Open Questions

- What concrete renderer-ready signal starts the lazy scan after the saved library has painted? This belongs in the contracts and flows layers.
- What artwork caching shape best preserves covers across restarts without filling the SQLite database with duplicate data URLs?
