# Alternatives: Persistent Referenced Library

## Option A: One buffered scanner result per folder

Keep version 1 MessagePack, collect all tracks and artwork in Rust, then write one response and transact it in Electron. Little new code, but the 30-second timeout, 64 MiB stdout cap, and Rust/Electron peak memory scale with library size. A traversal error is currently indistinguishable from an unreadable audio file. This cannot safely infer missing tracks.

## Option B: Incremental frames plus disk-backed staging

Version 2 of the existing length-prefixed MessagePack protocol emits paths, successful metadata, artwork, traversal failures, and a final completion frame. Main validates each frame and persists bounded batches to staging. Only after every registered source finishes cleanly does a short transaction reconcile staged paths into the committed library. This retains the last snapshot after process failure or restart. It requires protocol and staging work, but no event bus or second database.

## Option C: Scan and commit each source independently

Use incremental frames and staging, but publish each source as it completes. This gets early updates for large multi-source libraries, yet a failed later source leaves a mixed-generation library and changes the agreed whole-library completion rule. It also makes global scan state and source registration harder to explain.

## Comparison

| Dimension | A: Buffered | B: Atomic full pass | C: Per-source commit |
| --- | --- | --- | --- |
| Memory under large scans | Unbounded snapshot | Bounded frame/queue; disk staging | Bounded frame/queue; disk staging |
| Failure semantics | Ambiguous traversal and reads | Last full snapshot retained | Mixed generations |
| Caller burden | Simple now, failure-prone later | One scan state and one committed view | Per-source generations |
| Implementation effort | Low | Moderate | Moderate to high |
| Fit with agreed completion rule | Poor | Strong | Poor |

## Recommendation

Choose B. Keep the existing protocol family but introduce version 2 frames and a staged full-library commit. Do not attempt to infer missing tracks from version 1 responses. Keep the old scanner and tests working until the version 2 path is verified, then remove the unused one-shot path rather than maintaining two production scanners.
