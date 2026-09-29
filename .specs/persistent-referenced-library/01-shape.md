# Shape: Persistent Referenced Library

## Key Domain Concepts

```text
Library
  ├─ Registered source: a folder the user chose, not a copy of its contents
  │    └─ Observed tracks: stable app ID + current file path + last observed metadata
  └─ Artwork: deduplicated embedded image, referenced by observed tracks and loaded on demand
```

An **import** registers a source and reconciles one scanner result into durable observations. A **track ID** is assigned by the app when a file path is first observed; rescanning the same path in that source preserves the ID. A path that vanishes remains a missing track. Detecting whether a file at another path is the same track is deliberately postponed.

The library supports several registered sources now. Choosing another folder adds it; the library view includes all registered sources and their tracks. A repeated choice of the same folder does not create a duplicate. No source-removal operation is part of this slice.

## Proposed Persistent Data Model

This is the **shape for review**, not an approved migration. The next contracts layer will specify exact Effect schemas, Drizzle definitions, constraints, and transitions. Database names use snake_case; TypeScript properties use camelCase.

| Record | Fields | Identity and purpose |
| --- | --- | --- |
| `library_source` | `id`, `root_path`, `added_at`, `last_successful_scan_at` | App-assigned source ID; unique normalized absolute root path. Choosing an existing root reuses the same source. |
| `track` | `id`, `source_id`, `relative_path`, `observed_title`, `observed_artist`, `observed_album`, `duration_seconds`, `artwork_id`, `presence`, `last_seen_at` | App-assigned stable track ID. Unique `(source_id, relative_path)` preserves identity across rescans at the same location. Embedded metadata is an observation, not an app edit. `presence` is `present` or `missing`; a missing track remains in the library. |
| `artwork` | `id`, `mime_type`, `bytes` | Content digest ID and one stored copy of the embedded image. Many tracks may reference it; missing tracks keep their cover. |

```text
library_source 1 ── * track * ── 0..1 artwork
                         ↑
               future playlist_entry.track_id
```

The absolute playback path is constructed from the source root and a validated relative path. A source folder may move, but relinking it is a later behavior. A track at a new relative path is a new identity until move reconciliation is designed. `last_seen_at` is updated only when a whole-library pass commits successfully.

Incremental scan results need **staging records** keyed by scan ID, separate from these committed library records. Staged paths record every enumerated audio file, including files whose metadata could not be read; successful observations separately carry metadata and artwork. A pass either reconciles all registered sources and commits a new snapshot, or discards its staging data. An unreadable known file is still present and keeps its last good metadata and cover. We will pin down staging tables, diagnostic shapes, and crash cleanup in the contracts and flows layers.

There are deliberately no playlist or override tables in this slice. The stable `track.id` is the reference future `playlist_entry`, track notes, tags, and displayed-metadata overrides will use. Import never copies audio or rewrites embedded tags.

## Boundaries and Seams

```text
Solid view (signals, input, rendering)
    ↓ invokes / displays
Renderer Effect workflow (load, import, rescan, search projection, typed UI state)
    ↓ typed preload interface; decode on receipt
Electron IPC adapter
    ↓ parses requests and projects responses
Main Effect library module (source registration + scan reconciliation)
    ├─ scanner adapter: Rust process -> validated observations and artwork
    └─ persistence adapter: Drizzle + node:sqlite -> parsed library records
```

- **Renderer seam:** Solid owns ephemeral input and render state. Effect owns async calls, expected failures, import/rescan orchestration, and library transformations. The event handler runs the Effect program and projects its result into Solid signals. No Drizzle, filesystem access, or independent library rules live in Solid components.
- **IPC seam:** Preload exposes only library operations, not an arbitrary channel or a database connection. Incoming values are parsed on both sides of the runtime hop; transport shapes are not persisted rows.
- **Scanner seam:** The headless Rust scanner in `crates/scanner` remains read-only and recursive, with symlinks not followed. Its current versioned MessagePack response transports artwork as bytes, but is still a single buffered snapshot with a 30-second timeout. It cannot provide bounded streaming or reliable coverage for larger libraries. The next process protocol must expose incremental observations, artwork, traversal failures, and a final completion signal; main validates each message before staging it.
- **Persistence seam:** Main opens one SQLite database under Electron `userData`. Drizzle owns its schema, generated migrations, queries, and transactions. The library module sees parsed records through its repository capability, not Drizzle rows. The Node-compatible Drizzle driver must be smoke-tested in Electron before schema implementation.

## High-Level Flow

1. Launch Electron, open the main-owned database, apply approved migrations, and load the last committed library snapshot.
2. The renderer runs an Effect load workflow and displays the snapshot immediately. After important UI loading completes, it signals readiness; main queues one low-priority rescan job. A manual Rescan request can start the same job earlier, not a second concurrent pass.
3. The user can also choose another folder. The native picker returns a path to main; main registers the source without replacing existing sources.
4. The scan job walks every registered source recursively and reads audio files through a bounded worker pool. It stages validated observations and artwork without replacing the committed snapshot mid-pass.
5. A complete library pass means every registered source was fully enumerated, every queued file was accounted for, and the scanner sent its final completion signal. A metadata read error is reported for an enumerated path; a traversal failure makes the pass incomplete.
6. On completion, a database transaction reconciles staged observations by source and path, retaining IDs, deduplicating artwork, and marking previously known but unobserved paths missing. If the pass fails or is cancelled, discard staged changes and retain the last committed snapshot.
7. Main returns or publishes a fresh metadata-only library projection. The renderer's Effect workflow decodes it and updates Solid state. Covers are loaded by artwork ID on demand, not embedded in the whole-library reply. Search uses the loaded track metadata locally for this slice.

## Key Decisions

- **Reference, do not copy:** Audio files and embedded tags remain external. The app owns observations, artwork cache, and future user edits.
- **Snapshot plus lazy rescan:** The last committed snapshot appears first. A single rescan starts after the important UI work has finished, or sooner if requested manually. The UI shows last-scan time and scan state. There is no timer-based polling.
- **Stable ID by observed location:** This preserves identity across ordinary rescans without pretending to solve file moves or duplicates. A changed path is a new track until a later reconciliation feature says otherwise.
- **Several sources:** Choosing a new folder does not delete existing sources or their track IDs. The UI shows registered folders; removal and overlap resolution wait.
- **Bounded scanning:** One library-wide scan job at a time, one recursive directory walk feeding a bounded queue (for example, 64 paths), and at most four concurrent metadata/artwork readers across the library. The scanner must drain results as it reads instead of holding an unbounded list of artwork in memory. These limits are initial defaults to measure, not user-facing settings.
- **Artwork stored once per cover:** Persist a deduplicated binary image keyed by a digest of MIME type and bytes, rather than repeating data URLs in every track row. The renderer requests a cover by ID and converts the validated binary response to an image source; this preserves the current cover UI without sending every cover on each library load.
- **No event log:** Import and rescan are commands; transaction commit defines durable state. Bounded scan progress and the final committed snapshot can be sent to the renderer, but are not replayable domain events.
- **No raw application SQL:** Drizzle defines and reads the database. Generated migration files are reviewed and applied only after schema approval.

## Risks

- The scanner's current one-shot MessagePack output can still exceed its timeout or 64 MiB buffer. Binary artwork removes base64 overhead at the Rust-to-Electron hop, but bounded concurrency alone does not bound output memory; extending the protocol to incremental frames and staging results is part of this slice.
- Its current `skipped` count combines unreadable files and traversal errors. The new protocol must distinguish an enumerated unreadable file from a subtree that was never enumerated. An incomplete pass leaves the previous snapshot intact.
- Synchronous SQLite writes in Electron main can still cause visible pauses when a large staged scan commits. Measure with a representative folder and move database work to a worker only if necessary.
- A path can be reused for different audio later; path matching alone would retain an old ID. Detecting replacement requires an explicit policy in the contracts layer.
- The current `coverId` is produced from an in-memory hash. Its collision and cross-version stability need checking before it becomes a durable database key; a content digest at the persistence seam is safer.
- Adding sources from nested folders may show the same physical file twice. This slice does not merge overlapping sources or infer cross-source identity.
