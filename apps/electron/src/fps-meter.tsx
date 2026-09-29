import { createSignal, onCleanup, onMount } from "solid-js"

export function FPSMeter() {
  const [fps, setFps] = createSignal(0)

  onMount(() => {
    let frame = 0
    let count = 0
    let start = performance.now()
    const measure = (now: number) => {
      count++
      if (now - start >= 1000) {
        setFps(Math.round(count * 1000 / (now - start)))
        count = 0
        start = now
      }
      frame = requestAnimationFrame(measure)
    }
    frame = requestAnimationFrame(measure)
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return <output class="fps-meter" aria-label="Frames per second">{fps()} FPS</output>
}
