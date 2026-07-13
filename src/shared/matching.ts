// Pure text-normalization and fuzzy-matching functions.
// Kept dependency-free so the headless ocr-bench script can import them.

import type { Talent, Build, CaptureRect, MatchResult } from './types'

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

// Similarity in [0,1]: 1 = identical after normalization.
export function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  const dist = levenshtein(na, nb)
  return 1 - dist / Math.max(na.length, nb.length)
}

// OCR text for a card may contain the talent name plus description fragments.
// Slide a window of the talent name's token length across the OCR tokens and
// keep the best window similarity.
export function bestWindowSimilarity(ocrText: string, talentName: string): number {
  const nameTokens = normalize(talentName).split(' ')
  const ocrTokens = normalize(ocrText).split(' ')
  if (nameTokens.length === 0 || ocrTokens.length === 0) return 0
  const target = nameTokens.join(' ')
  let best = 0
  if (ocrTokens.length <= nameTokens.length) {
    best = similarity(ocrTokens.join(' '), target)
  } else {
    for (let i = 0; i + nameTokens.length <= ocrTokens.length; i++) {
      const window = ocrTokens.slice(i, i + nameTokens.length).join(' ')
      const s = similarity(window, target)
      if (s > best) best = s
    }
  }
  // A wrapped name can have OCR noise tokens between its lines (card borders
  // read as garbage), defeating the contiguous window. Complement with an
  // order-insensitive per-token match, slightly discounted so exact contiguous
  // matches always win.
  if (nameTokens.length > 1) {
    let sum = 0
    for (const nt of nameTokens) {
      let bestTok = 0
      for (const ot of ocrTokens) {
        const s = similarity(ot, nt)
        if (s > bestTok) bestTok = s
      }
      sum += bestTok
    }
    best = Math.max(best, (sum / nameTokens.length) * 0.95)
  }
  return best
}

export const MATCH_THRESHOLD = 0.72

// Match one card's OCR text against a hero's talent catalog, then rank it
// within the active build (if any).
export function matchCard(
  cardIndex: number,
  ocrText: string,
  catalog: Talent[],
  build: Build | null
): MatchResult {
  let bestTalent: Talent | null = null
  let bestScore = 0
  for (const talent of catalog) {
    const s = bestWindowSimilarity(ocrText, talent.name)
    if (s > bestScore) {
      bestScore = s
      bestTalent = talent
    }
  }
  if (bestScore < MATCH_THRESHOLD) {
    return { cardIndex, talent: null, score: bestScore, inBuild: false, priorityRank: null }
  }
  let inBuild = false
  let priorityRank: number | null = null
  if (build && bestTalent) {
    // Builds may store talent names in another language than the OCR catalog
    // (e.g. a French community build with an English game) — talent ids are
    // stable across languages, so prefer them.
    const idx = build.talents.findIndex(
      (t) =>
        (t.id && bestTalent!.id && t.id === bestTalent!.id) ||
        normalize(t.name) === normalize(bestTalent!.name)
    )
    if (idx >= 0) {
      inBuild = true
      priorityRank = idx + 1
    }
  }
  return { cardIndex, talent: bestTalent, score: bestScore, inBuild, priorityRank }
}

export interface OcrWord {
  text: string
  bbox: CaptureRect
}

export interface OcrLine {
  text: string
  bbox: CaptureRect
  words?: OcrWord[]
}

function rankInBuild(talent: Talent, build: Build | null): { inBuild: boolean; rank: number | null } {
  if (!build) return { inBuild: false, rank: null }
  const idx = build.talents.findIndex(
    (bt) => (bt.id && talent.id && bt.id === talent.id) || normalize(bt.name) === normalize(talent.name)
  )
  return idx >= 0 ? { inBuild: true, rank: idx + 1 } : { inBuild: false, rank: null }
}

function unionRect(rects: CaptureRect[]): CaptureRect {
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y
  }
}

function rectsOverlap(a: CaptureRect, b: CaptureRect): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  )
}

// Full-frame mode: match catalog talents against OCR output of the whole
// game frame. Matching happens at WORD level — tesseract merges the 2-3 card
// names sitting at the same height into a single wide "line", so the matched
// words' own boxes are the only reliable position. Wrapped names are covered
// by chaining each line's words with the next line's.
export function matchLines(
  lines: OcrLine[],
  catalog: Talent[],
  build: Build | null
): MatchResult[] {
  interface Candidate {
    talent: Talent
    score: number
    bbox: CaptureRect
  }

  // word sequences to probe: each line's words, plus line joined with next
  const sequences: OcrWord[][] = []
  for (let i = 0; i < lines.length; i++) {
    const words = lines[i].words?.length
      ? lines[i].words!
      : [{ text: lines[i].text, bbox: lines[i].bbox }]
    sequences.push(words)
    const next = lines[i + 1]
    if (next) {
      const a = lines[i].bbox
      const b = next.bbox
      const closeBelow = b.y - (a.y + a.height) < a.height * 1.5
      const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0
      if (closeBelow && xOverlap) {
        const nextWords = next.words?.length ? next.words : [{ text: next.text, bbox: next.bbox }]
        sequences.push([...words, ...nextWords])
      }
    }
  }

  const allWords: OcrWord[] = sequences.length
    ? lines.flatMap((ln) => (ln.words?.length ? ln.words : [{ text: ln.text, bbox: ln.bbox }]))
    : []

  const candidates: Candidate[] = []
  for (const talent of catalog) {
    const nameTokens = normalize(talent.name).split(' ')
    const target = nameTokens.join(' ')
    let best: Candidate | null = null
    for (const seq of sequences) {
      // window sizes n and n+1 (OCR sometimes splits a word in two)
      for (const span of [nameTokens.length, nameTokens.length + 1]) {
        for (let i = 0; i + span <= seq.length; i++) {
          const windowWords = seq.slice(i, i + span)
          const s = similarity(windowWords.map((w) => w.text).join(' '), target)
          if (s >= MATCH_THRESHOLD && (!best || s > best.score)) {
            best = { talent, score: s, bbox: unionRect(windowWords.map((w) => w.bbox)) }
          }
        }
      }
    }
    // Wrapped two-word name: first word with the second one right beneath it.
    // (Cards wrap long names; tesseract puts the halves in different lines,
    // and merged multi-card lines put them far apart in reading order.)
    if (nameTokens.length === 2) {
      for (const a of allWords) {
        if (similarity(a.text, nameTokens[0]) < 0.7) continue
        for (const b of allWords) {
          const dy = b.bbox.y - (a.bbox.y + a.bbox.height)
          const xOverlap =
            Math.min(a.bbox.x + a.bbox.width, b.bbox.x + b.bbox.width) -
            Math.max(a.bbox.x, b.bbox.x)
          if (dy < -a.bbox.height * 0.2 || dy > a.bbox.height * 2 || xOverlap <= 0) continue
          const s = similarity(`${a.text} ${b.text}`, target)
          if (s >= MATCH_THRESHOLD && (!best || s > best.score)) {
            best = { talent, score: s, bbox: unionRect([a.bbox, b.bbox]) }
          }
        }
      }
    }
    if (best) candidates.push(best)
  }

  // Greedy non-overlap: highest scores claim their screen area first.
  candidates.sort((a, b) => b.score - a.score)
  const accepted: Candidate[] = []
  for (const c of candidates) {
    if (!accepted.some((a) => rectsOverlap(a.bbox, c.bbox))) accepted.push(c)
  }

  return accepted
    .sort((a, b) => a.bbox.x - b.bbox.x)
    .map((c, i) => {
      const { inBuild, rank } = rankInBuild(c.talent, build)
      return {
        cardIndex: i,
        talent: c.talent,
        score: c.score,
        inBuild,
        priorityRank: rank,
        bbox: c.bbox
      }
    })
}
