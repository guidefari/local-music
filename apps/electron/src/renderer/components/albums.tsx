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
    <section class="flex flex-col gap-3" aria-labelledby="albums-title">
      <div class="flex items-center justify-between gap-4"><h2 class="text-[15px] font-semibold" id="albums-title">Albums</h2><span class="text-[13px] text-subtle">{albums().size} in this folder</span></div>
      <div class="flex flex-wrap gap-3">
        <For each={[...albums().values()].slice(0, 4)}>{(album) => (
          <article class="flex min-w-[240px] flex-[1_1_250px] items-center gap-4 rounded-[10px] border border-line bg-panel p-4">
            <Cover id={album.coverId} covers={props.data.covers} size="large" />
            <div class="flex min-w-0 flex-col gap-[5px]"><strong class="truncate font-semibold">{album.title}</strong><span class="text-[13px] text-subtle">{album.artist}</span><small class="text-[13px] text-subtle">{album.count} tracks</small></div>
          </article>
        )}</For>
      </div>
    </section>
  )
}
