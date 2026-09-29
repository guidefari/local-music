# Shape: Persistent Referenced Library

## Domain model

```text
library_source (one selected folder, unique normalized absolute root)
  └── track (app ID, relative path, last good metadata, cover ID, present/missing, last seen time)
artwork cache (content-addressed image files under app userData, not the music folder)
```

Track IDs are stable by `(sourceId, relativePath)`, not inferred from tags. A file moved to a new path becomes a new track until move reconciliation is designed. Overlapping roots can show the same physical file twice. A new unreadable file yields a diagnostic rather than an invented track; a known unreadable file retains its metadata and stays present.

## Boundaries

```text
Solid signals and components
  -> renderer Effect workflow -> validated preload/IPC -> main Effect library workflow
  -> Effect Stream directory walker + bounded metadata reads
  -> disposable per-source scan stage -> Drizzle SQLite reconciliation
```

The filesystem walker yields audio paths incrementally without following symlinks. `Stream.mapEffect(..., { concurrency: 4 })` bounds reads. `Stream.runForEach` stages results as they arrive; no `runCollect` for a production-sized library. Backpressure comes from consuming and staging each result, not from a persisted job queue. A traversal failure fails the source pass. A per-file metadata error stages that path as unreadable.

Effect `PersistedQueue` from the linked article is designed for acknowledged background jobs with locks and retries, including multiple producers/workers. This single-process desktop app has a finite source list and can restart lazy scans from saved sources. We do **not** add PersistedQueue now: it would require another durable job lifecycle and retry policy without improving the current source-of-truth rule. Revisit only if scans must resume at file granularity across restarts or run in separate workers.

## Flow

1. On launch, open an approved SQLite database, clear incomplete staging, load saved sources/tracks, and render metadata.
2. After first paint, queue one source scan per existing source, sequentially at low priority. These are **separate passes and commits**, not one all-library transaction.
3. Adding a new folder registers it and queues **only that source**. A manual rescan targets exactly one selected source.
4. Each source scan incrementally enumerates audio files, reads metadata with concurrency four, and writes staged paths and observations in bounded batches.
5. If enumeration completes, reconcile that source in one transaction: update seen tracks, preserve unreadable known tracks, mark absent paths from this source missing, advance that source's timestamp.
6. If enumeration fails or scan is interrupted, drop that source's staging and retain its previous snapshot. Other sources remain untouched.

## Artwork cache

The user chose a bounded copy so covers can remain visible when source files go missing. During a successful metadata read, hash the MIME type and image bytes, then atomically cache supported images under `userData/artwork/<digest>` with a proposed **512 MiB total cap and 8 MiB per-image cap**. The track row stores the cached digest and MIME type, not image bytes. Multiple tracks with the same cover share a file. A known unreadable/missing track keeps its last cached cover reference; the renderer loads visible covers through fixed, validated IPC.

Never evict a cover referenced by a committed track, including a missing one. Reclaim unreferenced files after a successful source commit or on startup. If the cap is full of referenced images, do not evict them: skip caching a new cover, report the cache miss, and show that new cover directly from its present file for this session. If that uncached file later disappears, its cover cannot be retained. This is an explicit best-effort bound, not an impossible promise to store unlimited artwork under a fixed cap. Artwork file creation before DB commit can leave an orphan after a failed scan; startup cleanup may remove only unreferenced files. No SQLite artwork blob table is needed.

## Risks

- The current UI still receives a full in-memory result; the persistence cutover must consume a stream into staged rows instead of accumulating all tracks/covers.
- Node metadata parsing can read substantial file data, especially embedded covers. Bound concurrency and defer cover bytes where possible.
- SQLite writes in main can block the UI; measure with a representative folder and use a worker only if needed.
- A path reused by a different file retains its ID in this first slice; decide replacement identity before attaching irreversible user edits.
