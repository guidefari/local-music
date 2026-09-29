import { For, Show } from "solid-js"
import type { ScanResult, Track } from "../../shared/library-contract"
import { Cover } from "./cover"

export function TrackList(props: { tracks: ReadonlyArray<Track>; covers: ScanResult["covers"] }) {
  return (
    <div class="track-list" role="list" aria-label="Tracks">
      <Show when={props.tracks.length === 0}><div class="empty-list">No tracks to show</div></Show>
      <For each={props.tracks.slice(0, 500)}>{(track, index) => (
        <div class="track-row" role="listitem">
          <span class="track-number">{String(index() + 1).padStart(2, "0")}</span>
          <Cover id={track.coverId} covers={props.covers} size="small" />
          <div class="track-copy"><strong>{track.title}</strong><span>{track.artist} · {track.album}</span></div>
          <time class="duration">{Math.floor(track.durationSeconds / 60)}:{String(track.durationSeconds % 60).padStart(2, "0")}</time>
        </div>
      )}</For>
    </div>
  )
}
