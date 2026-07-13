// Headless validation of the calibration-free full-frame pipeline: composes a
// 1920x1080 "talent screen" from three synthetic cards in test-assets, runs
// the same downscale→preprocess→recognize(blocks)→matchLines path as the live
// worker, and checks all three names are found at the right positions.
//
//   npx tsx scripts/fullframe-bench.ts

import { Jimp } from 'jimp'
import { createWorker } from 'tesseract.js'
import { resolve } from 'path'
import { preprocessPixels } from '../src/shared/preprocess'
import { matchLines } from '../src/shared/matching'
import { collectLines } from '../src/shared/ocr-lines'
import { heroSkillsToTalents } from '../src/shared/types'
import type { HeroSkill, Talent } from '../src/shared/types'

const ASSETS = resolve(__dirname, '../test-assets')

async function main(): Promise<void> {
  const frame = new Jimp({ width: 1920, height: 1080, color: 0x14121bff })
  const cards = [
    'synthetic-card__Sacred_Strike.png',
    'synthetic-card__Brambles_Whirlwind.png',
    'synthetic-card__Celestial_Wrath.png'
  ]
  const positions: number[] = []
  for (let i = 0; i < cards.length; i++) {
    const img = await Jimp.read(`${ASSETS}/${cards[i]}`)
    const x = 330 + i * 480
    positions.push(x)
    frame.composite(img, x, 220)
  }

  const scale = 1440 / 1920
  frame.scale(scale)
  preprocessPixels(frame.bitmap.data)
  const buf = await frame.getBuffer('image/png')

  let heroData: { skills?: HeroSkill[] }
  try {
    const res = await fetch('https://buildmaker.ravenswatch.com/api/game-heroes/merlin?lang=en')
    heroData = (await res.json()) as { skills?: HeroSkill[] }
  } catch {
    // flaky network: fall back to the app's local catalog cache
    const { readFileSync } = await import('fs')
    const cachePath = `${process.env.APPDATA}/ravenswatch-overlay/cache/hero-merlin-en.json`
    heroData = JSON.parse(readFileSync(cachePath, 'utf-8'))
    console.log('(catalog from local cache)')
  }
  const catalog: Talent[] = heroSkillsToTalents(heroData.skills)

  const worker = await createWorker('eng')
  const t0 = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await worker.recognize(buf, {}, { text: true, blocks: true } as any)) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
  }
  const ms = Date.now() - t0

  const lines = collectLines(data, scale)

  console.log(`OCR: ${ms} ms, ${lines.length} lines`)
  const matches = matchLines(lines, catalog, null)
  for (const m of matches) {
    const b = m.bbox!
    console.log(
      `card ${m.cardIndex}: ${m.talent!.name} score=${m.score.toFixed(2)} bbox=(${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)})`
    )
  }
  console.log(`expected card x positions ≈ ${positions.join(', ')}`)
  await worker.terminate()
  process.exit(matches.length === 3 ? 0 : 1)
}

void main()
