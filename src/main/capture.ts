import { desktopCapturer } from 'electron'
import type { CaptureSource } from '../shared/types'
import { isOwnAppWindow, pickGameSource } from '../shared/game-window'

// Source discovery only — actual frame grabbing happens in the hidden worker
// renderer via getUserMedia with the chosen chromeMediaSourceId.

export async function listCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 }
  })
  return sources
    .filter((s) => !isOwnAppWindow(s.name)) // never offer this app's own windows
    .map((s) => ({
      id: s.id,
      name: s.name,
      thumbnailDataUrl: s.thumbnail.toDataURL()
    }))
}

export async function findGameSource(): Promise<CaptureSource | null> {
  return pickGameSource(await listCaptureSources())
}
