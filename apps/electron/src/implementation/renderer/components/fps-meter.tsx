import { createSignal, onCleanup, onMount } from 'solid-js'

export function FPSMeter() {
  const [fps, setFps] = createSignal(0)

  onMount(() => {
    let frame = 0
    let count = 0
    let start = performance.now()

    const measure = (now: number) => {
      count++

      if (now - start >= 1000) {
        setFps(Math.round((count * 1000) / (now - start)))
        count = 0
        start = now
      }

      frame = requestAnimationFrame(measure)
    }

    frame = requestAnimationFrame(measure)
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    <output
      class="pointer-events-none fixed right-3 bottom-3 min-w-[72px] rounded-[5px] bg-soft px-2 py-[5px] text-center font-data text-[11px] text-ink opacity-85"
      aria-label="Frames per second"
    >
      {fps()} FPS
    </output>
  )
}
