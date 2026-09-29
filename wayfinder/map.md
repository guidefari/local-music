---
type: wayfinder:map
status: open
---

# Shape the local-music MVP

## Destination

An implementable, macOS-first MVP spec for an Electron desktop app that manages local music files and playlists. It should settle the first user journey, file and metadata ownership, playlist model, safe file operations, basic playback, and a feasible technical shape. It should leave clear seams for later Apple Music and Spotify imports and Rekordbox preparation without building those integrations now.

## Notes

- Planning only. Decisions belong in ticket resolution notes; the map is an index.
- The local Markdown files in `wayfinder/tickets/` are the issue tracker until a remote issue tracker exists. `status` and `assignee` in each ticket's frontmatter express closure and claims; `blocked_by` lists dependencies.
- Work one decision ticket per session. Claim an unblocked, unassigned ticket before working on it. Use `/grilling` for product decisions and `/prototype` when a concrete artifact would clarify behavior.
- Local audio files are the starting point. The user wants both playlist curation and library organization, including eventual moves and renames. Basic preview playback is in scope, not a full player.
- Do not change, tag, move, or delete real music files while planning. File operations need an explicit safety decision before implementation.
- The initial GPUI Kit frontend was retired. Electron with Solid and Effect is the only desktop UI; the read-only scanner now uses Effect Stream in Electron main instead of Rust.

## Decisions so far

- [Define the first complete local-music journey](tickets/01-first-journey.md): index local files, find tracks three ways, curate and annotate an ordered playlist, preview a full track, correct displayed metadata, and return later to refine it.

## Not yet specified

- Exact metadata editing and cleanup flows, including how tags in audio files relate to app-only metadata.
- Scan, rescan, missing-file, duplicate, and moved-file behavior once file identity is settled.
- Import/export fidelity and playlist paths for eventual Spotify, Apple Music, and Rekordbox use.
- Playback backend and Electron integration once the core workflow is clear.
- Test fixtures and acceptance criteria for the chosen MVP journey.

## Out of scope

- Implementing the app as part of this map.
- Shipping Spotify or Apple Music integrations in the first release.
- Rekordbox integration or DJ-specific preparation in the first release; keep the route open for later.
- A full-featured music player or cross-platform launch in the first release.
