import { Show, createResource } from 'solid-js'

export function Cover(props: { trackId: string | null; size: 'small' | 'large' }) {
  const size = () => (props.size === 'small' ? 'size-[46px]' : 'size-[76px]')

  const [artwork] = createResource(
    () => props.trackId,
    async (id) => {
      const reply = await window.localMusic.getTrackArtwork(id)

      if (!reply.ok) return null

      return new Promise<string | null>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? null : reader.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(new Blob([new Uint8Array(reply.bytes)], { type: reply.mimeType }))
      })
    },
  )

  return (
    <Show
      when={artwork()}
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
