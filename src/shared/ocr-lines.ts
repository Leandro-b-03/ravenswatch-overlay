// Flattens tesseract.js `blocks: true` output into OcrLines (with per-word
// boxes) in capture coordinates, undoing the pre-OCR downscale.

import type { OcrLine, OcrWord } from './matching'

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRect(bbox: any, scale: number): { x: number; y: number; width: number; height: number } {
  return {
    x: bbox.x0 / scale,
    y: bbox.y0 / scale,
    width: (bbox.x1 - bbox.x0) / scale,
    height: (bbox.y1 - bbox.y0) / scale
  }
}

export function collectLines(data: any, scale: number): OcrLine[] {
  const lines: OcrLine[] = []
  const walk = (node: any): void => {
    if (!node) return
    if (Array.isArray(node.lines)) {
      for (const ln of node.lines) {
        if (!ln?.text || !ln?.bbox) continue
        const words: OcrWord[] = Array.isArray(ln.words)
          ? ln.words
              .filter((w: any) => w?.text && w?.bbox)
              .map((w: any) => ({ text: String(w.text), bbox: toRect(w.bbox, scale) }))
          : []
        lines.push({ text: String(ln.text), bbox: toRect(ln.bbox, scale), words })
      }
    }
    for (const key of ['blocks', 'paragraphs']) {
      if (Array.isArray(node[key])) node[key].forEach(walk)
    }
  }
  walk(data)
  return lines
}
/* eslint-enable @typescript-eslint/no-explicit-any */
