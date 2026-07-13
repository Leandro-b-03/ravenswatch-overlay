import { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage } from 'electron'
import {
  createOverlayWindow,
  createPanelWindow,
  createSplashWindow,
  createWorkerWindow
} from './windows'
import { registerIpc } from './ipc'
import * as detection from './detection'
import { fetchHeroes, fetchItems } from './api'
import { getSettings } from './store'

const TOGGLE_INTERACTIVE = 'CommandOrControl+Shift+O'
const SCAN_ONCE = 'CommandOrControl+Shift+S'
const TOGGLE_PANEL = 'CommandOrControl+Shift+P'
const TIMER_TOGGLE = 'CommandOrControl+Shift+T'
const PHASE_SKIP = 'CommandOrControl+Shift+N'
const NEXT_TIP = 'CommandOrControl+Shift+H'

let overlayWindow: BrowserWindow | null = null
let panelWindow: BrowserWindow | null = null
let workerWindow: BrowserWindow | null = null
let tray: Tray | null = null
let interactive = false

function toggleInteractiveMode(): void {
  if (!overlayWindow) return
  interactive = !interactive
  overlayWindow.setIgnoreMouseEvents(!interactive, { forward: true })
  overlayWindow.setFocusable(interactive)
  if (interactive) overlayWindow.focus()
  overlayWindow.webContents.send('interactive-mode-changed', interactive)
}

function openPanel(): void {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.show()
    panelWindow.focus()
    return
  }
  panelWindow = createPanelWindow()
  panelWindow.on('closed', () => {
    panelWindow = null
  })
}

function createTray(): void {
  // 16x16 dark raven-ish placeholder dot; replaced by real icon at packaging.
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAVElEQVR4nGNgGAWMDAwM/xkYGP4TieFq/pMDmBgoBKMGMDAwMTAwMDIwMDD8JxLD1DKRawA2A/6TYyMuA/6TYyMuA/6TYyMuA/6TYyMuA0YBFAAA7yAT9x0mFioAAAAASUVORK5CYII='
  )
  tray = new Tray(icon)
  tray.setToolTip('Ravenswatch Overlay')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Control Panel', click: openPanel },
      { label: 'Toggle Interactive (Ctrl+Shift+O)', click: toggleInteractiveMode },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
  tray.on('double-click', openPanel)
}

async function preloadCatalogs(): Promise<void> {
  const lang = getSettings().gameLanguage
  // Warm the cache; failures are fine (offline start with existing cache).
  await Promise.allSettled([fetchHeroes(lang), fetchItems()])
}

app.whenReady().then(async () => {
  const splash = createSplashWindow()

  registerIpc({
    overlay: () => overlayWindow,
    toggleInteractive: toggleInteractiveMode
  })

  await preloadCatalogs()

  overlayWindow = createOverlayWindow()
  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
  workerWindow = createWorkerWindow()
  workerWindow.on('closed', () => {
    workerWindow = null
  })

  detection.initDetection({
    overlay: () => overlayWindow,
    worker: () => workerWindow
  })

  overlayWindow.webContents.once('did-finish-load', () => {
    overlayWindow?.show()
    detection.pushOverlayWaiting()
    if (!splash.isDestroyed()) splash.close()
    openPanel()
  })

  createTray()

  globalShortcut.register(TOGGLE_INTERACTIVE, toggleInteractiveMode)
  globalShortcut.register(SCAN_ONCE, () => void detection.scanOnce())
  globalShortcut.register(TOGGLE_PANEL, openPanel)
  globalShortcut.register(TIMER_TOGGLE, () =>
    overlayWindow?.webContents.send('run-timer:toggle')
  )
  globalShortcut.register(PHASE_SKIP, () => overlayWindow?.webContents.send('run-timer:skip'))
  globalShortcut.register(NEXT_TIP, () => overlayWindow?.webContents.send('tips:next'))
})

// Tray app: keep running when all windows are closed.
app.on('window-all-closed', () => {
  /* stay alive in tray */
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
})
