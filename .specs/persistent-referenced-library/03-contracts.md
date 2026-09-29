# Contracts: Persistent Referenced Library

These are design contracts, not a schema approval or migration. Effect Schema owns parsed IDs, paths, rows, and IPC DTOs; Drizzle owns approved database fields and queries. No cast turns external input or persisted rows into a domain value.

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

The Drizzle proposal has `library_source(id, root_path UNIQUE, added_at, last_successful_scan_at)`, `track(id, source_id REFERENCES library_source, relative_path, observed_title, observed_artist, observed_album, duration_seconds, presence, last_seen_at, UNIQUE(source_id, relative_path))`, and disposable `scan_stage_path(scan_id, source_id, relative_path, read_state, observed_title?, observed_artist?, observed_album?, duration_seconds?, PRIMARY KEY(scan_id, source_id, relative_path))`. Database names are snake_case and TypeScript properties camelCase. No `artwork` table or migration is approved. Stage `observed` requires all metadata fields; stage `unreadable` requires none. Validate that invariant at the persistence boundary and, where practical, in a DB check constraint.

An absent path becomes missing only after successful enumeration of **that source**. An unreadable known path stays present and keeps its last good metadata. A newly unreadable path creates no track row. A successful observation upserts by source/path and preserves its app ID. Source registration is unique by `realpath` of a selected root. Other sources do not change when this one commits.

## Scanner and repository

```ts
type ScannedPath =
  | { readonly _tag: 'observed'; readonly relativePath: RelativePath; readonly title: string; readonly artist: string; readonly album: string; readonly durationSeconds: number }
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

interface Library {
  load(): Effect.Effect<LibrarySnapshot, StorageError | InvalidStoredLibrary>
  addChosenFolder(rootPath: string): Effect.Effect<LibrarySnapshot, StorageError>
  requestRescan(sourceId: SourceId): Effect.Effect<SourceScanState, ScanIncomplete | StorageError>
}
```

These interfaces mark authority boundaries, not a requirement for pass-through wrappers. Use `Schema.TaggedErrorClass` for typed errors. The scanner yields paths incrementally, fails on directory traversal, and treats a metadata read failure as an `unreadable` item. Its Effect Stream is consumed with `Stream.runForEach` to stage rows, never collected in production. Use `Stream.mapEffect(..., { concurrency: 4 })` for reads and preserve ownership of cancellation. `commitSource` checks one complete source pass and executes one Drizzle transaction. On error, discard staging; on crash, clear abandoned stages at startup. Do not hold the transaction during filesystem I/O.

## IPC

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

Preload and renderer decode replies and events; main parses the source ID and checks it belongs to a registered source. Renderer cannot supply arbitrary filesystem paths. The artwork lookup contract is deliberately deferred until its policy is settled. Existing transient `ScanResult`/`chooseFolder` semantics remain in the current POC until the persistent cutover, not alongside a second production path.

## Driver checkpoint

Drizzle `0.45.3` has no confirmed direct `node:sqlite` adapter in this project. Choose and test an Electron-compatible SQLite driver against a temporary database before authoring any schema or userData migration. A Bun-only driver cannot be assumed to run in Electron. Obtain explicit approval for proposed fields and constraints first.
