import type { ArtworkReply, LibraryReply, LibrarySnapshot } from '../../contracts/library'

declare global {
  interface Window {
    localMusic: {
      loadLibrary: () => Promise<LibraryReply>
      chooseFolder: () => Promise<LibraryReply>
      rescan: (sourceId: string) => Promise<LibraryReply>
      getTrackArtwork: (trackId: string) => Promise<ArtworkReply>
      onLibraryChanged: (listener: (snapshot: LibrarySnapshot) => void) => () => void
      onScanState: (
        listener: (state: { sourceId: string; running: boolean; error?: string }) => void,
      ) => () => void
      isDevelopment: boolean
    }
  }
}
