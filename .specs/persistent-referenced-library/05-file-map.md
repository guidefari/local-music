# File Map: Persistent Referenced Library

Paths are implementation targets, not files created by this design-only spec. Database work remains subject to explicit approval.

## Files to add

| File | Responsibility |
| --- | --- |
| `apps/electron/src/main/library.ts` | Main-owned library operations and scan coordinator; one in-flight job, coalescing, app-lifetime cancellation. |
| `apps/electron/src/main/library-repository.ts` | Parsed library projection, source registration, staged append, atomic reconciliation, artwork lookup using Drizzle. |
| `apps/electron/src/main/library-schema.ts` | Drizzle SQLite tables, unique indexes, references, and stage constraints (after schema approval). |
| `apps/electron/src/main/database.ts` | Open Electron userData SQLite, driver setup, migrations, abandoned-stage cleanup (after approval). |
| `apps/electron/src/renderer/library-workflow.ts` | Renderer Effect load/import/rescan, decode, search/grouping, on-demand cover cache. |
| `apps/electron/drizzle.config.ts` and `apps/electron/drizzle/` | Drizzle Kit configuration and reviewed generated migrations (after approval). |

## Files to change

| File | What changes |
| --- | --- |
| `crates/scanner/src/lib.rs` | Bounded recursive producer and metadata readers; distinguish unreadable files and traversal failures; do not build a complete result in memory for the streaming CLI. |
| `crates/scanner/src/main.rs` | Stream version 2 length-prefixed MessagePack frames with a terminal summary; bounded writer and exit semantics. |
| `apps/electron/src/main/scanner-protocol.ts` | Incremental version 2 parser, validation, durable artwork digest and normalized path translation. |
| `apps/electron/src/main/scanner.ts` | Child process streaming, backpressure, timeout/cancellation and completion accounting. |
| `apps/electron/src/main/index.ts` | Startup composition, DB lifetime, IPC request validation, folder picker, notification broadcast. |
| `apps/electron/src/preload/index.ts` | Narrow load/add/rescan/artwork methods, validated replies and subscription/unsubscription. |
| `apps/electron/src/shared/library-contract.ts` | Effect schemas for IDs, library snapshots, status, requests, responses, and notifications. |
| `apps/electron/src/renderer/bridge.d.ts` | Typed preload API. |
| `apps/electron/src/renderer/index.tsx` | Load saved state, signal readiness after paint, render sources/status, delegate workflows. |
| `apps/electron/src/renderer/components/albums.tsx`, `cover.tsx`, `track-list.tsx` | Consume persisted metadata and on-demand artwork without moving workflow rules into Solid. |
| `apps/electron/package.json` | Approved SQLite driver, Drizzle migration scripts, checks; keep Bun build compatible with Electron runtime. |

## Files to remove after cutover

| File/behavior | Reason |
| --- | --- |
| Version 1 whole-buffer scanner path in `scanner.ts` and `scanner-protocol.ts` | Avoid two production protocols after version 2 is verified. |
| `library:choose-folder` reply containing a full in-memory `ScanResult` | Replace with persistent snapshot; preserve the narrow bridge, not the old temporary response contract. |

## Test files

| File | Observable behavior |
| --- | --- |
| `crates/scanner/src/lib.rs` unit/integration tests | Nested traversal, symlink handling, unreadable vs traversal failure, bounded producer/worker completion. |
| `apps/electron/src/main/scanner-protocol.test.ts` | Split/truncated/malformed frames, size limit, completion/count validation, path rejection, cover bytes. |
| `apps/electron/src/main/scanner.test.ts` | Real Rust executable streaming, cancellation, clean exit and incomplete scan. |
| `apps/electron/src/main/library-repository.test.ts` | Temporary SQLite through the public repository: stable IDs, multiple roots, unreadable, missing, failed pass rollback, restart. |
| `apps/electron/src/renderer/library-workflow.test.ts` | Effect workflow with a typed fake bridge at the real boundary: load-before-rescan, search and failure state. |
| Browser/Electron integration test | Real preload and renderer display saved data and artwork after restart; no `page.tsx` or route unit tests. |

## Driver and runtime checkpoint

First verify an Electron-compatible SQLite driver with Drizzle in a throwaway database under the approved temporary directory. A Bun SQLite binding is not automatically usable in Electron. If native rebuild is required, document the build script before touching `userData`. If the driver or migrations cannot run safely in Electron, stop and revise the persistence seam rather than bypassing Drizzle with handwritten application SQL.
