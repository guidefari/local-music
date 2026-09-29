import { createHash } from 'node:crypto'
import { opendir } from 'node:fs/promises'
import { extname, join, parse, relative } from 'node:path'

import { Effect, Result, Schema, Stream } from 'effect'
import { parseFile, selectCover } from 'music-metadata'

import { LibraryFailure, SourceScanner, type ScanResult, type Track } from '../../contracts/library'

const audioExtensions = new Set(['.mp3', '.m4a', '.flac', '.wav', '.aiff', '.aif', '.ogg', '.opus'])

const imageTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/ico',
  'image/x-portable-anymap',
])

const imageAliases = new Map([
  ['image/jpg', 'image/jpeg'],
  ['image/tif', 'image/tiff'],
])

export class ScanFailed extends Schema.TaggedError<ScanFailed>()('ScanFailed', {
  message: Schema.String,
}) {}

async function* audioFiles(root: string): AsyncGenerator<string> {
  const directories = [root]

  while (directories.length > 0) {
    const directory = directories.pop()

    if (directory === undefined) break

    for await (const entry of await opendir(directory)) {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) directories.push(path)
      else if (entry.isFile() && audioExtensions.has(extname(entry.name).toLowerCase())) yield path
    }
  }
}

const readTrack = Effect.fn('Scanner.readTrack')(function* (path: string) {
  const metadata = yield* Effect.tryPromise({
    try: () => parseFile(path),
    catch: () => new ScanFailed({ message: 'The audio file could not be read.' }),
  })

  if (metadata.format.hasAudio === false) {
    return yield* new ScanFailed({ message: 'The audio file has no readable audio stream.' })
  }

  const picture = selectCover(metadata.common.picture)
  const mimeType = picture ? (imageAliases.get(picture.format) ?? picture.format) : null

  const cover =
    picture && mimeType && picture.data.length <= 8 * 1024 * 1024 && imageTypes.has(mimeType)
      ? { picture, mimeType }
      : null

  const coverId = cover
    ? createHash('sha256').update(cover.mimeType).update(cover.picture.data).digest('hex')
    : null

  const seconds = metadata.format.duration ?? 0

  const track: Track = {
    path,
    title: metadata.common.title ?? parse(path).name,
    artist: metadata.common.artist ?? 'Unknown artist',
    album: metadata.common.album ?? 'Unknown album',
    durationSeconds: Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0,
    coverId,
  }

  return {
    track,
    cover:
      cover && coverId
        ? {
            id: coverId,
            mimeType: cover.mimeType,
            bytes: cover.picture.data,
          }
        : null,
  }
})

export const scanFolderStream = (folder: string) =>
  Stream.fromAsyncIterable(
    audioFiles(folder),
    () => new ScanFailed({ message: 'The music folder could not be fully traversed.' }),
  ).pipe(
    Stream.mapEffect(
      (path) =>
        readTrack(path).pipe(
          Effect.result,
          Effect.map((result) => ({ path, result })),
        ),
      { concurrency: 4 },
    ),
  )

export const scanFolder = Effect.fn('Scanner.scanFolder')(function* (folder: string) {
  const tracks: Track[] = []
  const covers: Record<string, string> = {}
  let skipped = 0

  yield* scanFolderStream(folder).pipe(
    Stream.runForEach(({ result }) =>
      Effect.sync(() =>
        Result.match(result, {
          onFailure: () => {
            skipped += 1
          },
          onSuccess: ({ track, cover }) => {
            tracks.push(track)

            if (cover)
              covers[cover.id] =
                `data:${cover.mimeType};base64,${Buffer.from(cover.bytes).toString('base64')}`
          },
        }),
      ),
    ),
  )

  tracks.sort(
    (a, b) =>
      a.artist.localeCompare(b.artist) ||
      a.album.localeCompare(b.album) ||
      a.title.localeCompare(b.title),
  )

  return { tracks, covers, skipped } satisfies ScanResult
})

export const sourceScanner = SourceScanner.of({
  scan: (root) =>
    scanFolderStream(root).pipe(
      Stream.map(({ path, result }) =>
        Result.match(result, {
          onFailure: () => ({ kind: 'unreadable' as const, path: relative(root, path) }),
          onSuccess: ({ track, cover }) => ({
            kind: 'observed' as const,
            observation: {
              path: relative(root, path),
              title: track.title,
              artist: track.artist,
              album: track.album,
              durationSeconds: track.durationSeconds,
              cover: cover ? { mimeType: cover.mimeType, bytes: cover.bytes } : null,
            },
          }),
        }),
      ),
      Stream.mapError(
        () => new LibraryFailure({ message: 'The music folder could not be fully traversed.' }),
      ),
    ),
})
