import { createHash } from 'node:crypto'

import { Effect } from 'effect'

import type { Library } from '../../contracts/library'

const artworkPath =
  /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{64})$/

export async function serveArtwork(
  library: typeof Library.Service,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  const match = artworkPath.exec(url.pathname)

  if (
    request.method !== 'GET' ||
    url.protocol !== 'local-music-artwork:' ||
    url.hostname !== 'cover' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    !match
  )
    return new Response(null, { status: 404 })

  const [, trackId, artworkId] = match

  try {
    const artwork = await Effect.runPromise(library.artwork(trackId))
    const digest = createHash('sha256').update(artwork.mimeType).update(artwork.bytes).digest('hex')

    if (digest !== artworkId) return new Response(null, { status: 404 })

    return new Response(new Blob([new Uint8Array(artwork.bytes)], { type: artwork.mimeType }), {
      headers: {
        'Content-Type': artwork.mimeType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
