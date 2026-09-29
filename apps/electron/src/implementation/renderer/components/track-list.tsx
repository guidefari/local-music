import { For, Show } from 'solid-js'

import type { LibraryTrack } from '@/contracts/library'
import { Cover } from '@/implementation/renderer/components/cover'

export function TrackList(props: { tracks: ReadonlyArray<LibraryTrack> }) {
  return (
    <div
      class="min-h-0 flex-1 overflow-auto rounded-[9px] border border-line bg-panel"
      role="list"
      aria-label="Tracks"
    >
      <Show when={props.tracks.length === 0}>
        <div class="p-7 text-subtle">No tracks to show</div>
      </Show>
      <For each={props.tracks.slice(0, 500)}>
        {(track, index) => (
          <div
            class="flex min-h-[66px] items-center gap-[14px] border-b border-line px-4 py-[9px] last:border-b-0"
            role="listitem"
          >
            <span class="w-7 shrink-0 font-data text-[13px] text-subtle tabular-nums">
              {String(index() + 1).padStart(2, '0')}
            </span>
            <Cover trackId={track.id} artworkId={track.artworkId} size="small" />
            <div class="flex min-w-0 flex-1 flex-col gap-[5px]">
              <strong class="truncate font-semibold">
                {track.title}
                {track.presence === 'missing' ? ' · Missing' : ''}
              </strong>
              <span class="truncate text-[13px] text-subtle">
                {track.artist} · {track.album}
              </span>
            </div>
            <time class="font-data text-[13px] text-subtle tabular-nums">
              {Math.floor(track.durationSeconds / 60)}:
              {String(track.durationSeconds % 60).padStart(2, '0')}
            </time>
          </div>
        )}
      </For>
    </div>
  )
}
