import { Show } from 'solid-js'

import type { ScanResult } from '../../../contracts/library'

export function Cover(props: {
  id: string | null
  covers: ScanResult['covers']
  size: 'small' | 'large'
}) {
  const size = () => (props.size === 'small' ? 'size-[46px]' : 'size-[76px]')

  return (
    <Show
      when={props.id ? props.covers[props.id] : undefined}
      fallback={
        <div
          class={`grid shrink-0 place-items-center rounded-md bg-soft ${size()}`}
          aria-label="No album artwork"
        >
          <span class="record" />
        </div>
      }
    >
      {(source) => (
        <img class={`shrink-0 rounded-md object-cover ${size()}`} src={source()} alt="" />
      )}
    </Show>
  )
}
