# Ravenswatch Overlay

A transparent desktop overlay companion for **Ravenswatch**. Import your build
from [BuildMaker](https://buildmaker.ravenswatch.com/), and during a run the
overlay reads the talent-choice screen and highlights which card to pick.
See [CLAUDE.md](CLAUDE.md) for the full project brief and architecture.

## Install

Grab the latest version from the
[releases page](https://github.com/Leandro-b-03/ravenswatch-overlay/releases):

- **`Ravenswatch.Overlay.Setup.<version>.exe`** — one-click installer.
- **`RavenswatchOverlay-<version>-win-unpacked.zip`** — portable: unzip
  anywhere and run `Ravenswatch Overlay.exe`, no install needed.

The binaries are not code-signed yet, so Windows SmartScreen will warn on
first launch — choose **More info → Run anyway**.

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
- **Talent detection** — fully automatic: when the game window is found and a
  build is active, a loop scans the screen, OCRs the talent names (Tesseract),
  fuzzy-matches against the hero's catalog, and highlights the recommended
  card in place (pulsing border + arrow + priority rank) — or shows
  "no priority here — reroll?" when nothing from your build is offered.
  **No calibration required**: by default the whole game frame is scanned and
  names are located by their OCR positions. Calibrating a fixed card region
  (Calibration tab) is optional and makes scans faster and boxes more precise.
- **Run recorder** — press `Ctrl+Shift+1/2/3` on a talent screen to log which
  card you actually took. Picks accumulate into a new build named
  "<active build> — run <date>" (baseline noted), so every run leaves a
  reusable record even when you deviate from the plan.
- **Run timer** — day/night phase countdown with day counter; phase lengths
  adjustable in Settings; start/pause/skip via hotkeys.
- **Pick tally** — T/L/C counters on the HUD (click in interactive mode) plus
  a run reset.
- **Player tips** — the build author's guide (and your own notes on manual
  builds) rotates as compact TIP lines on the HUD every 20 s or via hotkey.
- **Movable HUD** — drag it anywhere in interactive mode; position persists.
- **Multi-language** — talent catalogs and OCR language packs follow the game
  language setting. Languages BuildMaker doesn't localize fall back to English
  matching (the Settings tab warns you). CJK is out of scope for v1.

## Hotkeys

| Keys | Action |
|---|---|
| `Ctrl+Shift+O` | Toggle overlay interactive mode (drag the HUD to reposition it) |
| `Ctrl+Shift+S` | Scan the talent screen once |
| `Ctrl+Shift+P` | Open the control panel |
| `Ctrl+Shift+T` | Start/pause the run timer |
| `Ctrl+Shift+N` | Skip to the next phase (day ↔ night) |
| `Ctrl+Shift+H` | Show the next tip from the build guide |
| `Ctrl+Shift+1/2/3` | Log the card you picked (left/middle/right) to the run record |

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
2. My Builds → import or create a build → Set active.
3. That's it — detection starts by itself when the game window is found. The
   overlay's status line tells you if anything is missing.
4. Optional: Calibration → drag a box over the talent-card area on a level-up
   screen for faster scans and tighter highlight boxes.

`npx tsx scripts/fullframe-bench.ts` validates the calibration-free pipeline
headless (synthesizes a 1080p talent screen and checks names + positions).

## Data & privacy

Everything is local: builds and settings in `%APPDATA%/ravenswatch-overlay/`,
catalogs cached for offline use. The app only calls buildmaker.ravenswatch.com
(undocumented public API) to fetch heroes, talents, items, and builds.

## Credits

- Hero, talent, item, and community-build data comes from
  [Ravenswatch BuildMaker](https://buildmaker.ravenswatch.com/), the official
  build-planning site for the game — plan your builds there. This app talks to
  its public but undocumented API, so breakage on their updates is on us, not
  them.
- **Ravenswatch** © 2023 [Nacon](https://www.nacongaming.com/), developed by
  [Passtech Games](https://www.passtechgames.com/). All game content, names,
  and artwork belong to them.
- This overlay is an unofficial fan-made companion tool. It is not affiliated
  with, endorsed by, or supported by Nacon, Passtech Games, or the BuildMaker
  team.
