import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import type { Build, Settings } from '../shared/types'

// Plain JSON-file persistence. electron-store v10 is ESM-only which fights
// electron-vite's CJS main output, and our needs are trivial.

interface StoreData {
  settings: Settings
  builds: Build[]
}

const DEFAULTS: StoreData = {
  settings: {
    gameLanguage: 'en',
    activeBuildId: null,
    detectionEnabled: false,
    overlayPosition: null,
    calibrations: {}
  },
  builds: []
}

let data: StoreData | null = null

function storePath(): string {
  return join(app.getPath('userData'), 'store.json')
}

export function cacheDir(): string {
  const dir = join(app.getPath('userData'), 'cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function load(): StoreData {
  if (data) return data
  try {
    const raw = readFileSync(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoreData>
    data = {
      settings: { ...DEFAULTS.settings, ...parsed.settings },
      builds: parsed.builds ?? []
    }
  } catch {
    data = structuredClone(DEFAULTS)
  }
  return data
}

function save(): void {
  if (!data) return
  writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export function getSettings(): Settings {
  return load().settings
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const d = load()
  d.settings = { ...d.settings, ...patch }
  save()
  return d.settings
}

export function getBuilds(): Build[] {
  return load().builds
}

export function getBuild(id: string): Build | undefined {
  return load().builds.find((b) => b.id === id)
}

export function getActiveBuild(): Build | null {
  const d = load()
  if (!d.settings.activeBuildId) return null
  return d.builds.find((b) => b.id === d.settings.activeBuildId) ?? null
}

export function saveBuild(build: Build): void {
  const d = load()
  const idx = d.builds.findIndex((b) => b.id === build.id)
  if (idx >= 0) d.builds[idx] = build
  else d.builds.push(build)
  save()
}

export function deleteBuild(id: string): void {
  const d = load()
  d.builds = d.builds.filter((b) => b.id !== id)
  if (d.settings.activeBuildId === id) d.settings.activeBuildId = null
  save()
}

// Generic JSON cache helpers (hero catalogs, item catalog).
export function readCache<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(cacheDir(), `${name}.json`), 'utf-8')) as T
  } catch {
    return null
  }
}

export function writeCache(name: string, value: unknown): void {
  writeFileSync(join(cacheDir(), `${name}.json`), JSON.stringify(value), 'utf-8')
}
