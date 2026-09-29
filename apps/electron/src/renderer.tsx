import { useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { FPSMeter } from "@overengineering/fps-meter"
import type { ScanResult, Track } from "./contract"

function Cover({ id, covers, size }: { id: string | null; covers: ScanResult["covers"]; size: "small" | "large" }) {
  const source = id ? covers[id] : undefined
  return source ? (
    <img className={`cover cover-${size}`} src={source} alt="" />
  ) : (
    <div className={`cover cover-${size} cover-empty`} aria-label="No album artwork">
      <span className="record" />
    </div>
  )
}

function Albums({ data }: { data: ScanResult }) {
  const albums = new Map<string, { artist: string; title: string; count: number; coverId: string | null }>()
  for (const track of data.tracks) {
    const key = `${track.artist}\0${track.album}`
    const album = albums.get(key)
    if (album) {
      album.count++
      album.coverId ??= track.coverId
    } else {
      albums.set(key, { artist: track.artist, title: track.album, count: 1, coverId: track.coverId })
    }
  }
  return (
    <section className="albums" aria-labelledby="albums-title">
      <div className="section-heading"><h2 id="albums-title">Albums</h2><span>{albums.size} in this folder</span></div>
      <div className="album-grid">
        {[...albums.values()].slice(0, 4).map((album) => (
          <article className="album-card" key={`${album.artist}\0${album.title}`}>
            <Cover id={album.coverId} covers={data.covers} size="large" />
            <div className="album-copy"><strong>{album.title}</strong><span>{album.artist}</span><small>{album.count} tracks</small></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function TrackList({ tracks, covers }: { tracks: ReadonlyArray<Track>; covers: ScanResult["covers"] }) {
  return (
    <div className="track-list" role="list" aria-label="Tracks">
      {tracks.length === 0 && <div className="empty-list">No tracks to show</div>}
      {tracks.slice(0, 500).map((track, index) => (
        <div className="track-row" role="listitem" key={track.path}>
          <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
          <Cover id={track.coverId} covers={covers} size="small" />
          <div className="track-copy"><strong>{track.title}</strong><span>{track.artist} · {track.album}</span></div>
          <time className="duration">{Math.floor(track.durationSeconds / 60)}:{String(track.durationSeconds % 60).padStart(2, "0")}</time>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [folder, setFolder] = useState<string | null>(null)
  const [data, setData] = useState<ScanResult | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const filtered = useMemo(() => data?.tracks.filter((track) =>
    [track.title, track.artist, track.album, track.path].some((field) => field.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  ) ?? [], [data, query])

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
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><img src="app-icon.svg" alt="" /><div><strong>local-music</strong><span>Your records, your way</span></div></div>
        <button type="button" onClick={() => void chooseFolder()} disabled={busy}>{folder ? "Change folder" : "Choose folder"}</button>
      </header>
      <main className="library">
        <div className="library-heading"><h1>Library</h1><p>{folder ?? "Choose a folder to start exploring your music"}</p></div>
        <p className="status" role="status">{error ?? (busy ? "Scanning music…" : data ? `${data.tracks.length} tracks indexed · ${data.skipped} files skipped` : "Choose a music folder to get started.")}</p>
        <label className="search-label" htmlFor="search">Search your library</label>
        <input id="search" type="search" placeholder="Search tracks, artists, albums, or paths" value={query} onChange={(event) => setQuery(event.target.value)} />
        {data && <Albums data={data} />}
        <section className="tracks" aria-labelledby="tracks-title">
          <div className="section-heading"><h2 id="tracks-title">Tracks</h2><span>{filtered.length > 500 ? `${filtered.length} matching · showing first 500` : `${filtered.length} matching tracks`}</span></div>
          <TrackList tracks={filtered} covers={data?.covers ?? {}} />
        </section>
      </main>
      {window.localMusic.isDevelopment && <div className="fps-meter"><FPSMeter height={32} /></div>}
    </div>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Missing application root")
createRoot(root).render(<App />)
