import type {
  Build,
  CommunityBuildSummary,
  GameItem,
  Hero,
  HeroSkill,
  Talent
} from '../shared/types'
import { heroSkillsToTalents } from '../shared/types'
import { readCache, writeCache } from './store'

// BuildMaker's APIs are unofficial: every fetch falls back to the local cache
// so the app keeps working offline or if the site changes.

const SITE = 'https://buildmaker.ravenswatch.com'
const UA = 'RavenswatchOverlay/0.1 (+local companion app)'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return (await res.json()) as T
}

async function cached<T>(cacheKey: string, url: string): Promise<T> {
  try {
    const fresh = await getJson<T>(url)
    writeCache(cacheKey, fresh)
    return fresh
  } catch (err) {
    const stale = readCache<T>(cacheKey)
    if (stale) return stale
    throw err
  }
}

export function fetchHeroes(lang: string): Promise<Hero[]> {
  return cached<Hero[]>(`heroes-${lang}`, `${SITE}/api/game-heroes/?lang=${lang}`)
}

export async function fetchHero(rawName: string, lang: string): Promise<Hero> {
  const raw = await cached<Hero & { skills?: HeroSkill[] }>(
    `hero-${rawName}-${lang}`,
    `${SITE}/api/game-heroes/${rawName}?lang=${lang}`
  )
  return { ...raw, talents: applyNameOverrides(heroSkillsToTalents(raw.skills), lang) }
}

// Community/user-provided localized talent names for languages BuildMaker
// doesn't translate (e.g. pt). Files map talent UUID → localized name:
//   <resources>/translations/<lang>.json   (shipped with the app)
//   <userData>/translations/<lang>.json    (user-editable, wins on conflict)
function loadNameOverrides(lang: string): Record<string, string> {
  const { app } = require('electron') as typeof import('electron')
  const { readFileSync } = require('fs') as typeof import('fs')
  const { join } = require('path') as typeof import('path')
  const bases = [
    app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'),
    app.getPath('userData')
  ]
  const merged: Record<string, string> = {}
  for (const base of bases) {
    try {
      const data = JSON.parse(
        readFileSync(join(base, 'translations', `${lang}.json`), 'utf-8')
      ) as Record<string, string>
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith('_')) merged[k] = v // "_readme" etc. are documentation keys
      }
    } catch {
      /* file absent — fine */
    }
  }
  return merged
}

function applyNameOverrides(talents: Talent[], lang: string): Talent[] {
  if (lang === 'en') return talents
  const overrides = loadNameOverrides(lang)
  if (Object.keys(overrides).length === 0) return talents
  return talents.map((t) => (overrides[t.id] ? { ...t, name: overrides[t.id] } : t))
}

export function fetchItems(): Promise<GameItem[]> {
  return cached<GameItem[]>('items', `${SITE}/api/game-items/`)
}

export async function fetchCommunityBuilds(
  hero: string,
  page: number
): Promise<CommunityBuildSummary[]> {
  const data = await getJson<{ builds: CommunityBuildSummary[] }>(
    `${SITE}/backend/builds?hero=${encodeURIComponent(hero)}&page=${page}`
  )
  return data.builds ?? []
}

export function parseBuildId(input: string): string | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/buildmaker\.ravenswatch\.com\/build\/([a-f0-9]{24})/i)
  if (urlMatch) return urlMatch[1]
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return trimmed
  return null
}

interface RemoteBuild {
  _id: string
  hero: string
  title: string
  description?: string
  talents: Talent[]
  items: { id: string; quantity: number }[]
  user?: { username: string }
}

export async function fetchBuild(id: string): Promise<Build> {
  const data = await getJson<{ result: boolean; build: RemoteBuild }>(
    `${SITE}/backend/builds/${id}`
  )
  if (!data.result || !data.build) throw new Error('Build not found')
  const b = data.build
  return {
    id: b._id,
    source: 'buildmaker',
    sourceUrl: `${SITE}/build/${b._id}`,
    hero: b.hero,
    title: b.title,
    author: b.user?.username,
    description: b.description,
    talents: b.talents ?? [],
    items: b.items ?? []
  }
}

// The hero endpoint returns English names when a language isn't localized.
// Detect that so the UI can warn the user their OCR will match English text.
// A translation override file also counts as localized.
export async function isLanguageLocalized(lang: string): Promise<boolean> {
  if (lang === 'en') return true
  if (Object.keys(loadNameOverrides(lang)).length > 0) return true
  const [en, other] = await Promise.all([fetchHero('merlin', 'en'), fetchHero('merlin', lang)])
  const enNames = (en.talents ?? []).map((t) => t.name).join('|')
  const otherNames = (other.talents ?? []).map((t) => t.name).join('|')
  return enNames !== otherNames
}
