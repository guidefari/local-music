# Test Plan: Persistent Referenced Library

Implement one observable vertical slice at a time: a failing test, the smallest working path, then cleanup. Exercise repository/scanner/bridge seams; no module mocks, method spies, or unit tests of framework entrypoint files.

## Slice 1: Saved library survives restart

- Red: With a temporary SQLite file, register one real folder through the library API, scan one tagged file, close and reopen the repository, then load the same source and stable track ID.
- Green: Verify a Drizzle-compatible driver in Electron, obtain schema approval, then add schema, migration, repository, and minimal scan path.
- Refactor: Move row parsing and projection behind the repository without introducing a pass-through service.

## Slice 2: Several roots and duplicate selection

- Red: Register two folders, select one twice, scan, and observe two sources with no duplicate source, with IDs unchanged on a second pass.
- Green: Canonical-root uniqueness and `(sourceId, relativePath)` upsert.
- Refactor: Centralize root normalization and path containment parsing.

## Slice 3: Streaming scanner accounts for work

- Red: Run the real scanner on nested folders, a tagged track, and an unreadable audio candidate. Verify version 2 frames, one terminal summary, and counts. Separately simulate traversal failure and verify an incomplete outcome.
- Green: Bounded queue, four metadata readers, frame writer, and typed traversal/read outcomes.
- Refactor: Keep scanner library operations separable from CLI framing; prove producer/writer drain before completion.

## Slice 4: Failed pass cannot infer missing tracks

- Red: Load an existing library, stage some seen paths, then inject truncated/oversized frame, child crash, or traversal error through the real scanner adapter seam. After restart, assert committed tracks and presence are unchanged.
- Green: Disposable stage, full-pass completion checks, atomic reconciliation only after clean completion, startup cleanup.
- Refactor: One cancellation/failure cleanup path with typed error categories.

## Slice 5: Missing versus unreadable

- Red: Scan two tracks, delete one, make the other's metadata unreadable, complete a pass; the absent one becomes missing, the unreadable one stays present with its prior metadata/cover and ID. A newly unreadable file creates a diagnostic, not a fake track.
- Green: Separate staged path coverage from successful observations; reconcile by source and relative path.
- Refactor: Isolate present/missing transition rules from persistence mechanics.

## Slice 6: Library appears before lazy rescan

- Red: In a real Electron window with a saved snapshot, load and paint tracks before scanner progress begins; after readiness, show running state, then committed update. Repeated rescan clicks start only one child process.
- Green: Renderer Effect load/readiness workflow, main-owned coordinator, fixed IPC events and cleanup.
- Refactor: Keep Solid components focused on signals/rendering, and scan scheduling in Effect/main.

## Slice 7: Artwork after restart

- Red: Two tracks sharing embedded artwork persist one durable cover, and both display it after restart by on-demand IPC. A missing track retains its cover. Invalid artwork IDs fail at the boundary.
- Green: Digest-based dedup, binary storage, validated artwork lookup, renderer URL cache and cleanup.
- Refactor: Keep data URLs/Blob URL creation out of persisted rows and whole-library IPC.

## Coverage and validation

- Protocol: unsupported version, invalid length, oversized frame, malformed MessagePack, unexpected frame order, duplicate completion, missing referenced artwork, and mismatched counts.
- Persistence: failed commit rollback, abandoned stage cleanup, corrupt stored row classification, duplicate paths, source unavailable, and overlapping roots retaining distinct source-relative identities.
- Safety: unchanged audio bytes and mtime before/after scan; symlinks not followed; no tag write; no path escape through IPC.
- Scale: representative multi-folder scan above the current 64 MiB whole-output limit, bounded queue/concurrency, bounded frame memory, and measured main-thread commit pause. The 500-row view cap remains visible and honest.
- Run Rust tests, `bun run test:electron`, `bun run check:electron`, `bun run check:effect`, `bun run lint`, `bun run format:check`, the Electron build, and a real light/dark UI check.

Tests touching SQLite use temporary files only. Do not create a real `userData` database or apply migrations without schema approval.
