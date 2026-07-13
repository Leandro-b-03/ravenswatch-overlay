// Headless OCR benchmark: runs the OCR + fuzzy-match pipeline over
// test-assets/*.png without the game or the app running.
//
//   npm run ocr-bench                          # match against every hero (en)
//   npm run ocr-bench -- --hero merlin --lang en
//
// Screenshot naming convention (optional, enables accuracy scoring):
//   <anything>__<expected talent name with _ for spaces>.png
//   e.g. talent-screen-1__Sacred_Strike.png

import { createWorker } from 'tesseract.js'
import { Jimp } from 'jimp'
import { readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { bestWindowSimilarity, MATCH_THRESHOLD, normalize } from '../src/shared/matching'
import { preprocessPixels } from '../src/shared/preprocess'
import { heroSkillsToTalents } from '../src/shared/types'
import type { HeroSkill, Talent } from '../src/shared/types'

const SITE = 'https://buildmaker.ravenswatch.com'
const ASSETS = resolve(__dirname, '../test-assets')

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function fetchCatalog(hero: string, lang: string): Promise<Talent[]> {
  const res = await fetch(`${SITE}/api/game-heroes/${hero}?lang=${lang}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for hero ${hero}`)
  const data = (await res.json()) as { skills?: HeroSkill[] }
  return heroSkillsToTalents(data.skills)
}

async function allHeroNames(lang: string): Promise<string[]> {
  const res = await fetch(`${SITE}/api/game-heroes/?lang=${lang}`)
  const heroes = (await res.json()) as { raw_name: string }[]
  return heroes.map((h) => h.raw_name)
}

async function main(): Promise<void> {
  if (!existsSync(ASSETS)) {
    console.error(`No test-assets/ directory found at ${ASSETS}.`)
    console.error('Save talent-screen screenshots there (PNG) and re-run.')
    process.exit(1)
  }
  const files = readdirSync(ASSETS).filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  if (files.length === 0) {
    console.error('test-assets/ has no images.')
    process.exit(1)
  }

  const lang = arg('lang', 'en')
  const heroArg = arg('hero', '')
  const tessLang = arg('tesseract', 'eng')

  console.log(`Loading talent catalogs (${lang})…`)
  const heroList = heroArg ? [heroArg] : await allHeroNames(lang)
  const catalogs = new Map<string, Talent[]>()
  for (const h of heroList) {
    catalogs.set(h, await fetchCatalog(h, lang))
  }

  const worker = await createWorker(tessLang)
  let scored = 0
  let correct = 0

  for (const file of files) {
    const t0 = Date.now()
    // Same pipeline as the live worker: 2x upscale + grayscale/contrast/invert.
    const image = await Jimp.read(join(ASSETS, file))
    image.scale(2)
    preprocessPixels(image.bitmap.data)
    const buffer = await image.getBuffer('image/png')
    const { data } = await worker.recognize(buffer)
    const ms = Date.now() - t0

    let best: { hero: string; talent: string; score: number } | null = null
    for (const [hero, talents] of catalogs) {
      for (const t of talents) {
        const s = bestWindowSimilarity(data.text, t.name)
        if (!best || s > best.score) best = { hero, talent: t.name, score: s }
      }
    }

    const expected = file.match(/__(.+)\.(png|jpg|jpeg)$/i)?.[1]?.replace(/_/g, ' ')
    let verdict = ''
    if (expected && best) {
      scored++
      const hit =
        best.score >= MATCH_THRESHOLD && normalize(best.talent) === normalize(expected)
      if (hit) correct++
      verdict = hit ? '  ✓' : `  ✗ expected “${expected}”`
    }
    const label = best
      ? `${best.talent} [${best.hero}] score=${best.score.toFixed(2)}${best.score < MATCH_THRESHOLD ? ' (below threshold)' : ''}`
      : 'no match'
    console.log(`${file}  →  ${label}  (${ms} ms)${verdict}`)
  }

  if (scored > 0) {
    console.log(`\nAccuracy: ${correct}/${scored} labeled screenshots matched.`)
  }
  await worker.terminate()
}

void main()
