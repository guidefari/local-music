import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { render } from 'solid-js/web'

import type { LibrarySnapshot, LibraryTrack } from '@/contracts/library'
import { Albums } from '@/implementation/renderer/components/albums'
import { FPSMeter } from '@/implementation/renderer/components/fps-meter'
import { Player } from '@/implementation/renderer/components/player'
import { TrackList } from '@/implementation/renderer/components/track-list'

type View = 'home' | 'tracks'

function App() {
  let searchInput: HTMLInputElement | undefined
  const [library, setLibrary] = createSignal<LibrarySnapshot | null>(null)
  const [query, setQuery] = createSignal('')
  const [view, setView] = createSignal<View>('home')
  const [busy, setBusy] = createSignal(false)
  const [scanning, setScanning] = createSignal<string[]>([])
  const [error, setError] = createSignal<string | null>(null)
  const [currentTrack, setCurrentTrack] = createSignal<LibraryTrack | null>(null)
  const [playing, setPlaying] = createSignal(false)

  const filtered = createMemo(
    () =>
      library()?.tracks.filter((track) =>
        [track.title, track.artist, track.album, track.path].some((field) =>
          field.toLocaleLowerCase().includes(query().trim().toLocaleLowerCase()),
        ),
      ) ?? [],
  )

  const playable = createMemo(
    () => library()?.tracks.filter((track) => track.presence === 'present') ?? [],
  )

  const currentIndex = createMemo(() => {
    const current = currentTrack()

    return current ? playable().findIndex((track) => track.id === current.id) : -1
  })

  const artists = createMemo(() => new Set(library()?.tracks.map((track) => track.artist)).size)

  const albums = createMemo(
    () => new Set(library()?.tracks.map((track) => `${track.artist}\0${track.album}`)).size,
  )

  const playAt = (index: number) => {
    const track = playable()[index]

    if (track) {
      setError(null)
      setCurrentTrack(track)
    }
  }

  const play = (track: LibraryTrack) => {
    if (track.presence !== 'present') return
    setError(null)
    setCurrentTrack(track)
  }

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

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        searchInput?.focus()
      }

      if (event.target instanceof HTMLInputElement) return

      if (event.key === '1') setView('home')

      if (event.key === '2') setView('tracks')
    }

    document.addEventListener('keydown', onKeyDown)

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
      document.removeEventListener('keydown', onKeyDown)
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
    <div class="app-shell">
      <header class="topbar">
        <div class="brand" aria-label="local-music">
          <span class="brand-mark" aria-hidden="true" />
          <strong>local-music</strong>
        </div>
        <nav class="lenses" aria-label="Library views">
          <button type="button" aria-current={view() === 'home'} onClick={() => setView('home')}>
            Library <kbd>1</kbd>
          </button>
          <button
            type="button"
            aria-current={view() === 'tracks'}
            onClick={() => setView('tracks')}
          >
            Tracks <kbd>2</kbd>
          </button>
        </nav>
        <label class="global-search" for="search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={(element) => {
              searchInput = element
            }}
            id="search"
            type="search"
            placeholder="Search tracks, albums, artists or paths"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          <kbd>⌘K</kbd>
        </label>
        <button
          class="add-folder"
          type="button"
          onClick={() => void chooseFolder()}
          disabled={busy()}
        >
          <span aria-hidden="true">＋</span> Add folder
        </button>
      </header>

      <main class="library-main">
        <div class="library-heading">
          <div>
            <span class="eyebrow">Your collection</span>
            <h1>
              {query() ? `Results for “${query()}”` : view() === 'home' ? 'Library' : 'All tracks'}
            </h1>
          </div>
          <p role="status" classList={{ error: Boolean(error()) }}>
            {error() ??
              (busy() || scanning().length
                ? 'Scanning music…'
                : library()
                  ? 'Indexed and ready to play'
                  : 'Loading your library…')}
          </p>
        </div>

        <Show when={library()}>
          <div class="library-stats" aria-label="Library summary">
            <span>
              <strong>{library()?.tracks.length}</strong> tracks
            </span>
            <span>
              <strong>{albums()}</strong> albums
            </span>
            <span>
              <strong>{artists()}</strong> artists
            </span>
            <span>
              <strong>{library()?.sources.length}</strong> folders
            </span>
            <div class="source-actions">
              <For each={library()?.sources}>
                {(source) => (
                  <button
                    type="button"
                    title={`Rescan ${source.rootPath}`}
                    disabled={scanning().includes(source.id)}
                    onClick={() => void rescan(source.id)}
                  >
                    {scanning().includes(source.id) ? 'Scanning…' : 'Rescan'}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={!query() && view() === 'home' && library()}>
          {(snapshot) => <Albums tracks={snapshot().tracks} onPlay={play} />}
        </Show>

        <section
          class={`tracks-section ${!query() && view() === 'home' ? 'with-albums' : ''}`}
          aria-labelledby="tracks-title"
        >
          <div class="section-heading">
            <h2 id="tracks-title">{query() ? 'Matching tracks' : 'Tracks'}</h2>
            <span>
              {filtered().length > 500
                ? `${filtered().length} found · showing 500`
                : `${filtered().length} ${filtered().length === 1 ? 'track' : 'tracks'}`}
            </span>
          </div>
          <TrackList
            tracks={filtered()}
            currentTrackId={currentTrack()?.id ?? null}
            playing={playing()}
            onPlay={play}
          />
        </section>
      </main>

      <Player
        track={currentTrack()}
        hasPrevious={currentIndex() > 0}
        hasNext={currentIndex() >= 0 && currentIndex() < playable().length - 1}
        onPrevious={() => playAt(currentIndex() - 1)}
        onNext={() => playAt(currentIndex() + 1)}
        onPlayingChange={setPlaying}
        onError={setError}
      />
      <Show when={window.localMusic.isDevelopment}>
        <FPSMeter />
      </Show>
    </div>
  )
}

const root = document.getElementById('root')

if (!root) throw new Error('Missing application root')

render(() => <App />, root)
