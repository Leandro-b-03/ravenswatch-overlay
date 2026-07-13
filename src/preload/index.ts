import { contextBridge, ipcRenderer } from 'electron'
import type {
  Build,
  CalibrationRegion,
  CaptureSource,
  CommunityBuildSummary,
  GameItem,
  Hero,
  MatchResult,
  OverlayState,
  Settings,
  Talent
} from '../shared/types'

const overlayAPI = {
  // overlay
  onInteractiveModeChanged: (cb: (interactive: boolean) => void): void => {
    ipcRenderer.on('interactive-mode-changed', (_e, v: boolean) => cb(v))
  },
  onOverlayState: (cb: (state: OverlayState) => void): void => {
    ipcRenderer.on('overlay:state', (_e, s: OverlayState) => cb(s))
  },
  onRunTimerToggle: (cb: () => void): void => {
    ipcRenderer.on('run-timer:toggle', () => cb())
  },
  onRunTimerSkip: (cb: () => void): void => {
    ipcRenderer.on('run-timer:skip', () => cb())
  },
  onNextTip: (cb: () => void): void => {
    ipcRenderer.on('tips:next', () => cb())
  },

  // settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:update', patch),

  // catalogs
  getHeroes: (lang: string): Promise<Hero[]> => ipcRenderer.invoke('catalog:heroes', lang),
  getHero: (rawName: string, lang: string): Promise<Hero> =>
    ipcRenderer.invoke('catalog:hero', rawName, lang),
  getItems: (): Promise<GameItem[]> => ipcRenderer.invoke('catalog:items'),
  isLanguageLocalized: (lang: string): Promise<boolean> =>
    ipcRenderer.invoke('catalog:isLanguageLocalized', lang),

  // builds
  listBuilds: (): Promise<Build[]> => ipcRenderer.invoke('builds:list'),
  saveBuild: (build: Build): Promise<Build[]> => ipcRenderer.invoke('builds:save', build),
  deleteBuild: (id: string): Promise<Build[]> => ipcRenderer.invoke('builds:delete', id),
  browseBuilds: (hero: string, page: number): Promise<CommunityBuildSummary[]> =>
    ipcRenderer.invoke('builds:browse', hero, page),
  importBuild: (urlOrId: string): Promise<Build> => ipcRenderer.invoke('builds:import', urlOrId),

  // capture / calibration
  getCaptureSources: (): Promise<CaptureSource[]> => ipcRenderer.invoke('capture:sources'),
  findGameSource: (): Promise<CaptureSource | null> => ipcRenderer.invoke('capture:findGame'),
  saveCalibration: (key: string, region: CalibrationRegion): Promise<Settings> =>
    ipcRenderer.invoke('calibration:save', key, region),

  // detection
  startDetection: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('detection:start'),
  stopDetection: (): Promise<void> => ipcRenderer.invoke('detection:stop'),
  scanOnce: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('detection:scanOnce'),
  isDetectionRunning: (): Promise<boolean> => ipcRenderer.invoke('detection:isRunning'),

  // worker page
  onWorkerConfigure: (
    cb: (cfg: {
      sourceId: string
      calibrations: Record<string, CalibrationRegion>
      catalog: Talent[]
      build: Build
      tesseractLang: string
    }) => void
  ): void => {
    ipcRenderer.on('worker:configure', (_e, cfg) => cb(cfg))
  },
  onWorkerScan: (cb: () => void): void => {
    ipcRenderer.on('worker:scan', () => cb())
  },
  sendWorkerResults: (results: MatchResult[], region: CalibrationRegion): void => {
    ipcRenderer.send('worker:results', results, region)
  }
}

contextBridge.exposeInMainWorld('overlayAPI', overlayAPI)

export type OverlayAPI = typeof overlayAPI
