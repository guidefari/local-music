import { For } from 'solid-js'

import { Cover } from '@/implementation/renderer/components/cover'
import type { Album } from '@/implementation/renderer/lib/albums'

/** Shows a shelf of albums and starts playback from their first available track. */
export function Albums(props: { albums: ReadonlyArray<Album>; onPlay: (album: Album) => void }) {
  return (
    <section class="album-section" aria-labelledby="albums-title">
      <div class="section-heading">
        <h2 id="albums-title">Albums in rotation</h2>
        <span>{props.albums.length} in your library</span>
      </div>
      <div class="album-shelf">
        <For each={props.albums.slice(0, 6)}>
          {(album) => (
            <button
              class="album-card"
              type="button"
              onClick={() => props.onPlay(album)}
              disabled={album.tracks.every((track) => track.presence === 'missing')}
            >
              <span class="album-art">
                <Cover
                  trackId={album.cover?.id ?? null}
                  artworkId={album.cover?.artworkId ?? null}
                  size="large"
                />
                <span class="album-play" aria-hidden="true">
                  ▶
                </span>
              </span>
              <strong>{album.title}</strong>
              <span>{album.artist}</span>
              <small>{album.tracks.length} tracks</small>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}
