import { Show } from "solid-js"
import type { ScanResult } from "../../shared/library-contract"

export function Cover(props: { id: string | null; covers: ScanResult["covers"]; size: "small" | "large" }) {
  return (
    <Show when={props.id ? props.covers[props.id] : undefined} fallback={
      <div class={`cover cover-${props.size} cover-empty`} aria-label="No album artwork">
        <span class="record" />
      </div>
    }>
      {(source) => <img class={`cover cover-${props.size}`} src={source()} alt="" />}
    </Show>
  )
}
