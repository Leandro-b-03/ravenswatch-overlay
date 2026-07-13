import { desktopCapturer } from 'electron'
import type { CaptureSource } from '../shared/types'

// Source discovery only — actual frame grabbing happens in the hidden worker
// renderer via getUserMedia with the chosen chromeMediaSourceId.

export async function listCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 }
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.toDataURL()
  }))
}

// Windows that contain "ravenswatch" but are NOT the game: this app's own
// windows, the project folder in Explorer, browser tabs about the game, etc.
const NOT_THE_GAME = /overlay|explorer|panel|visual studio|code|chrome|edge|firefox|discord/i

export function looksLikeGameWindow(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n.includes('ravenswatch')) return false
  if (NOT_THE_GAME.test(n)) return false
  return true
}

export async function findGameSource(): Promise<CaptureSource | null> {
  const sources = await listCaptureSources()
  // Exact title first (the game window is titled just "Ravenswatch"),
  // then any plausible non-app match.
  return (
    sources.find((s) => s.name.trim().toLowerCase() === 'ravenswatch') ??
    sources.find((s) => looksLikeGameWindow(s.name)) ??
    null
  )
}
