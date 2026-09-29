import { Schema } from 'effect'
import { contextBridge, ipcRenderer } from 'electron'

import { LibraryReply, LibrarySnapshot } from '../../contracts/library'

contextBridge.exposeInMainWorld('localMusic', {
  loadLibrary: async (): Promise<LibraryReply> => {
    const raw: unknown = await ipcRenderer.invoke('library:load')

    return Schema.decodeUnknownSync(LibraryReply)(raw)
  },
  chooseFolder: async (): Promise<LibraryReply> =>
    Schema.decodeUnknownSync(LibraryReply)(await ipcRenderer.invoke('library:choose-folder')),
  rescan: async (sourceId: string): Promise<LibraryReply> =>
    Schema.decodeUnknownSync(LibraryReply)(await ipcRenderer.invoke('library:rescan', sourceId)),
  onLibraryChanged: (listener: (snapshot: LibrarySnapshot) => void) => {
    const receive = (
      _event: Electron.IpcRendererEvent,
      raw: Parameters<Parameters<typeof ipcRenderer.on>[1]>[1],
    ) => {
      const snapshot = Schema.decodeUnknownSync(LibrarySnapshot)(raw)
      listener(snapshot)
    }

    ipcRenderer.on('library:changed', receive)

    return () => ipcRenderer.removeListener('library:changed', receive)
  },
  onScanState: (
    listener: (state: { sourceId: string; running: boolean; error?: string }) => void,
  ) => {
    const receive = (
      _event: Electron.IpcRendererEvent,
      raw: Parameters<Parameters<typeof ipcRenderer.on>[1]>[1],
    ) => {
      const state = Schema.decodeUnknownSync(
        Schema.Struct({
          sourceId: Schema.NonEmptyString,
          running: Schema.Boolean,
          error: Schema.optional(Schema.String),
        }),
      )(raw)

      listener(state)
    }

    ipcRenderer.on('library:scan-state', receive)

    return () => ipcRenderer.removeListener('library:scan-state', receive)
  },
  isDevelopment: process.env.NODE_ENV !== 'production',
})
