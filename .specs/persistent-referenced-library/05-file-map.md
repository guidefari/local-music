# File Map: Persistent Referenced Library

This is a design map. Files marked approval-gated are not created by this spec.

| File | Responsibility |
| --- | --- |
| `apps/electron/src/main/scanner.ts` | Existing Effect Stream walker and bounded metadata reader; evolve from transient collection to per-source `ScannedPath` stream. |
| `apps/electron/src/main/library.ts` | Add: source-specific scan scheduling, coalescing, lifecycle, and errors. |
| `apps/electron/src/main/library-repository.ts` | Add after approval: staged writes and source-local Drizzle reconciliation. |
| `apps/electron/src/main/artwork-cache.ts` | Add: content-addressed userData files, 8 MiB image limit, 512 MiB total admission, pinned-reference-safe pruning, and read-only live fallback. No DB schema needed for the cache module itself. |
| `apps/electron/src/main/library-schema.ts` | Add after approval: `library_source`, `track` with artwork digest/MIME/availability fields, and disposable `scan_stage_path`; no artwork blob table. |
| `apps/electron/src/main/database.ts` | Add after approval: Electron-compatible driver, migrations, startup cleanup. |
| `apps/electron/src/main/index.ts` | Replace transient IPC handler with source-specific library operations after cutover. |
| `apps/electron/src/preload/index.ts`, `apps/electron/src/renderer/bridge.d.ts` | Fixed validated load/add/rescan methods and unsubscribable events. |
| `apps/electron/src/shared/library-contract.ts` | Parsed IDs, source/track projections, per-source state, IPC DTOs. |
| `apps/electron/src/renderer/library-workflow.ts` | Add: Effect load, readiness, source scan requests, search/grouping. |
| `apps/electron/src/renderer/index.tsx` | Saved snapshot and per-source status; Solid remains the view. |
| `apps/electron/src/renderer/components/{albums,cover,track-list}.tsx` | Adapt to saved track identities and on-demand cached artwork. |
| `apps/electron/drizzle.config.ts`, `apps/electron/drizzle/` | Add after schema approval: generated and reviewed migration. |

## Tests

| File | Behavior |
| --- | --- |
| `apps/electron/src/main/scanner.test.ts` | Real in-process scan: nested folders, symlinks, unreadable audio, traversal failures, metadata/covers. |
| `apps/electron/src/main/artwork-cache.test.ts` | Temporary cache directory: dedup, atomic writes, admission cap, referenced-cover pinning, orphan cleanup, missing original file. |
| `apps/electron/src/main/library-repository.test.ts` | Temporary SQLite: same path keeps ID; source A scan cannot alter B; failure does not mark A missing. |
| `apps/electron/src/renderer/library-workflow.test.ts` | Effect workflow with a typed fake bridge: paint-before-rescan and source-specific requests. |
| Electron/browser integration test | Saved tracks and covers after restart and source file removal, manual source rescan, validated IPC. |

The Rust crate, Cargo manifests, MessagePack protocol adapter, and process tests are removed. No persisted job queue is required in the current single-process design.
