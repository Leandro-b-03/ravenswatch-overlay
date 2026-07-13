import { ipcMain, BrowserWindow } from 'electron'
import type { Build, CalibrationRegion, MatchResult, Settings } from '../shared/types'
import * as api from './api'
import * as store from './store'
import * as detection from './detection'
import { listCaptureSources, findGameSource } from './capture'

interface IpcDeps {
  overlay: () => BrowserWindow | null
  toggleInteractive: () => void
}

export function registerIpc(deps: IpcDeps): void {
  // --- settings ---
  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:update', (_e, patch: Partial<Settings>) => {
    const before = store.getSettings().activeBuildId
    const settings = store.updateSettings(patch)
    if (patch.activeBuildId !== undefined && patch.activeBuildId !== before) {
      detection.activeBuildChanged(store.getActiveBuild())
    }
    return settings
  })

  // --- catalogs ---
  ipcMain.handle('catalog:heroes', (_e, lang: string) => api.fetchHeroes(lang))
  ipcMain.handle('catalog:hero', (_e, rawName: string, lang: string) =>
    api.fetchHero(rawName, lang)
  )
  ipcMain.handle('catalog:items', () => api.fetchItems())
  ipcMain.handle('catalog:isLanguageLocalized', (_e, lang: string) =>
    api.isLanguageLocalized(lang)
  )

  // --- builds ---
  ipcMain.handle('builds:list', () => store.getBuilds())
  ipcMain.handle('builds:save', (_e, build: Build) => {
    store.saveBuild(build)
    if (store.getSettings().activeBuildId === build.id) {
      detection.activeBuildChanged(build)
    }
    return store.getBuilds()
  })
  ipcMain.handle('builds:delete', (_e, id: string) => {
    const wasActive = store.getSettings().activeBuildId === id
    store.deleteBuild(id)
    if (wasActive) detection.activeBuildChanged(null)
    return store.getBuilds()
  })
  ipcMain.handle('builds:browse', (_e, hero: string, page: number) =>
    api.fetchCommunityBuilds(hero, page)
  )
  ipcMain.handle('builds:import', async (_e, urlOrId: string) => {
    const id = api.parseBuildId(urlOrId)
    if (!id) throw new Error('Not a valid BuildMaker share URL or build id')
    const build = await api.fetchBuild(id)
    store.saveBuild(build)
    return build
  })

  // --- capture / calibration ---
  ipcMain.handle('capture:sources', () => listCaptureSources())
  ipcMain.handle('capture:findGame', () => findGameSource())
  ipcMain.handle('calibration:save', (_e, key: string, region: CalibrationRegion) => {
    const settings = store.getSettings()
    return store.updateSettings({
      calibrations: { ...settings.calibrations, [key]: region }
    })
  })

  // --- detection ---
  ipcMain.handle('detection:start', () => detection.startDetection())
  ipcMain.handle('detection:stop', () => detection.stopDetection())
  ipcMain.handle('detection:scanOnce', () => detection.scanOnce())
  ipcMain.handle('detection:isRunning', () => detection.isRunning())

  // worker → main scan results
  ipcMain.on(
    'worker:results',
    (_e, results: MatchResult[], region: CalibrationRegion) => {
      detection.handleScanResults(results, region)
    }
  )

  // overlay chrome
  ipcMain.on('overlay:toggle-interactive', () => deps.toggleInteractive())
  ipcMain.handle('overlay:resetPosition', () => {
    const settings = store.updateSettings({ overlayPosition: null })
    deps.overlay()?.webContents.send('overlay:position-reset')
    return settings
  })
}
