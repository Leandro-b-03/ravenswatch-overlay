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

// Best-effort auto-pick: a window whose title contains "ravenswatch".
export async function findGameSource(): Promise<CaptureSource | null> {
  const sources = await listCaptureSources()
  return sources.find((s) => s.name.toLowerCase().includes('ravenswatch')) ?? null
}
