import { Show, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'

import type { ScanResult } from '../shared/library-contract'
import { Albums } from './components/albums'
import { FPSMeter } from './components/fps-meter'
import { TrackList } from './components/track-list'

function App() {
  const [folder, setFolder] = createSignal<string | null>(null)
  const [data, setData] = createSignal<ScanResult | null>(null)
  const [query, setQuery] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const filtered = createMemo(
    () =>
      data()?.tracks.filter((track) =>
        [track.title, track.artist, track.album, track.path].some((field) =>
          field.toLocaleLowerCase().includes(query().trim().toLocaleLowerCase()),
        ),
      ) ?? [],
  )

  async function chooseFolder() {
    setBusy(true)
    setError(null)

    try {
      const reply = await window.localMusic.chooseFolder()

      if (reply.ok) {
        setFolder(reply.folder)
        setData(reply.data)
        setQuery('')
      } else if (!('cancelled' in reply)) {
        setError(reply.message)
      }
    } catch {
      setError('Could not read the scanner response.')
    } finally {
      setBusy(false)
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
          {folder() ? 'Change folder' : 'Choose folder'}
        </button>
      </header>
      <main class="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col gap-[18px] p-6">
        <div>
          <h1 class="mb-[5px] text-[21px] font-bold tracking-[-0.025em]">Library</h1>
          <p class="truncate text-[13px] text-subtle">
            {folder() ?? 'Choose a folder to start exploring your music'}
          </p>
        </div>
        <p class="text-[13px] text-subtle" role="status">
          {error() ??
            (busy()
              ? 'Scanning music…'
              : data()
                ? `${data()?.tracks.length} tracks indexed · ${data()?.skipped} files skipped`
                : 'Choose a music folder to get started.')}
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
        <Show when={data()}>{(result) => <Albums data={result()} />}</Show>
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
          <TrackList tracks={filtered()} covers={data()?.covers ?? {}} />
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
