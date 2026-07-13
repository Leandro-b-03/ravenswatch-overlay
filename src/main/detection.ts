import { BrowserWindow } from 'electron'
import type { Build, CalibrationRegion, MatchResult, OverlayState, Talent } from '../shared/types'
import { getActiveBuild, getSettings, recordRunPick, resetRunRecording } from './store'
import { fetchHero } from './api'
import { findGameSource } from './capture'
import { SUPPORTED_LANGUAGES } from '../shared/types'
import { buildTips } from '../shared/tips'

// Orchestrates the 1 Hz detection loop:
//   main asks the hidden worker window to scan → worker captures + OCRs +
//   matches → main debounces results and pushes OverlayState to the overlay.
// A 10 s watcher auto-starts the loop when the game window appears (and the
// prerequisites exist) and reports what is missing to the overlay status line.

const CLEAR_AFTER_EMPTY_TICKS = 3
// Static frames are skipped via a cheap hash in the worker, so a faster tick
// only costs work when the screen actually changes.
const SCAN_INTERVAL_MS = 600
const WATCH_INTERVAL_MS = 10000

interface DetectionDeps {
  overlay: () => BrowserWindow | null
  worker: () => BrowserWindow | null
}

let deps: DetectionDeps | null = null
let timer: NodeJS.Timeout | null = null
let watcher: NodeJS.Timeout | null = null
let emptyTicks = 0
let lastSignature = ''
let lastNote = ''
let workerReady = false
let pendingScan = false
let catalogCache: { hero: string; lang: string; talents: Talent[] } | null = null

export function initDetection(d: DetectionDeps): void {
  deps = d
  watcher = setInterval(() => void watchTick(), WATCH_INTERVAL_MS)
  void watchTick()
}

export function disposeDetection(): void {
  if (watcher) clearInterval(watcher)
  stopDetection()
}

export function isRunning(): boolean {
  return timer !== null
}

// Sends a status key the overlay translates and shows under the HUD.
function note(key: string): void {
  if (key === lastNote) return
  lastNote = key
  deps?.overlay()?.webContents.send('overlay:detection-note', key)
}

// The first notes can fire before the overlay page has loaded — call this
// after did-finish-load so the current status isn't lost to deduping.
export function resendNote(): void {
  if (lastNote) deps?.overlay()?.webContents.send('overlay:detection-note', lastNote)
}

async function watchTick(): Promise<void> {
  if (timer) return // already running
  const build = getActiveBuild()
  if (!build) {
    note('note.noBuild')
    return
  }
  const source = await findGameSource()
  if (!source) {
    note('note.noGame')
    return
  }
  const started = await startDetection()
  if (!started.ok) note('note.error')
}

export async function startDetection(): Promise<{ ok: boolean; error?: string }> {
  if (timer) return { ok: true }
  const settings = getSettings()
  const build = getActiveBuild()
  if (!build) return { ok: false, error: 'No active build selected' }

  const source = await findGameSource()
  if (!source) return { ok: false, error: 'Ravenswatch window not found — is the game running?' }

  let catalog: Talent[]
  try {
    catalog = await getCatalog(build.hero, settings.gameLanguage)
  } catch (err) {
    return { ok: false, error: `Could not load talent catalog: ${String(err)}` }
  }
  const tesseractLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === settings.gameLanguage)?.tesseract ?? 'eng'

  workerReady = false
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
    if (!w || w.isDestroyed() || !workerReady) return
    w.webContents.send('worker:scan')
  }, SCAN_INTERVAL_MS)
  note('note.active')
  return { ok: true }
}

export function stopDetection(): void {
  if (timer) clearInterval(timer)
  timer = null
  pushOverlayWaiting()
  note('note.stopped')
}

// Worker finished configuring (stream playing, OCR model loaded).
export function handleWorkerReady(): void {
  workerReady = true
  if (pendingScan) {
    pendingScan = false
    deps?.worker()?.webContents.send('worker:scan')
  }
}

export async function scanOnce(): Promise<{ ok: boolean; error?: string }> {
  const wasRunning = timer !== null
  if (!wasRunning) {
    const started = await startDetection()
    if (!started.ok) {
      note('note.error')
      return started
    }
  }
  if (workerReady) {
    deps?.worker()?.webContents.send('worker:scan')
  } else {
    pendingScan = true // fires from handleWorkerReady
  }
  return { ok: true }
}

// Most recent matched cards — the run recorder resolves pick hotkeys here.
let lastMatched: MatchResult[] = []

export function getLastMatched(): MatchResult[] {
  return lastMatched
}

// Called from ipc.ts when the worker reports scan results.
export function handleScanResults(results: MatchResult[], region: CalibrationRegion): void {
  const matched = results.filter((r) => r.talent !== null)
  if (matched.length === 0) {
    emptyTicks++
    if (emptyTicks >= CLEAR_AFTER_EMPTY_TICKS && lastSignature !== '') {
      lastSignature = ''
      lastMatched = []
      pushOverlayWaiting()
    }
    return
  }
  emptyTicks = 0
  lastMatched = matched
  const signature = matched.map((r) => `${r.cardIndex}:${r.talent!.name}`).join('|')
  if (signature === lastSignature) return
  lastSignature = signature

  const picks = matched
    .filter((r) => r.inBuild)
    .map((r) => ({
      cardIndex: r.cardIndex,
      talentName: r.talent!.name,
      priorityRank: r.priorityRank ?? 999,
      bbox: r.bbox
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
  resetRunRecording()
  if (timer) {
    // restart with the new build's catalog
    stopDetection()
    void watchTick()
  } else {
    pushOverlayWaiting()
    void watchTick()
  }
}

// User pressed Ctrl+Shift+<n> on a talent screen: record card n as picked.
export function logPick(cardIndex: number): void {
  const match = lastMatched.find((m) => m.cardIndex === cardIndex)
  if (!match?.talent) return
  const run = recordRunPick(match.talent)
  if (!run) return
  deps?.overlay()?.webContents.send('overlay:pick-logged', match.talent.name)
}
