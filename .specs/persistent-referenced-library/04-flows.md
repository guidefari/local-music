# Flows: Persistent Referenced Library

## Startup

```text
Electron main -> open approved SQLite database -> clear abandoned scan stages
-> load parsed sources/tracks -> preload validated reply -> renderer Effect workflow
-> Solid renders saved metadata -> first paint -> enqueue each existing source separately
```

Enqueue only after the loaded view has had a paint opportunity; do not wait for covers. Each source has its own status and last successful scan time. Startup work is sequential/low priority and can be cancelled on app shutdown. No single all-library completion condition exists.

## Add one folder

```text
UI Add folder -> native dialog -> canonicalize chosen root in main
-> register/reuse source by unique root -> show snapshot
-> queue scan(sourceId) for only the selected source
-> Effect Stream walks that folder recursively, not other roots
-> bounded metadata reads -> cache admissible cover bytes under userData -> stage observed/unreadable paths and cached artwork references
-> complete traversal -> transaction reconciles only sourceId -> emit updated snapshot
```

Selecting the same source again reuses its ID and coalesces any pending/running scan. Adding a folder during another source's scan queues this source next. Manual Rescan takes a `sourceId`; it never implicitly selects all sources. Overlapping roots remain separate registered sources, with separate IDs.

## Source scan failure

The scanner's async directory iterator errors on an unreadable directory rather than treating it as empty. A failed filesystem traversal, interruption, stage write error, or database commit error leaves that source's prior track presence unchanged and never changes any other source. A file whose metadata cannot be read yields `unreadable`; it is still seen in a complete pass. A known unreadable track remains present with old metadata; a new unreadable path has no track row. Staging is disposable and cleared on restart. Do not log filenames, tags, or artwork bytes in failure summaries.

## Artwork and search

Current POC reads embedded cover data during a scan and sends data URLs in the in-memory snapshot. At persistence cutover, cache supported covers as content-addressed files under userData, with an 8 MiB per-image and proposed 512 MiB total cap. A complete source commit stores only artwork IDs/MIME types and `hasEmbeddedArtwork` in track rows. IPC loads a visible track's cached cover by validated track ID, so known missing tracks retain their cover. Do not evict an image referenced by any committed track. After commit or restart, prune unreferenced cache files; a failed scan may leave an orphan but never a partially written cover. If the cap is full of pinned covers, skip caching a new cover and report the miss; a present track can still load it read-only from the original file, but it is not guaranteed after that file disappears. Search/grouping remain renderer Effect projections over saved metadata, while Solid owns display signals.
