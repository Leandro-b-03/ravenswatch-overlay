// Hidden detection worker: captures the game window, preprocesses the
// calibrated talent region, OCRs each card, fuzzy-matches against the hero
// catalog, and reports MatchResults back to main.

import { createWorker, type Worker as TesseractWorker } from 'tesseract.js'
import { matchCard } from '../../shared/matching'
import { preprocessPixels } from '../../shared/preprocess'
import type {
  Build,
  CalibrationRegion,
  MatchResult,
  Talent
} from '../../shared/types'

const video = document.getElementById('capture-video') as HTMLVideoElement

interface WorkerConfig {
  sourceId: string
  calibrations: Record<string, CalibrationRegion>
  catalog: Talent[]
  build: Build
  tesseractLang: string
}

let config: WorkerConfig | null = null
let ocr: TesseractWorker | null = null
let ocrLang = ''
let stream: MediaStream | null = null
let busy = false

window.overlayAPI.onWorkerConfigure(async (cfg) => {
  config = cfg
  await Promise.all([ensureStream(cfg.sourceId), ensureOcr(cfg.tesseractLang)])
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
    stream.getTracks().forEach((t) => t.stop())
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
  if (ocr && ocrLang === lang) return
  if (ocr) await ocr.terminate()
  ocr = await createWorker(lang)
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

async function scan(): Promise<{ matches: MatchResult[]; region: CalibrationRegion } | null> {
  if (!config || !ocr) return null
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null

  const region = pickCalibration(w, h)
  if (!region) return null

  const matches: MatchResult[] = []
  const cardWidth = region.width / region.cardCount

  for (let i = 0; i < region.cardCount; i++) {
    const canvas = preprocess(
      region.x + Math.round(i * cardWidth),
      region.y,
      Math.round(cardWidth),
      region.height
    )
    const { data } = await ocr.recognize(canvas)
    matches.push(matchCard(i, data.text, config.catalog, config.build))
  }
  return { matches, region }
}

// crop → 2x upscale → grayscale → contrast stretch → invert if dark-on-dark.
// Ravenswatch renders light talent text on dark cards; Tesseract reads dark
// text on light background far more reliably.
function preprocess(sx: number, sy: number, sw: number, sh: number): HTMLCanvasElement {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = sw * scale
  canvas.height = sh * scale
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  preprocessPixels(img.data)
  ctx.putImageData(img, 0, 0)
  return canvas
}
