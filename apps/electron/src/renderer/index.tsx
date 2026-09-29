import { Show, createMemo, createSignal } from "solid-js"
import { render } from "solid-js/web"
import type { ScanResult } from "../shared/library-contract"
import { Albums } from "./components/albums"
import { FPSMeter } from "./components/fps-meter"
import { TrackList } from "./components/track-list"

function App() {
  const [folder, setFolder] = createSignal<string | null>(null)
  const [data, setData] = createSignal<ScanResult | null>(null)
  const [query, setQuery] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const filtered = createMemo(() => data()?.tracks.filter((track) =>
    [track.title, track.artist, track.album, track.path].some((field) => field.toLocaleLowerCase().includes(query().trim().toLocaleLowerCase())),
  ) ?? [])

  async function chooseFolder() {
    setBusy(true)
    setError(null)
    try {
      const reply = await window.localMusic.chooseFolder()
      if (reply.ok) {
        setFolder(reply.folder)
        setData(reply.data)
        setQuery("")
      } else if (!("cancelled" in reply)) {
        setError(reply.message)
      }
    } catch {
      setError("Could not read the scanner response.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="app-shell">
      <header class="app-header">
        <div class="brand"><img src="app-icon.svg" alt="" /><div><strong>local-music</strong><span>Your records, your way</span></div></div>
        <button type="button" onClick={() => void chooseFolder()} disabled={busy()}>{folder() ? "Change folder" : "Choose folder"}</button>
      </header>
      <main class="library">
        <div class="library-heading"><h1>Library</h1><p>{folder() ?? "Choose a folder to start exploring your music"}</p></div>
        <p class="status" role="status">{error() ?? (busy() ? "Scanning music…" : data() ? `${data()?.tracks.length} tracks indexed · ${data()?.skipped} files skipped` : "Choose a music folder to get started.")}</p>
        <label class="search-label" for="search">Search your library</label>
        <input id="search" type="search" placeholder="Search tracks, artists, albums, or paths" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} />
        <Show when={data()}>{(result) => <Albums data={result()} />}</Show>
        <section class="tracks" aria-labelledby="tracks-title">
          <div class="section-heading"><h2 id="tracks-title">Tracks</h2><span>{filtered().length > 500 ? `${filtered().length} matching · showing first 500` : `${filtered().length} matching tracks`}</span></div>
          <TrackList tracks={filtered()} covers={data()?.covers ?? {}} />
        </section>
      </main>
      <Show when={window.localMusic.isDevelopment}><FPSMeter /></Show>
    </div>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Missing application root")
render(() => <App />, root)
