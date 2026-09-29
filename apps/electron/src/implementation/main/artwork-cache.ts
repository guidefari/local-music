import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Effect, Layer, Semaphore } from 'effect'

import { ArtworkCache, LibraryFailure } from '@/contracts/library'

const maxImageBytes = 8 * 1024 * 1024

const maxCacheBytes = 512 * 1024 * 1024

const digestPattern = /^[a-f0-9]{64}$/

const allowedMimeTypes = new Set([
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

const cacheFailure = () => new LibraryFailure({ message: 'Could not read or save album artwork.' })

export const makeArtworkCache = Effect.fn('ArtworkCache.make')(function* (directory: string) {
  const admission = yield* Semaphore.make(1)

  const store = (cover: { readonly mimeType: string; readonly bytes: Uint8Array }) =>
    admission.withPermits(1)(
      Effect.tryPromise({
        try: async () => {
          if (
            !allowedMimeTypes.has(cover.mimeType) ||
            cover.bytes.length > maxImageBytes ||
            cover.bytes.length === 0
          )
            return null

          await mkdir(directory, { recursive: true })
          const id = createHash('sha256').update(cover.mimeType).update(cover.bytes).digest('hex')
          const path = join(directory, id)

          try {
            await stat(path)

            return id
          } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
              throw error
          }

          const files = await readdir(directory)
          let size = 0

          for (const file of files) {
            if (digestPattern.test(file)) size += (await stat(join(directory, file))).size
          }

          if (size + cover.bytes.length > maxCacheBytes) return null

          const temporary = join(directory, `${id}.${randomUUID()}.tmp`)

          try {
            await writeFile(temporary, cover.bytes, { flag: 'wx' })
            await rename(temporary, path)
          } finally {
            await rm(temporary, { force: true })
          }

          return id
        },
        catch: cacheFailure,
      }),
    )

  const read = (id: string) =>
    Effect.tryPromise({
      try: async () => {
        if (!digestPattern.test(id)) throw new Error('Invalid artwork ID')

        return new Uint8Array(await readFile(join(directory, id)))
      },
      catch: cacheFailure,
    })

  const prune = (referenced: ReadonlySet<string>) =>
    admission.withPermits(1)(
      Effect.tryPromise({
        try: async () => {
          await mkdir(directory, { recursive: true })

          for (const file of await readdir(directory)) {
            if (digestPattern.test(file) && !referenced.has(file)) await rm(join(directory, file))
            else if (file.endsWith('.tmp')) await rm(join(directory, file))
          }
        },
        catch: cacheFailure,
      }),
    )

  return ArtworkCache.of({ store, read, prune })
})

export const artworkCacheLayer = (directory: string) =>
  Layer.effect(ArtworkCache, makeArtworkCache(directory))
