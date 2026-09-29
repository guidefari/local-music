import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { Effect, Stream } from 'effect'

import { LibraryFailure, SourceScanner, type ScannedPath } from '../../contracts/library'
import { makeArtworkCache } from './artwork-cache'
import { openLibraryDatabase } from './db/open'
import { makeLibraryStore } from './db/store'
import { makeLibrary } from './library'

const directories: string[] = []

const migrations = join(process.cwd(), 'drizzle')

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true })
})

test('retains saved metadata and cached artwork when a later traversal fails or a file goes missing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'local-music-library-'))
  directories.push(directory)
  const sourcePath = join(directory, 'music')
  await mkdir(sourcePath)
  const database = await openLibraryDatabase(join(directory, 'library.db'), migrations)
  const store = makeLibraryStore(database.db)
  const cache = await Effect.runPromise(makeArtworkCache(join(directory, 'artwork')))
  const cover = { mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }

  const song: ScannedPath = {
    kind: 'observed',
    observation: {
      path: 'song.mp3',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      durationSeconds: 10,
      cover,
    },
  }

  let paths: ScannedPath[] = [song]
  let fail = false

  const scanner = SourceScanner.of({
    scan: () =>
      fail
        ? Stream.fail(new LibraryFailure({ message: 'Traversal incomplete' }))
        : Stream.fromIterable(paths),
  })

  const library = await Effect.runPromise(makeLibrary(store, scanner, cache))
  const first = await Effect.runPromise(library.addFolder(sourcePath))
  const id = first.tracks[0]?.id

  assert.ok(id)
  assert.deepEqual((await Effect.runPromise(library.artwork(id))).bytes, cover.bytes)

  fail = true
  await assert.rejects(Effect.runPromise(library.rescan(first.sources[0]?.id ?? '')))
  assert.deepEqual(await Effect.runPromise(library.load()), first)

  fail = false
  paths = []
  const missing = await Effect.runPromise(library.rescan(first.sources[0]?.id ?? ''))
  assert.equal(missing.tracks[0]?.id, id)
  assert.equal(missing.tracks[0]?.presence, 'missing')
  assert.deepEqual((await Effect.runPromise(library.artwork(id))).bytes, cover.bytes)

  database.close()
})
