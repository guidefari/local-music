import { app, BrowserWindow, dialog, ipcMain } from "electron"
import { join } from "node:path"
import { Effect } from "effect"
import { scanFolder } from "./scanner"
import type { ScanReply } from "./contract"

function createWindow() {
  const output = join(app.getAppPath(), "dist")
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 780,
    minHeight: 540,
    title: "local-music",
    backgroundColor: "#191e1d",
    webPreferences: {
      preload: join(output, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  void window.loadFile(join(output, "index.html"))
}

ipcMain.handle("library:choose-folder", async (event): Promise<ScanReply> => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return { ok: false, message: "The window has closed." }
  const testFolder = !app.isPackaged ? process.env.LOCAL_MUSIC_TEST_FOLDER : undefined
  let folder = testFolder
  if (!folder) {
    const selection = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
      title: "Choose a music folder",
    })
    folder = selection.filePaths[0]
    if (selection.canceled || !folder) return { ok: false, cancelled: true }
  }

  try {
    const data = await Effect.runPromise(scanFolder(folder))
    return { ok: true, folder, data }
  } catch {
    return { ok: false, message: "Could not scan this folder. Check that the scanner is built and the files are readable." }
  }
})

void app.whenReady().then(() => {
  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
