# Alternatives: Persistent Referenced Library

## Scanning

| Option | Shape | Tradeoff |
| --- | --- | --- |
| A: Whole-folder snapshots | Collect tracks/covers into arrays, then save | Easy to wire, but peak memory grows with library size and incomplete traversal is dangerous. Suitable only for the current POC UI. |
| B: Effect Stream per source | Async directory iterator, bounded `mapEffect`, staged per-path writes, commit at source completion | Some staging code, but bounded reads and source-local failures. **Chosen.** |
| C: PersistedQueue per audio file | Durable jobs, locks, retries and acknowledgments | Useful for independent workers or resumable jobs, but adds durable queue state and makes proof of complete enumeration harder. Not needed now. |

## Commit boundary

Commit each source separately rather than requiring all sources to finish before any update. Adding a source cannot change another source's missing/present state. Startup may queue all registered sources **one at a time**; each can succeed or fail independently. Manual rescan and add-folder are source-specific. No scan of the entire library is triggered by adding one folder.

## Artwork

| Option | Benefit | Cost |
| --- | --- | --- |
| Read from original files on demand | No copied image bytes, simple storage, fresh cover when tags change | Missing/unreadable files have no cover; rejected for this slice. |
| Bounded app-owned cache | Known tracks keep cached covers when files disappear; duplicate covers share one file | Copies artwork; requires admission, size cap, and orphan cleanup. **Chosen.** |

Store cached images as content-addressed files under app userData, not as unbounded SQLite blobs. Store only the digest and MIME reference in a track row after schema approval. Proposed cap: 512 MiB total, 8 MiB per image. Existing committed references are pinned; new artwork is not cached if the cap cannot admit it. This favors retaining old covers over promising unlimited new ones.
