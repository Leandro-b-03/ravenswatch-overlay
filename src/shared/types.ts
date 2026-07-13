// Shared types between main, preload, and all renderers.

export type TalentType = 'starting' | 'normal' | 'ultimate' | string
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'cursed' | string

export interface Talent {
  id: string
  name: string
  type: TalentType
  rarity: Rarity
  iconUrl: string
  descriptions: string[]
}

export interface Hero {
  name: string
  raw_name: string
  description: string
  icon: string
  talents?: Talent[]
}

// Raw shape of the game-heroes endpoint's skill entries.
export interface HeroSkill {
  id: string
  name: string
  tier: number
  icon: string
  descriptions: string[]
}

export function heroSkillsToTalents(skills: HeroSkill[] | undefined): Talent[] {
  return (skills ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    type: `tier-${s.tier}`,
    rarity: 'common',
    iconUrl: s.icon,
    descriptions: s.descriptions ?? []
  }))
}

export interface GameItem {
  id: string
  name: string
  description: string
  effect?: string
  quality?: number
  quality_name?: string
  icon?: string
}

export interface BuildItemRef {
  id: string
  quantity: number
}

export interface Build {
  id: string
  source: 'buildmaker' | 'manual'
  sourceUrl?: string
  hero: string
  title: string
  author?: string
  description?: string
  talents: Talent[]
  items: BuildItemRef[]
  notes?: string
}

export interface CommunityBuildSummary {
  _id: string
  hero: string
  title: string
  talents: Talent[]
  user?: { username: string }
  likes?: string[]
  version?: string
}

export interface CalibrationRegion {
  // Region in game-window coordinates where talent cards appear.
  x: number
  y: number
  width: number
  height: number
  cardCount: number
  // Resolution of the capture this was calibrated against.
  captureWidth: number
  captureHeight: number
}

export interface Settings {
  uiLanguage: string
  gameLanguage: string
  activeBuildId: string | null
  detectionEnabled: boolean
  overlayPosition: { x: number; y: number } | null
  calibrations: Record<string, CalibrationRegion> // key: `${w}x${h}`
  dayPhaseSec: number
  nightPhaseSec: number
}

export type OverlayState =
  | { kind: 'waiting'; heroName: string | null; buildTitle: string | null; tips: string[] }
  | { kind: 'detected'; picks: DetectedPick[]; region: CalibrationRegion }
  | { kind: 'no-match'; region: CalibrationRegion }

// Rectangle in game-capture pixel coordinates.
export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DetectedPick {
  cardIndex: number
  talentName: string
  priorityRank: number // 1-based position in the build's talent order
  // Where the talent name was found (full-frame mode); highlights anchor here.
  bbox?: CaptureRect
}

export interface OcrCardResult {
  cardIndex: number
  text: string
}

export interface MatchResult {
  cardIndex: number
  talent: Talent | null
  score: number
  inBuild: boolean
  priorityRank: number | null
  bbox?: CaptureRect
}

export interface CaptureSource {
  id: string
  name: string
  thumbnailDataUrl: string
}

// Game languages selectable for OCR. BuildMaker localizes talent names for
// some (verified: en/fr/es); others fall back to English names unless a
// translation override file provides them (see api.ts applyNameOverrides).
export const SUPPORTED_LANGUAGES: { code: string; label: string; tesseract: string }[] = [
  { code: 'en', label: 'English', tesseract: 'eng' },
  { code: 'pt', label: 'Português (Brasil)', tesseract: 'por' },
  { code: 'fr', label: 'Français', tesseract: 'fra' },
  { code: 'es', label: 'Español', tesseract: 'spa' },
  { code: 'de', label: 'Deutsch', tesseract: 'deu' },
  { code: 'it', label: 'Italiano', tesseract: 'ita' },
  { code: 'pl', label: 'Polski', tesseract: 'pol' },
  { code: 'ru', label: 'Русский', tesseract: 'rus' }
]
