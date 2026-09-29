import { Show, createEffect, createResource, createSignal, onCleanup } from 'solid-js'

export function Cover(props: { trackId: string | null; size: 'small' | 'large' }) {
  const size = () => (props.size === 'small' ? 'size-[46px]' : 'size-[76px]')

  const [artwork] = createResource(
    () => props.trackId,
    async (id) => {
      const reply = await window.localMusic.getTrackArtwork(id)

      if (!reply.ok) return null

      return { mimeType: reply.mimeType, bytes: reply.bytes }
    },
  )

  const [source, setSource] = createSignal<string | null>(null)

  createEffect(() => {
    const image = artwork()

    const next = image
      ? URL.createObjectURL(new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }))
      : null

    setSource(next)

    onCleanup(() => {
      if (next) URL.revokeObjectURL(next)
    })
  })

  return (
    <Show
      when={source()}
      fallback={
        <div
          class={`grid shrink-0 place-items-center rounded-md bg-soft ${size()}`}
          aria-label="No album artwork"
        >
          <span class="record" />
        </div>
      }
    >
      {(url) => <img class={`shrink-0 rounded-md object-cover ${size()}`} src={url()} alt="" />}
    </Show>
  )
}
