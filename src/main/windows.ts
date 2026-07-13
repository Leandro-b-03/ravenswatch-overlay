import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'

const PRELOAD = join(__dirname, '../preload/index.js')

export function appIconPath(): string {
  // Packaged: extraResources places it under process.resourcesPath.
  // Dev: read straight from the project's resources folder.
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources/icon.png')
}

type Page = 'overlay' | 'panel' | 'splash' | 'worker'

function rendererUrl(page: Page): { url?: string; file?: string } {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (devServer) return { url: `${devServer}/${page}/index.html` }
  return { file: join(__dirname, `../renderer/${page}/index.html`) }
}

function loadPage(win: BrowserWindow, page: Page): void {
  const target = rendererUrl(page)
  if (target.url) win.loadURL(target.url)
  else if (target.file) win.loadFile(target.file)
}

export function createSplashWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 280,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    icon: appIconPath(),
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  })
  loadPage(win, 'splash')
  return win
}

export function createOverlayWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().bounds
  const win = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true, { forward: true })
  loadPage(win, 'overlay')
  return win
}

// Hidden window hosting getUserMedia capture + the tesseract OCR worker.
// Kept out of the overlay so heavy work never janks HUD rendering.
export function createWorkerWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  })
  loadPage(win, 'worker')
  return win
}

export function createPanelWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Ravenswatch Overlay — Control Panel',
    icon: appIconPath(),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  })
  win.once('ready-to-show', () => win.show())
  loadPage(win, 'panel')
  return win
}
