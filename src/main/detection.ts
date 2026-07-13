import { BrowserWindow } from 'electron'
import type { Build, CalibrationRegion, MatchResult, OverlayState, Talent } from '../shared/types'
import { getActiveBuild, getSettings } from './store'
import { fetchHero } from './api'
import { findGameSource } from './capture'
import { SUPPORTED_LANGUAGES } from '../shared/types'
import { buildTips } from '../shared/tips'

// Orchestrates the 1 Hz detection loop:
//   main asks the hidden worker window to scan → worker captures + OCRs +
//   matches → main debounces results and pushes OverlayState to the overlay.

const CLEAR_AFTER_EMPTY_TICKS = 3
const SCAN_INTERVAL_MS = 1000

interface DetectionDeps {
  overlay: () => BrowserWindow | null
  worker: () => BrowserWindow | null
}

let deps: DetectionDeps | null = null
let timer: NodeJS.Timeout | null = null
let emptyTicks = 0
let lastSignature = ''
let catalogCache: { hero: string; lang: string; talents: Talent[] } | null = null

export function initDetection(d: DetectionDeps): void {
  deps = d
}

export function isRunning(): boolean {
  return timer !== null
}

export async function startDetection(): Promise<{ ok: boolean; error?: string }> {
  if (timer) return { ok: true }
  const settings = getSettings()
  const build = getActiveBuild()
  if (!build) return { ok: false, error: 'No active build selected' }

  const source = await findGameSource()
  if (!source) return { ok: false, error: 'Ravenswatch window not found — is the game running?' }

  // Calibration is stored per capture resolution; the worker reports actual
  // frame size on first capture and we pick the matching calibration there.
  if (Object.keys(settings.calibrations).length === 0) {
    return { ok: false, error: 'No calibration — set the talent region in the control panel' }
  }

  const catalog = await getCatalog(build.hero, settings.gameLanguage)
  const tesseractLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === settings.gameLanguage)?.tesseract ?? 'eng'

  deps?.worker()?.webContents.send('worker:configure', {
    sourceId: source.id,
    calibrations: settings.calibrations,
    catalog,
    build,
    tesseractLang
  })

  lastSignature = ''
  emptyTicks = 0
  timer = setInterval(() => {
    const w = deps?.worker()
    if (!w || w.isDestroyed()) return
    w.webContents.send('worker:scan')
  }, SCAN_INTERVAL_MS)
  return { ok: true }
}

export function stopDetection(): void {
  if (timer) clearInterval(timer)
  timer = null
  pushOverlayWaiting()
}

export async function scanOnce(): Promise<{ ok: boolean; error?: string }> {
  const wasRunning = timer !== null
  if (!wasRunning) {
    const started = await startDetection()
    if (!started.ok) return started
  }
  deps?.worker()?.webContents.send('worker:scan')
  if (!wasRunning) {
    // one-shot: stop the loop but keep worker configured
    if (timer) clearInterval(timer)
    timer = null
  }
  return { ok: true }
}

// Called from ipc.ts when the worker reports scan results.
export function handleScanResults(results: MatchResult[], region: CalibrationRegion): void {
  const matched = results.filter((r) => r.talent !== null)
  if (matched.length === 0) {
    emptyTicks++
    if (emptyTicks >= CLEAR_AFTER_EMPTY_TICKS && lastSignature !== '') {
      lastSignature = ''
      pushOverlayWaiting()
    }
    return
  }
  emptyTicks = 0
  const signature = matched.map((r) => `${r.cardIndex}:${r.talent!.name}`).join('|')
  if (signature === lastSignature) return
  lastSignature = signature

  const picks = matched
    .filter((r) => r.inBuild)
    .map((r) => ({
      cardIndex: r.cardIndex,
      talentName: r.talent!.name,
      priorityRank: r.priorityRank ?? 999
    }))

  const state: OverlayState =
    picks.length > 0 ? { kind: 'detected', picks, region } : { kind: 'no-match', region }
  deps?.overlay()?.webContents.send('overlay:state', state)
}

export function pushOverlayWaiting(): void {
  const build = getActiveBuild()
  const state: OverlayState = {
    kind: 'waiting',
    heroName: build?.hero ?? null,
    buildTitle: build?.title ?? null,
    tips: buildTips(build?.description, build?.notes)
  }
  deps?.overlay()?.webContents.send('overlay:state', state)
}

async function getCatalog(hero: string, lang: string): Promise<Talent[]> {
  if (catalogCache && catalogCache.hero === hero && catalogCache.lang === lang) {
    return catalogCache.talents
  }
  const heroData = await fetchHero(hero, lang)
  const talents = heroData.talents ?? []
  catalogCache = { hero, lang, talents }
  return talents
}

export function activeBuildChanged(_build: Build | null): void {
  catalogCache = null
  if (!timer) pushOverlayWaiting()
}
