# Contracts: Persistent Referenced Library

These are the approved design contracts. The initial Drizzle schema and migration now exist. Effect Schema owns parsed IPC DTOs and library snapshots; Drizzle owns database fields and queries. The implementation and this design record may differ in unimplemented details noted below.

## Durable records

```ts
type SourceId = string // schema-refined nonempty app ID
type TrackId = string  // schema-refined nonempty app ID, never a path
type ScanId = string   // disposable pass identity
type RelativePath = string // schema-refined: nonempty, not absolute, cannot escape source

interface LibrarySource {
  readonly id: SourceId
  readonly rootPath: string // canonical absolute path, chosen by native dialog
  readonly addedAt: number // Unix milliseconds
  readonly lastSuccessfulScanAt: number | null
}

interface LibraryTrack {
  readonly id: TrackId
  readonly sourceId: SourceId
  readonly relativePath: RelativePath
  readonly title: string
  readonly artist: string
  readonly album: string
  readonly durationSeconds: number // finite, nonnegative integer
  readonly hasEmbeddedArtwork: boolean // permits live fallback when a cover was not cached
  readonly artworkId: string | null // validated content digest, only if admitted to cache
  readonly artworkMimeType: string | null // paired with artworkId
  readonly presence: 'present' | 'missing'
  readonly lastSeenAt: number
}

type SourceScanState =
  | { readonly _tag: 'idle'; readonly sourceId: SourceId; readonly lastSuccessfulScanAt: number | null }
  | { readonly _tag: 'running'; readonly sourceId: SourceId; readonly processed: number; readonly unreadable: number }
  | { readonly _tag: 'failed'; readonly sourceId: SourceId; readonly reason: string; readonly lastSuccessfulScanAt: number | null }

interface LibrarySnapshot {
  readonly sources: ReadonlyArray<LibrarySource>
  readonly tracks: ReadonlyArray<LibraryTrack>
  readonly scans: ReadonlyArray<SourceScanState>
}
```

The approved Drizzle schema has `library_source(id, root_path UNIQUE, added_at, last_successful_scan_at)`, `track(id, source_id REFERENCES library_source, relative_path, observed_title, observed_artist, observed_album, duration_seconds, has_embedded_artwork, artwork_id?, artwork_mime_type?, presence, last_seen_at, UNIQUE(source_id, relative_path))`, and disposable `scan_stage_path(scan_id, source_id, relative_path, read_state, observed_title?, observed_artist?, observed_album?, duration_seconds?, has_embedded_artwork?, artwork_id?, artwork_mime_type?, PRIMARY KEY(scan_id, source_id, relative_path))`. Database names are snake_case and TypeScript properties camelCase. Artwork ID and MIME must be both null or both non-null; cached artwork implies `hasEmbeddedArtwork`. No SQLite artwork blob table is proposed. Stage `observed` requires metadata fields; stage `unreadable` requires none. Validate at the persistence boundary and, where practical, with DB check constraints.

An absent path becomes missing only after successful enumeration of **that source**. An unreadable known path stays present and keeps its last good metadata. A newly unreadable path creates no track row. A successful observation upserts by source/path and preserves its app ID. Source registration is unique by `realpath` of a selected root. Other sources do not change when this one commits.

## Scanner and repository

```ts
type ScannedPath =
  | { readonly _tag: 'observed'; readonly relativePath: RelativePath; readonly title: string; readonly artist: string; readonly album: string; readonly durationSeconds: number; readonly cover: { readonly mimeType: string; readonly bytes: Uint8Array } | null }
  | { readonly _tag: 'unreadable'; readonly relativePath: RelativePath }

interface SourceScanner {
  scan(source: LibrarySource): Stream.Stream<ScannedPath, ScanIncomplete>
}

interface LibraryRepository {
  load(): Effect.Effect<LibrarySnapshot, StorageError | InvalidStoredLibrary>
  registerSource(rootPath: string): Effect.Effect<LibrarySource, StorageError>
  beginStage(sourceId: SourceId, scanId: ScanId): Effect.Effect<void, StorageError>
  append(sourceId: SourceId, scanId: ScanId, item: ScannedPath): Effect.Effect<void, StorageError>
  commitSource(sourceId: SourceId, scanId: ScanId, completedAt: number): Effect.Effect<LibrarySnapshot, StorageError>
  discardStage(sourceId: SourceId, scanId: ScanId): Effect.Effect<void, StorageError>
}

interface ArtworkCache {
  store(image: { readonly mimeType: string; readonly bytes: Uint8Array }): Effect.Effect<
    { readonly _tag: 'cached'; readonly id: string } | { readonly _tag: 'full' },
    StorageError
  >
  read(id: string): Effect.Effect<Uint8Array, StorageError>
  pruneUnreferenced(referencedIds: ReadonlySet<string>): Effect.Effect<void, StorageError>
}

interface Library {
  load(): Effect.Effect<LibrarySnapshot, StorageError | InvalidStoredLibrary>
  addChosenFolder(rootPath: string): Effect.Effect<LibrarySnapshot, StorageError>
  requestRescan(sourceId: SourceId): Effect.Effect<SourceScanState, ScanIncomplete | StorageError>
}
```

These interfaces mark authority boundaries, not a requirement for pass-through wrappers. Use `Schema.TaggedErrorClass` for typed errors. The scanner yields paths incrementally, fails on directory traversal, and treats a metadata read failure as an `unreadable` item. Its Effect Stream is consumed with `Stream.runForEach` to stage rows, never collected in production. Use `Stream.mapEffect(..., { concurrency: 4 })` for reads and preserve ownership of cancellation. `commitSource` checks one complete source pass and executes one Drizzle transaction. On error, discard staging; on crash, clear abandoned stages at startup. Do not hold the transaction during filesystem I/O.

The cache stores only validated MIME types and at most 8 MiB per image. Digest includes MIME type and bytes; write to a temporary file and atomically rename to `<digest>` so a crash never exposes half an image. Proposed total cap is 512 MiB. Serialize admission/accounting so four concurrent readers cannot overfill it. Committed track references are pinned, including missing tracks; reclaim only unreferenced files, and do so before starting a scan and after a successful commit. If the cap cannot admit a new cover, stage null artwork fields for that observation and report a cache miss. A missing/unreadable known track keeps its prior cover ID. Track updates that remove a cover make the old file eligible for later pruning. Read paths derive solely from validated digest IDs under userData, never from renderer-supplied paths. A missing/corrupt cache file is a typed fallback, not a reason to delete a track.

## IPC and artwork delivery

```ts
type LibraryReply<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: string }
  | { readonly ok: false; readonly cancelled: true }

interface LocalMusicBridge {
  loadLibrary(): Promise<LibraryReply<LibrarySnapshot>>
  chooseFolder(): Promise<LibraryReply<LibrarySnapshot>>
  rescan(sourceId: SourceId): Promise<LibraryReply<SourceScanState>>
  onLibraryChanged(listener: (snapshot: LibrarySnapshot) => void): () => void
  onScanState(listener: (state: SourceScanState) => void): () => void
  readonly isDevelopment: boolean
}
```

Preload and renderer decode replies and events. Artwork uses the narrow `local-music-artwork://cover/<track-id>/<artwork-digest>` Electron protocol instead of IPC or data/blob URLs. Main validates the URL, resolves the saved track, verifies its cached bytes against the digest, and serves the binary image with its saved MIME type. Renderer cannot supply filesystem paths. Missing or corrupt covers fall back to the placeholder. The protocol is registered before app readiness and allowed only for images by the renderer CSP; it does not bypass CSP. Uncached cover fallback to the original file is not implemented.

## Driver checkpoint

The approved Drizzle `0.45.3` schema uses `@libsql/client` with a local file URL. Its migration and query were tested in Electron against a temporary database before wiring app data. The npm default release of `@effect/sql-sqlite-node` targets Effect v3, while its `4.0.0-rc.118` release matches this app; it uses native `better-sqlite3` and is not a Drizzle adapter. Drizzle's `effect-schema` guide generates validators from tables but the pinned Drizzle version does not export that integration. Effect owns scanner and library workflows, while Drizzle/libSQL owns storage. A later driver or Drizzle upgrade is a separate decision.
