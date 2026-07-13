# Ravenswatch Overlay

A transparent desktop overlay companion for **Ravenswatch**. Import your build
from [BuildMaker](https://buildmaker.ravenswatch.com/), and during a run the
overlay reads the talent-choice screen and highlights which card to pick.
See [CLAUDE.md](CLAUDE.md) for the full project brief and architecture.

## Features

- **Overlay HUD** — transparent, always-on-top, click-through window over the
  game showing the active hero/build, a run timer, and detection status.
- **Splash screen** on startup, **tray icon** (double-click opens the panel).
- **Control panel** with five tabs:
  - **My Builds** — your saved builds; import via share URL, set active, delete.
  - **Browse** — community builds from buildmaker.ravenswatch.com per hero,
    one-click import.
  - **Editor** — build a plan manually: pick a hero, click talents from the
    full catalog, drag to set priority order.
  - **Calibration** — live capture preview of the game window; drag a box over
    the talent-card area once per resolution.
  - **Settings** — game language (en/fr/es/de/it/pl/ru) with localization
    check, hotkey reference.
- **Talent detection** — automatic ~1 Hz loop (or one-shot hotkey): captures
  the calibrated region, OCRs each card (Tesseract), fuzzy-matches against the
  hero's talent catalog, and flashes **★ PICK: <talent>** with its priority
  rank when a card is in your build — or "no priority here — reroll?" when not.
- **Multi-language** — talent catalogs and OCR language packs follow the game
  language setting. Languages BuildMaker doesn't localize fall back to English
  matching (the Settings tab warns you). CJK is out of scope for v1.

## Hotkeys

| Keys | Action |
|---|---|
| `Ctrl+Shift+O` | Toggle overlay interactive mode (move/inspect vs click-through) |
| `Ctrl+Shift+S` | Scan the talent screen once |
| `Ctrl+Shift+P` | Open the control panel |

## Requirements

- Windows 10/11. Node.js 18+ for development (not needed for the installer).
- Ravenswatch in **borderless windowed** mode (Options → Display). Exclusive
  fullscreen is unsupported by design — we use an external transparent window
  (no injection, no anticheat/EULA risk, can't crash the game). DLL/DXGI
  hooking (Option B in CLAUDE.md) was consciously rejected.

## Development

```bash
npm install
npm run dev          # dev mode with hot reload
npm run typecheck    # strict TS across main/preload/renderers
npm run ocr-bench    # headless OCR+matching over test-assets/*.png
npm run dist         # build the NSIS installer into dist/
```

### OCR bench

Drop talent-screen screenshots into `test-assets/`. Name them
`anything__Expected_Talent_Name.png` to score accuracy:

```bash
npm run ocr-bench -- --hero merlin --lang en
```

### First run with the game

1. Start Ravenswatch (borderless windowed), start the overlay.
2. Control panel → Calibration → "Find game window" → drag a box over the
   talent-card area (do this on the level-up screen) → Save region.
3. My Builds → import or create a build → Set active.
4. Click "Start detection" (or press `Ctrl+Shift+S` on a talent screen).

## Data & privacy

Everything is local: builds and settings in `%APPDATA%/ravenswatch-overlay/`,
catalogs cached for offline use. The app only calls buildmaker.ravenswatch.com
(unofficial public API) to fetch heroes, talents, items, and builds.
