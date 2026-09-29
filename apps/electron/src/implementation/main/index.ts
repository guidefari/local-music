import { join } from 'node:path'

import { Effect, Layer, Schema } from 'effect'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'

import {
  Library,
  type ArtworkReply,
  type LibraryReply,
  type LibrarySnapshot,
} from '../../contracts/library'
import { artworkCacheLayer } from './artwork-cache'
import { openLibraryDatabase } from './db/open'
import { libraryStoreLayer } from './db/store'
import { libraryLayer } from './library'
import { sourceScannerLayer } from './scanner'

function createWindow() {
  const output = join(app.getAppPath(), 'dist')

  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 780,
    minHeight: 540,
    title: 'local-music',
    backgroundColor: '#191e1d',
    webPreferences: {
      preload: join(output, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  void window.loadFile(join(output, 'index.html'))
}

app.setName('local-music')

void app.whenReady().then(async () => {
  if (!app.isPackaged && process.env.LOCAL_MUSIC_TEST_USER_DATA) {
    app.setPath('userData', process.env.LOCAL_MUSIC_TEST_USER_DATA)
  }

  const userData = app.getPath('userData')

  const database = await openLibraryDatabase(
    join(userData, 'library.db'),
    join(app.getAppPath(), 'dist', 'drizzle'),
  )

  const adapters = Layer.mergeAll(
    libraryStoreLayer(database.db),
    sourceScannerLayer,
    artworkCacheLayer(join(userData, 'artwork')),
  )

  const library = await Effect.runPromise(
    Library.pipe(Effect.provide(libraryLayer.pipe(Layer.provide(adapters)))),
  )

  const notifyLibrary = (snapshot: LibrarySnapshot) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('library:changed', snapshot)
  }

  const notifyScan = (state: { sourceId: string; running: boolean; error?: string }) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('library:scan-state', state)
  }

  const rescan = async (sourceId: string): Promise<LibraryReply> => {
    try {
      notifyScan({ sourceId, running: true })
      const data = await Effect.runPromise(library.rescan(sourceId))
      notifyLibrary(data)

      return { ok: true, data }
    } catch {
      notifyScan({
        sourceId,
        running: false,
        error: 'Could not fully scan this folder.',
      })

      return { ok: false, message: 'Could not fully scan this folder. Saved tracks were kept.' }
    } finally {
      notifyScan({ sourceId, running: false })
    }
  }

  ipcMain.handle('library:load', async (): Promise<LibraryReply> => {
    try {
      const data = await Effect.runPromise(library.load())

      return { ok: true, data }
    } catch {
      return { ok: false, message: 'Could not open the saved library.' }
    }
  })

  ipcMain.handle('library:choose-folder', async (event): Promise<LibraryReply> => {
    const window = BrowserWindow.fromWebContents(event.sender)

    if (!window) return { ok: false, message: 'The window has closed.' }

    const testFolder = !app.isPackaged ? process.env.LOCAL_MUSIC_TEST_FOLDER : undefined
    let folder = testFolder

    if (!folder) {
      const selection = await dialog.showOpenDialog(window, {
        properties: ['openDirectory'],
        title: 'Choose a music folder',
      })

      folder = selection.filePaths[0]

      if (selection.canceled || !folder) return { ok: false, cancelled: true }
    }

    try {
      const data = await Effect.runPromise(library.addFolder(folder))
      notifyLibrary(data)

      return { ok: true, data }
    } catch {
      return { ok: false, message: 'Could not scan this folder. Saved tracks were kept.' }
    }
  })

  ipcMain.handle('library:rescan', async (_event, raw): Promise<LibraryReply> => {
    try {
      const sourceId = Schema.decodeUnknownSync(Schema.NonEmptyString)(raw)

      return await rescan(sourceId)
    } catch {
      return { ok: false, message: 'Invalid music folder.' }
    }
  })

  ipcMain.handle('library:artwork', async (_event, raw): Promise<ArtworkReply> => {
    try {
      const trackId = Schema.decodeUnknownSync(Schema.NonEmptyString)(raw)
      const artwork = await Effect.runPromise(library.artwork(trackId))

      return { ok: true, ...artwork }
    } catch {
      return { ok: false, message: 'Album artwork is not available.' }
    }
  })

  app.on('before-quit', () => database.close())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
