// Pure text-normalization and fuzzy-matching functions.
// Kept dependency-free so the headless ocr-bench script can import them.

import type { Talent, Build, MatchResult } from './types'

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
