import type { OverlayAPI } from './index'

declare global {
  interface Window {
    overlayAPI: OverlayAPI
  }
}
