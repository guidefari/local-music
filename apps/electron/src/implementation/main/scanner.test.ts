import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { Effect, Schema, Stream } from 'effect'

import { LibrarySnapshot } from '../../contracts/library'
import { sourceScanner } from './scanner'

const folders: string[] = []

afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true })
})

test('scanner indexes an audio file in place', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'local-music-scan-'))
  folders.push(folder)
  const pcm = Buffer.alloc(44_100 * 2)
  const wav = Buffer.alloc(44 + pcm.length)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(44_100, 24)
  wav.writeUInt32LE(88_200, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(pcm.length, 40)
  pcm.copy(wav, 44)
  await writeFile(join(folder, 'Sample.wav'), wav)

  const observations = await Effect.runPromise(Stream.runCollect(sourceScanner.scan(folder)))
  assert.equal(observations.length, 1)
  assert.equal(observations[0]?.kind, 'observed')

  const first = observations[0]

  if (first?.kind !== 'observed') throw new Error('Expected observed audio')

  assert.equal(first.observation.path, 'Sample.wav')
  assert.equal(first.observation.title, 'Sample')
  assert.equal(first.observation.durationSeconds, 1)
})

test('scanner visits nested folders, counts unreadable audio, and does not follow symlinks', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'local-music-scan-'))
  folders.push(folder)
  await mkdir(join(folder, 'nested'))
  await writeFile(join(folder, 'nested', 'broken.MP3'), 'not audio')
  await symlink(join(folder, 'nested'), join(folder, 'linked'))

  const observations = await Effect.runPromise(Stream.runCollect(sourceScanner.scan(folder)))
  assert.equal(observations.length, 1)
  assert.deepEqual(observations[0], { kind: 'unreadable', path: join('nested', 'broken.MP3') })
})

test('scanner fails when the source cannot be traversed', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'local-music-scan-'))
  folders.push(folder)
  await rm(folder, { recursive: true })

  await assert.rejects(Effect.runPromise(Stream.runDrain(sourceScanner.scan(folder))))
})

test('library contract rejects malformed track data', () => {
  const decode = Schema.decodeUnknownResult(LibrarySnapshot)
  const result = decode({ sources: [], tracks: [{ title: 'Only a title' }] })
  assert.equal(result._tag, 'Failure')
})
