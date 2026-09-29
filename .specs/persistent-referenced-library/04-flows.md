# Flows: Persistent Referenced Library

See [03-contracts.md](03-contracts.md) for types and [01-shape.md](01-shape.md) for the data model.

## Startup and first paint

```text
Electron ready -> open userData SQLite -> apply explicitly approved migrations
-> remove abandoned scan staging from prior crashes -> register IPC handlers
-> open window -> Solid mounts -> renderer Effect loadLibrary()
-> preload invoke -> main library.load() -> Drizzle rows -> persistence parser
-> LibrarySnapshot DTO -> preload/renderer schema decode -> Solid signals -> first paint
-> renderer readiness effect -> requestRescan() (only if sources exist)
```

The persisted snapshot displays before scanning. The renderer's readiness trigger is one-shot per window: after `loadLibrary` settles and Solid renders the metadata, schedule the rescan after two `requestAnimationFrame` callbacks so a paint can occur between them. Do not wait for every cover image; defer while the window is hidden until it is visible. Main coalesces requests from multiple windows; it does not trust the renderer for scan exclusivity. If opening or parsing the DB fails, show a typed storage error and do not silently start with an empty library. A blank fresh DB legitimately displays an empty library.

## Register folder

```text
Click Add folder -> renderer Effect -> preload fixed chooseFolder IPC
-> native dialog (main) -> cancellation returns cancelled, no writes
-> fs.realpath/absolute-root parse -> register source by unique canonical root
-> main returns updated LibrarySnapshot -> renderer decode -> Solid render
-> requestRescan() queues scan of the full source list
```

A repeated folder selection returns the existing source. Registration is a small transaction independent of the scan: a later scan failure retains the source as pending and keeps the old track snapshot. If selection happens mid-pass, do not mutate that pass's source-list snapshot; enqueue exactly one follow-up pass. Nested/overlapping roots are allowed but create separate track IDs, disclosed in UI.

## Full-library scan and commit

```text
requestRescan -> main scan coordinator deduplicates -> snapshot registered source IDs
-> generate scan ID -> begin disposable stage
-> each source in turn -> spawn Rust scanner under a cancellable process scope
-> recursive producer -> bounded queue(64) -> readers(4) -> framed MessagePack v2 stdout
-> Node incremental frame decoder (size cap, version/kind/ordering/counts)
-> validate path against selected root; translate scanner cover ID to durable digest
-> stage path or artwork in bounded writes (no long-held transaction)
-> receive complete + verify counts + clean exit for each source
-> one Drizzle transaction: insert deduped artwork, upsert successful observations
-> preserve last good metadata for unreadable paths, mark known unobserved paths missing
-> advance lastSuccessfulScanAt; clear stage; commit
-> emit committed snapshot + idle scan state -> renderer Effect decodes -> Solid updates
```

Every queued candidate contributes exactly one `observed` or `unreadable` frame. A traversal error emits its own frame and makes the whole pass incomplete. A discovered path is staged even if its tags cannot be read. Track ID allocation occurs only in the final transaction, so a failed pass cannot create half-imported tracks. `lastSeenAt` advances for observed and known unreadable tracks but not for missing tracks. Artworks from the scan may be staged temporarily, but durable artwork is referenced only after commit. Frame decoding and DB writes apply backpressure to the Rust writer and producer. Do not hold a SQLite transaction over scanner I/O. Validate throughput and main-thread pauses with a representative multi-folder library.

## Failure, cancellation, and restart

| Boundary | Behavior |
| --- | --- |
| Source unavailable or traversal failure | Fail the full pass; retain all committed tracks and presence values. Report source and category, not music filenames in logs. |
| Unreadable audio metadata | Stage `unreadable`; complete pass can commit. Known track stays present with previous metadata. New path has a diagnostic, no fabricated track. |
| Malformed/oversized frame, missing artwork reference, count mismatch, unexpected EOF, exit failure | Terminate the child, fail the pass, discard stage, retain committed snapshot. |
| Renderer closes or main exits | Main owns the job and cancels/terminates the process on app shutdown. A window closing does not necessarily cancel an app-level scan while the app stays alive. Crash leaves only disposable staging. |
| Database write/commit error | Fail typed storage operation, roll back reconciliation, retain last committed snapshot; clear staging on next startup if cleanup fails now. |
| Preload/IPC decode failure | Reject the request or event with a bounded failure message; never present malformed payloads as library data. |

Manual requests while a pass is running receive the current state; they do not run parallel scans. A cancelled/incomplete pass can be retried explicitly. Registration during a pass schedules one follow-up pass after completion or failure. Retry is safe because source registration is unique by canonical root, staging is keyed by scan ID, and track upsert is unique by `(sourceId, relativePath)`.

## Artwork, search, and UI state

Metadata-only snapshot -> renderer Effect search/grouping -> Solid track/album components. A cover component receives an artwork ID; renderer workflow fetches only visible IDs through fixed IPC, decodes bytes and MIME, caches the resulting image URL per ID, and releases object URLs when no longer used. Missing artwork uses the current fallback. Search by title, artist, album, and assembled source/path retains the current behavior; show at most the current first 500 track rows, but state whether results are capped. The UI distinguishes scan in progress, last successful scan, unreadable-file count, and incomplete failure; old tracks remain visible during a scan.

## Safety and observability

The scanner opens files read-only, never rewrites tags, and does not follow symlinks. Only Electron main chooses and normalizes source paths. Restrict IPC to the sender's app window; do not expose a raw filesystem path or arbitrary scanner command to the renderer. Log scan ID, source ID, counts, duration, and failure category, without dumping paths, tags, image bytes, or full IPC payloads. Keep progress notifications bounded/throttled rather than sending a message per file.
