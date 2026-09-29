import { Schema } from 'effect'
import { contextBridge, ipcRenderer } from 'electron'

import { ScanReply } from '../../contracts/library'

contextBridge.exposeInMainWorld('localMusic', {
  chooseFolder: async (): Promise<ScanReply> => {
    const raw: unknown = await ipcRenderer.invoke('library:choose-folder')

    return Schema.decodeUnknownSync(ScanReply)(raw)
  },
  isDevelopment: process.env.NODE_ENV !== 'production',
})
