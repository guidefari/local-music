# Persistent Referenced Library

## Summary

Remember several selected folders and the tracks found there across Electron restarts. Music remains at its original location. Adding a folder scans only that folder; a later rescan targets one source at a time.

## Current State

Electron main scans a chosen folder recursively with Effect Stream and `music-metadata`, up to four metadata reads at a time. It sends a complete in-memory result through preload to Solid. The current result includes data URLs for embedded artwork. No database, Drizzle schema, migration, saved sources, or track IDs exist. The Rust executable and MessagePack transport have been removed.

## Problem

The app forgets every import when it closes. Paths are not stable app identities. It cannot distinguish a missing track from an unreadable file or an incomplete directory walk in durable state. A scan of an unrelated folder must not rescan or alter previously indexed sources.

## Users / Callers

- A person chooses local folders, browses saved metadata, and returns later.
- Electron main owns scanning and storage; preload exposes fixed, validated IPC methods; Solid renders the saved library.
- Future playlists and app-only annotations refer to stable track IDs.

## Goals

- Save several referenced sources and tracks with app-owned IDs; keep old metadata for missing/unreadable files.
- Load the saved view first, then lazily queue separate rescans for existing sources after UI readiness.
- Scan only the chosen source when adding or manually rescanning a folder.
- Commit each source's complete pass atomically; failure leaves that source's last snapshot intact and never changes another source.
- Use Effect for main and renderer workflows, Effect Stream for incremental scanning, Drizzle for approved SQLite schema/queries, and Bun for scripts.
- Preserve current search, album layout, theme, FPS readout, and embedded covers for present files.

## Non-Goals

- Editing, copying, moving, renaming, or deleting music files or embedded tags.
- Playlist editing, playback, metadata overrides, source removal, automatic move detection, or merging overlapping folders.
- A distributed worker fleet, replayable event log, or timer-based polling.
- Packaging the Electron app.

## Constraints and Invariants

- Audio files are only read. Electron main alone touches the filesystem and database.
- A failed or partial scan never marks unobserved paths missing. An enumerated file with unreadable metadata is present, not missing.
- A source-relative path is not an app track ID. An unchanged path retains its track ID across successful rescans.
- UI receives validated projections, not database rows or a database handle.
- No database schema, migration, or real userData database is created without specific approval of fields and constraints.
- Artwork policy is unresolved: reading from present files on demand avoids duplicate storage but cannot display covers for missing files. Prior discussion requested retained artwork; confirm that requirement before implementing artwork persistence.

## Open Questions

- Is artwork for missing/unreadable files worth an app-owned, bounded cache, or may those covers disappear until the file returns?
- Which Node/Electron-compatible SQLite driver works with Drizzle in this runtime? Prove it against a throwaway database before touching userData.
