// Hidden detection worker: captures the game window, preprocesses the
// calibrated talent region, OCRs each card, fuzzy-matches against the hero
// catalog, and reports MatchResults back to main.
//
// Latency notes: cards are OCRed in parallel via a tesseract scheduler, card
// crops are scaled to a fixed target width instead of a blanket 2x upscale
// (at 1440p+ that upscale tripled OCR time for no accuracy gain), and a
// cheap frame hash skips OCR entirely while the region is unchanged.

import { createScheduler, createWorker, type Scheduler } from 'tesseract.js'
import { matchCard } from '../../shared/matching'
import { preprocessPixels } from '../../shared/preprocess'
import type {
  Build,
  CalibrationRegion,
  MatchResult,
  Talent
} from '../../shared/types'

const OCR_WORKERS = 3
const TARGET_CARD_WIDTH = 480 // px fed to tesseract per card

const video = document.getElementById('capture-video') as HTMLVideoElement

interface WorkerConfig {
  sourceId: string
  calibrations: Record<string, CalibrationRegion>
  catalog: Talent[]
  build: Build
  tesseractLang: string
}

let config: WorkerConfig | null = null
let scheduler: Scheduler | null = null
let ocrLang = ''
let stream: MediaStream | null = null
let busy = false
let lastFrameHash = ''
let lastHadMatches = false

window.overlayAPI.onWorkerConfigure(async (cfg) => {
  config = cfg
  lastFrameHash = ''
  try {
    await Promise.all([ensureStream(cfg.sourceId), ensureOcr(cfg.tesseractLang)])
    window.overlayAPI.sendWorkerReady()
  } catch (err) {
    console.error('worker configure failed', err)
  }
})

window.overlayAPI.onWorkerScan(async () => {
  if (!config || busy) return
  busy = true
  try {
    const results = await scan()
    if (results) window.overlayAPI.sendWorkerResults(results.matches, results.region)
  } catch (err) {
    console.error('scan failed', err)
  } finally {
    busy = false
  }
})

async function ensureStream(sourceId: string): Promise<void> {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    stream = null
  }
  // Electron routes desktop capture through getUserMedia with mandatory
  // chromeMediaSource constraints (not in standard TS lib types).
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: 3840,
        maxHeight: 2160
      }
    } as any
  })
  video.srcObject = stream
  await video.play()
}

async function ensureOcr(lang: string): Promise<void> {
  if (scheduler && ocrLang === lang) return
  if (scheduler) await scheduler.terminate()
  scheduler = createScheduler()
  const workers = await Promise.all(
    Array.from({ length: OCR_WORKERS }, () => createWorker(lang))
  )
  for (const w of workers) scheduler.addWorker(w)
  ocrLang = lang
}

function pickCalibration(w: number, h: number): CalibrationRegion | null {
  if (!config) return null
  const exact = config.calibrations[`${w}x${h}`]
  if (exact) return exact
  // Scale the closest stored calibration to the current capture size.
  const entries = Object.values(config.calibrations)
  if (entries.length === 0) return null
  const closest = entries.reduce((a, b) =>
    Math.abs(a.captureWidth - w) < Math.abs(b.captureWidth - w) ? a : b
  )
  const sx = w / closest.captureWidth
  const sy = h / closest.captureHeight
  return {
    ...closest,
    x: Math.round(closest.x * sx),
    y: Math.round(closest.y * sy),
    width: Math.round(closest.width * sx),
    height: Math.round(closest.height * sy),
    captureWidth: w,
    captureHeight: h
  }
}

// Tiny grayscale signature of the region — used to skip OCR on static frames.
function frameHash(region: CalibrationRegion): string {
  const c = document.createElement('canvas')
  c.width = 48
  c.height = 12
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, 48, 12)
  const px = ctx.getImageData(0, 0, 48, 12).data
  let hash = ''
  for (let i = 0; i < px.length; i += 16) {
    hash += ((px[i] + px[i + 1] + px[i + 2]) >> 6).toString(36)
  }
  return hash
}

async function scan(): Promise<{ matches: MatchResult[]; region: CalibrationRegion } | null> {
  if (!config || !scheduler) return null
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null

  const region = pickCalibration(w, h)
  if (!region) return null

  // Static frame? Nothing to re-OCR. Report empty only if the last real scan
  // also had no matches (keeps the empty-tick debounce in main honest).
  const hash = frameHash(region)
  if (hash === lastFrameHash) {
    return lastHadMatches ? null : { matches: [], region }
  }
  lastFrameHash = hash

  const cardWidth = region.width / region.cardCount
  const canvases: HTMLCanvasElement[] = []
  for (let i = 0; i < region.cardCount; i++) {
    canvases.push(
      preprocess(region.x + Math.round(i * cardWidth), region.y, Math.round(cardWidth), region.height)
    )
  }

  const texts = await Promise.all(
    canvases.map((canvas) =>
      scheduler!.addJob('recognize', canvas).then((r) => r.data.text)
    )
  )
  const matches = texts.map((text, i) => matchCard(i, text, config!.catalog, config!.build))
  lastHadMatches = matches.some((m) => m.talent !== null)
  return { matches, region }
}

// crop → scale toward TARGET_CARD_WIDTH → grayscale/contrast/invert
function preprocess(sx: number, sy: number, sw: number, sh: number): HTMLCanvasElement {
  const scale = Math.min(2, Math.max(0.75, TARGET_CARD_WIDTH / Math.max(1, sw)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  preprocessPixels(img.data)
  ctx.putImageData(img, 0, 0)
  return canvas
}
