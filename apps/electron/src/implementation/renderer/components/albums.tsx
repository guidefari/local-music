import { For, createMemo } from 'solid-js'

import type { LibraryTrack } from '@/contracts/library'
import { Cover } from '@/implementation/renderer/components/cover'

/** Summarizes albums and starts playback from their first available track. */
export function Albums(props: {
  tracks: ReadonlyArray<LibraryTrack>
  onPlay: (track: LibraryTrack) => void
}) {
  const albums = createMemo(() => {
    const found = new Map<
      string,
      {
        artist: string
        title: string
        count: number
        firstTrack: LibraryTrack
        coverTrackId: string | null
        artworkId: string | null
      }
    >()

    for (const track of props.tracks) {
      const key = `${track.artist}\0${track.album}`
      const album = found.get(key)

      if (album) {
        album.count++

        if (album.firstTrack.presence === 'missing' && track.presence === 'present') {
          album.firstTrack = track
        }

        if (!album.artworkId && track.artworkId) {
          album.coverTrackId = track.id
          album.artworkId = track.artworkId
        }
      } else {
        found.set(key, {
          artist: track.artist,
          title: track.album,
          count: 1,
          firstTrack: track,
          coverTrackId: track.artworkId ? track.id : null,
          artworkId: track.artworkId,
        })
      }
    }

    return found
  })

  return (
    <section class="album-section" aria-labelledby="albums-title">
      <div class="section-heading">
        <h2 id="albums-title">Albums in rotation</h2>
        <span>{albums().size} in your library</span>
      </div>
      <div class="album-shelf">
        <For each={[...albums().values()].slice(0, 6)}>
          {(album) => (
            <button
              class="album-card"
              type="button"
              onClick={() => props.onPlay(album.firstTrack)}
              disabled={album.firstTrack.presence === 'missing'}
            >
              <span class="album-art">
                <Cover trackId={album.coverTrackId} artworkId={album.artworkId} size="large" />
                <span class="album-play" aria-hidden="true">
                  ▶
                </span>
              </span>
              <strong>{album.title}</strong>
              <span>{album.artist}</span>
              <small>{album.count} tracks</small>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}
