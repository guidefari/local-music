# Contracts: Persistent Referenced Library

These are implementation-target TypeScript/Rust sketches, not an approved database migration. Electron main owns SQLite, process supervision, and source selection. Shared Effect schemas own runtime-hop shapes. No renderer value exposes Drizzle rows or a database handle.

## Domain and durable rows

```ts
// apps/electron/src/shared/library-contract.ts, Effect Schema definitions
type SourceId = string // nonempty app-generated ID, parsed at every boundary
type TrackId = string  // distinct from a path
type ArtworkId = string // lowercase SHA-256 of MIME + separator + bytes
type ScanId = string
type AbsolutePath = string // normalized absolute path, never accepted directly from renderer
type RelativePath = string // nonempty, within the source root, never absolute or escaping

type LibrarySource = {
  readonly id: SourceId
  readonly rootPath: AbsolutePath
  readonly addedAt: number // Unix milliseconds
  readonly lastSuccessfulScanAt: number | null
}

type LibraryTrack = {
  readonly id: TrackId
  readonly sourceId: SourceId
  readonly relativePath: RelativePath
  readonly title: string
  readonly artist: string
  readonly album: string
  readonly durationSeconds: number // finite, nonnegative integer
  readonly artworkId: ArtworkId | null
  readonly presence: 'present' | 'missing'
  readonly lastSeenAt: number // most recent complete pass that observed the path
}

type LibrarySnapshot = {
  readonly sources: ReadonlyArray<LibrarySource>
  readonly tracks: ReadonlyArray<LibraryTrack>
  readonly scan: ScanState
}

type ScanState =
  | { readonly _tag: 'idle'; readonly lastSuccessfulScanAt: number | null }
  | { readonly _tag: 'running'; readonly scanId: ScanId; readonly processed: number; readonly unreadable: number }
  | { readonly _tag: 'failed'; readonly reason: string; readonly lastSuccessfulScanAt: number | null }
```

Implement the IDs, paths, timestamps, and state as Effect schemas/refinements, not bare aliases or casts. A `LibraryTrack` exists only after at least one successful metadata read; an unreadable new file yields a diagnostic, not an invented track. A known unreadable path stays `present` with its last good title, duration, and artwork. Missing tracks keep their metadata and artwork reference. A successful read updates observations; an absent path becomes `missing` only on a complete pass. A file reappearing at the same path keeps its ID. Replacement at that path also keeps the ID in this slice; fingerprint-based replacement policy is deferred and must be reconsidered before user edits depend on that identity.

The proposed Drizzle SQLite schema uses camelCase TypeScript property names and snake_case database names:

```ts
librarySource: {
  id: text('id').primaryKey(),
  rootPath: text('root_path').notNull().unique(),
  addedAt: integer('added_at').notNull(),
  lastSuccessfulScanAt: integer('last_successful_scan_at'),
}
track: {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => librarySource.id),
  relativePath: text('relative_path').notNull(),
  observedTitle: text('observed_title').notNull(),
  observedArtist: text('observed_artist').notNull(),
  observedAlbum: text('observed_album').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  artworkId: text('artwork_id').references(() => artwork.id),
  presence: text('presence').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  // unique(sourceId, relativePath); index(sourceId, presence)
}
artwork: {
  id: text('id').primaryKey(),
  mimeType: text('mime_type').notNull(),
  bytes: blob('bytes').notNull(),
}
scanStagePath: {
  scanId: text('scan_id').notNull(),
  sourceId: text('source_id').notNull(),
  relativePath: text('relative_path').notNull(),
  readState: text('read_state').notNull(), // 'observed' | 'unreadable'
  observedTitle: text('observed_title'),
  observedArtist: text('observed_artist'),
  observedAlbum: text('observed_album'),
  durationSeconds: integer('duration_seconds'),
  artworkId: text('artwork_id'),
  // primary key(scanId, sourceId, relativePath); all observed fields present together
}
scanStageArtwork: {
  scanId: text('scan_id').notNull(),
  artworkId: text('artwork_id').notNull(),
  mimeType: text('mime_type').notNull(),
  bytes: blob('bytes').notNull(),
  // primary key(scanId, artworkId)
}
```

Staging is disposable, not an event log. Only one scan job is active. At startup, delete abandoned staging rows before starting the next scan, leaving committed rows unchanged. The library projection parses stored rows into domain values and rejects corrupt/contradictory rows rather than casting them. Set foreign keys on; retain artwork while a committed track references it. Orphan collection is optional and cannot run during an incomplete pass. `lastSuccessfulScanAt` advances for all participating sources in the same reconciliation transaction.

## Scanner protocol, version 2

One Rust process per source, sequentially within the single library job. Every stdout frame is a big-endian `u32` byte length followed by one MessagePack map. Frame size has a bounded maximum (proposed 9 MiB to allow the existing 8 MiB artwork cap); unknown versions, kinds, duplicate terminal frames, paths escaping the selected root, and malformed frames fail the pass. No logs or incidental output go to stdout.

```ts
type ScanFrame =
  | { readonly version: 2; readonly kind: 'artwork'; readonly scannerId: string; readonly mimeType: string; readonly bytes: Uint8Array }
  | { readonly version: 2; readonly kind: 'observed'; readonly relativePath: RelativePath; readonly title: string; readonly artist: string; readonly album: string; readonly durationSeconds: number; readonly scannerArtworkId: string | null }
  | { readonly version: 2; readonly kind: 'unreadable'; readonly relativePath: RelativePath }
  | { readonly version: 2; readonly kind: 'traversalFailure'; readonly relativePath: RelativePath | null }
  | { readonly version: 2; readonly kind: 'complete'; readonly enumerated: number; readonly observed: number; readonly unreadable: number; readonly traversalFailures: number }
```

The scanner emits artwork before an observation references its scanner-local ID. Main computes and checks the durable digest of MIME and bytes and maps the scanner ID only for this process. It stages an observed path or an unreadable path exactly once. Rust's producer has a bounded 64-path work queue, at most four active metadata readers in the whole job, and one blocking frame writer with backpressure. Directory traversal errors emit `traversalFailure`; the final `complete` comes only after traversal and all queued reads finish. A `complete` with traversal failures is diagnostic but **not** eligible for reconciliation. Clean process exit without `complete`, early `complete`, count mismatch, malformed bytes, and source root errors are incomplete. Invalid UTF-8 paths must not be silently lossily converted into identity; fail the pass rather than risk marking a known track missing. Symlinks are not followed. No complete scan requires keeping all tracks or covers in memory.

## Application interfaces and errors

```ts
type LibraryError =
  | { readonly _tag: 'StorageUnavailable'; readonly message: string }
  | { readonly _tag: 'InvalidStoredLibrary'; readonly message: string }
  | { readonly _tag: 'SourceUnavailable'; readonly sourceId: SourceId; readonly message: string }
  | { readonly _tag: 'ScanIncomplete'; readonly message: string }
  | { readonly _tag: 'ScannerProtocolFailed'; readonly message: string }
  | { readonly _tag: 'ArtworkNotFound'; readonly artworkId: ArtworkId }

interface LibraryRepository {
  load(): Effect.Effect<LibrarySnapshot, LibraryError>
  registerSource(rootPath: AbsolutePath): Effect.Effect<LibrarySource, LibraryError>
  beginStage(scanId: ScanId): Effect.Effect<void, LibraryError>
  append(scanId: ScanId, sourceId: SourceId, observation: StagedObservation): Effect.Effect<void, LibraryError>
  commitComplete(scanId: ScanId, sourceIds: ReadonlyArray<SourceId>, completedAt: number): Effect.Effect<LibrarySnapshot, LibraryError>
  discardStage(scanId: ScanId): Effect.Effect<void, LibraryError>
  getArtwork(id: ArtworkId): Effect.Effect<{ readonly mimeType: string; readonly bytes: Uint8Array }, LibraryError>
}

type StagedObservation =
  | { readonly _tag: 'artwork'; readonly id: ArtworkId; readonly mimeType: string; readonly bytes: Uint8Array }
  | { readonly _tag: 'observed'; readonly relativePath: RelativePath; readonly title: string; readonly artist: string; readonly album: string; readonly durationSeconds: number; readonly artworkId: ArtworkId | null }
  | { readonly _tag: 'unreadable'; readonly relativePath: RelativePath }

interface Library {
  load(): Effect.Effect<LibrarySnapshot, LibraryError>
  addChosenFolder(rootPath: AbsolutePath): Effect.Effect<LibrarySnapshot, LibraryError>
  requestRescan(): Effect.Effect<ScanState, LibraryError>
  artwork(id: ArtworkId): Effect.Effect<{ readonly mimeType: string; readonly bytes: Uint8Array }, LibraryError>
}
```

These are capability sketches, not an instruction to add both interfaces if one module can own the workflow directly. `LibraryRepository.append` accepts only validated, normalized observations; transport frames are translated at the scanner adapter. The scan coordinator owns the one-job rule, source-list snapshot, cancellation, and error reporting. A folder added during a pass is registered immediately and queues a follow-up pass rather than being included in an already-started pass. Repeated manual rescan during a running pass coalesces; it does not spawn another process.

## IPC and renderer

```ts
type LibraryRequest =
  | { readonly operation: 'load' }
  | { readonly operation: 'chooseFolder' }
  | { readonly operation: 'rescan' }
  | { readonly operation: 'artwork'; readonly id: ArtworkId }

type LibraryReply<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: string }
  | { readonly ok: false; readonly cancelled: true }

interface LocalMusicBridge {
  loadLibrary(): Promise<LibraryReply<LibrarySnapshot>>
  chooseFolder(): Promise<LibraryReply<LibrarySnapshot>>
  rescan(): Promise<LibraryReply<ScanState>>
  getArtwork(id: ArtworkId): Promise<LibraryReply<{ readonly mimeType: string; readonly bytes: Uint8Array }>>
  onLibraryChanged(listener: (snapshot: LibrarySnapshot) => void): () => void
  onScanState(listener: (state: ScanState) => void): () => void
  readonly isDevelopment: boolean
}
```

IPC channels remain fixed, not arbitrary. Main parses the artwork ID and every request; preload and the renderer's Effect workflow decode all replies and notifications. Unsubscribe on component cleanup; reject events from windows that are gone. Do not send an entire image collection in `LibrarySnapshot`; get one cover at a time and cache per ID in the renderer. Convert validated bytes to an object URL or data URL in the renderer, and release object URLs on cleanup. Source roots originate only from the native dialog, not renderer-provided paths. Search and grouping are pure projections in the renderer Effect workflow over the loaded metadata snapshot; Solid signals only hold the displayed state. The renderer reports readiness after first painted saved snapshot, then calls the rescan command; on an empty library it can do so after first paint without scanning any sources.

## Driver checkpoint and approval boundary

Drizzle `0.45.3` does not expose a confirmed direct `node:sqlite` adapter in this repo. Before implementing the schema, select a Node/Electron-compatible SQLite driver, verify it opens a throwaway local database inside the actual Electron runtime, then choose the matching Drizzle adapter and migration runner. A native driver may need Electron ABI rebuilding; do not assume a Bun-only SQLite adapter will work in Electron. No real `userData` database, schema, or migration is created until the user explicitly approves the proposed fields and constraints.
