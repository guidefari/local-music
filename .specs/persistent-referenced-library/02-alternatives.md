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
| Read from original files on demand | No copied image bytes, simple storage, fresh cover when tags change | Missing/unreadable files have no cover; may require another read. Preferred if this is acceptable. |
| Bounded app-owned cache | Cover survives missing files and loads quickly | Copies artwork; needs a size limit and eviction rule. Needed if retained covers remain a requirement. |

Do not create an artwork table or cache until this product choice is confirmed. The core source/track identity model does not depend on it.
