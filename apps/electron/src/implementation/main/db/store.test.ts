import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { Effect } from 'effect'

import { openLibraryDatabase } from './open'
import { makeLibraryStore } from './store'

const directories: string[] = []

const migrations = join(process.cwd(), 'drizzle')

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true })
})

test('loads registered sources and tracks after reopening without a rescan', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'local-music-store-'))
  directories.push(directory)
  const path = join(directory, 'library.db')
  let database = await openLibraryDatabase(path, migrations)
  const store = makeLibraryStore(database.db)
  const source = await Effect.runPromise(store.register(join(directory, 'music')))
  await Effect.runPromise(store.begin(source.id, 'one'))
  await Effect.runPromise(
    store.stage(
      source.id,
      'one',
      {
        kind: 'observed',
        observation: {
          path: 'album/song.mp3',
          title: 'Song',
          artist: 'Artist',
          album: 'Album',
          durationSeconds: 42,
          cover: null,
        },
      },
      null,
      null,
    ),
  )
  const saved = await Effect.runPromise(store.commit(source.id, 'one', 123))
  assert.equal(saved.tracks.length, 1)
  database.close()

  database = await openLibraryDatabase(path, migrations)
  const reopened = await Effect.runPromise(makeLibraryStore(database.db).load())
  assert.equal(reopened.sources[0]?.id, source.id)
  assert.equal(reopened.tracks[0]?.id, saved.tracks[0]?.id)
  assert.equal(reopened.tracks[0]?.presence, 'present')
  database.close()
})

test('reconciles only the scanned source and keeps unreadable known tracks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'local-music-store-'))
  directories.push(directory)
  const database = await openLibraryDatabase(join(directory, 'library.db'), migrations)
  const store = makeLibraryStore(database.db)
  const a = await Effect.runPromise(store.register(join(directory, 'a')))
  const b = await Effect.runPromise(store.register(join(directory, 'b')))

  const observed = (path: string) => ({
    kind: 'observed' as const,
    observation: {
      path,
      title: path,
      artist: 'Artist',
      album: 'Album',
      durationSeconds: 42,
      cover: null,
    },
  })

  for (const source of [a, b]) {
    await Effect.runPromise(store.begin(source.id, 'first'))
    await Effect.runPromise(store.stage(source.id, 'first', observed('known.mp3'), null, null))
    await Effect.runPromise(store.commit(source.id, 'first', 100))
  }

  const first = await Effect.runPromise(store.load())
  await Effect.runPromise(store.begin(a.id, 'failed'))
  await Effect.runPromise(store.discard(a.id, 'failed'))
  assert.deepEqual(await Effect.runPromise(store.load()), first)

  await Effect.runPromise(store.begin(a.id, 'second'))
  await Effect.runPromise(
    store.stage(a.id, 'second', { kind: 'unreadable', path: 'known.mp3' }, null, null),
  )
  const unreadable = await Effect.runPromise(store.commit(a.id, 'second', 200))
  assert.equal(
    unreadable.tracks.find((track) => track.sourceId === a.id)?.id,
    first.tracks.find((track) => track.sourceId === a.id)?.id,
  )
  assert.equal(
    unreadable.tracks.every((track) => track.presence === 'present'),
    true,
  )

  await Effect.runPromise(store.begin(a.id, 'third'))
  const missing = await Effect.runPromise(store.commit(a.id, 'third', 300))
  assert.equal(missing.tracks.find((track) => track.sourceId === a.id)?.presence, 'missing')
  assert.equal(missing.tracks.find((track) => track.sourceId === b.id)?.presence, 'present')
  database.close()
})
