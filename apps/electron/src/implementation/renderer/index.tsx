import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { render } from 'solid-js/web'

import type { LibrarySnapshot } from '@/contracts/library'
import { Albums } from '@/implementation/renderer/components/albums'
import { FPSMeter } from '@/implementation/renderer/components/fps-meter'
import { TrackList } from '@/implementation/renderer/components/track-list'

function App() {
  const [library, setLibrary] = createSignal<LibrarySnapshot | null>(null)
  const [query, setQuery] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [scanning, setScanning] = createSignal<string[]>([])
  const [error, setError] = createSignal<string | null>(null)

  const filtered = createMemo(
    () =>
      library()?.tracks.filter((track) =>
        [track.title, track.artist, track.album, track.path].some((field) =>
          field.toLocaleLowerCase().includes(query().trim().toLocaleLowerCase()),
        ),
      ) ?? [],
  )

  onMount(() => {
    const stopLibrary = window.localMusic.onLibraryChanged(setLibrary)

    const stopScans = window.localMusic.onScanState((state) => {
      setScanning((current) =>
        state.running
          ? [...new Set([...current, state.sourceId])]
          : current.filter((id) => id !== state.sourceId),
      )

      if (state.error) setError(state.error)
    })

    void window.localMusic
      .loadLibrary()
      .then((reply) => {
        if (reply.ok) {
          setLibrary(reply.data)

          for (const source of reply.data.sources) void rescan(source.id)
        } else if (!('cancelled' in reply)) setError(reply.message)
      })
      .catch(() => setError('Could not load the saved library.'))

    onCleanup(() => {
      stopLibrary()
      stopScans()
    })
  })

  async function chooseFolder() {
    setBusy(true)
    setError(null)

    try {
      const reply = await window.localMusic.chooseFolder()

      if (reply.ok) setLibrary(reply.data)
      else if (!('cancelled' in reply)) setError(reply.message)
    } catch {
      setError('Could not add this folder.')
    } finally {
      setBusy(false)
    }
  }

  async function rescan(sourceId: string) {
    setError(null)

    try {
      const reply = await window.localMusic.rescan(sourceId)

      if (!reply.ok && !('cancelled' in reply)) setError(reply.message)
    } catch {
      setError('Could not scan this folder.')
    }
  }

  return (
    <div class="flex h-full flex-col font-ui">
      <header class="flex flex-none items-center justify-between gap-6 border-b border-line px-6 py-4">
        <div class="flex items-center gap-3">
          <img class="size-10 rounded-lg" src="app-icon.svg" alt="" />
          <div class="flex min-w-0 flex-col">
            <strong class="text-[15px] font-semibold">local-music</strong>
            <span class="mt-[3px] text-[13px] text-subtle">Your records, your way</span>
          </div>
        </div>
        <button
          class="cursor-default rounded-[7px] border border-line px-3 py-[7px] text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-copper disabled:opacity-55"
          type="button"
          onClick={() => void chooseFolder()}
          disabled={busy()}
        >
          Add folder
        </button>
      </header>
      <main class="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col gap-[18px] p-6">
        <div>
          <h1 class="mb-[5px] text-[21px] font-bold tracking-[-0.025em]">Library</h1>
          <Show when={library()?.sources.length}>
            <div class="flex flex-wrap gap-2">
              <For each={library()?.sources}>
                {(source) => (
                  <button
                    class="max-w-full cursor-default truncate rounded-[7px] border border-line px-2 py-1 text-[13px] text-subtle hover:bg-soft disabled:opacity-55"
                    type="button"
                    title={`Rescan ${source.rootPath}`}
                    disabled={scanning().includes(source.id)}
                    onClick={() => void rescan(source.id)}
                  >
                    {source.rootPath} ↻
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
        <p class="text-[13px] text-subtle" role="status">
          {error() ??
            (busy() || scanning().length
              ? 'Scanning music…'
              : library()
                ? `${library()?.tracks.length} tracks indexed across ${library()?.sources.length} folders`
                : 'Loading your library…')}
        </p>
        <label class="sr-only" for="search">
          Search your library
        </label>
        <input
          class="w-full rounded-[7px] border border-line bg-panel px-3 py-[9px] text-ink placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-copper"
          id="search"
          type="search"
          placeholder="Search tracks, artists, albums, or paths"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <Show when={library()}>{(snapshot) => <Albums tracks={snapshot().tracks} />}</Show>
        <section class="flex min-h-0 flex-1 flex-col gap-3" aria-labelledby="tracks-title">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-[15px] font-semibold" id="tracks-title">
              Tracks
            </h2>
            <span class="text-[13px] text-subtle">
              {filtered().length > 500
                ? `${filtered().length} matching · showing first 500`
                : `${filtered().length} matching tracks`}
            </span>
          </div>
          <TrackList tracks={filtered()} />
        </section>
      </main>
      <Show when={window.localMusic.isDevelopment}>
        <FPSMeter />
      </Show>
    </div>
  )
}

const root = document.getElementById('root')

if (!root) throw new Error('Missing application root')

render(() => <App />, root)
