import { For, createMemo } from "solid-js"
import type { ScanResult } from "../../shared/library-contract"
import { Cover } from "./cover"

export function Albums(props: { data: ScanResult }) {
  const albums = createMemo(() => {
    const found = new Map<string, { artist: string; title: string; count: number; coverId: string | null }>()
    for (const track of props.data.tracks) {
      const key = `${track.artist}\0${track.album}`
      const album = found.get(key)
      if (album) {
        album.count++
        album.coverId ??= track.coverId
      } else {
        found.set(key, { artist: track.artist, title: track.album, count: 1, coverId: track.coverId })
      }
    }
    return found
  })

  return (
    <section class="albums" aria-labelledby="albums-title">
      <div class="section-heading"><h2 id="albums-title">Albums</h2><span>{albums().size} in this folder</span></div>
      <div class="album-grid">
        <For each={[...albums().values()].slice(0, 4)}>{(album) => (
          <article class="album-card">
            <Cover id={album.coverId} covers={props.data.covers} size="large" />
            <div class="album-copy"><strong>{album.title}</strong><span>{album.artist}</span><small>{album.count} tracks</small></div>
          </article>
        )}</For>
      </div>
    </section>
  )
}
