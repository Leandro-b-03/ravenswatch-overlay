# Ravenswatch Overlay — Project Brief

## What we're building

A native desktop overlay companion for **Ravenswatch** (top-down co-op roguelite
by Passtech Games). It renders a small HUD **on top of the game window** in real
time and **reads the game screen** to give build advice during a run.

The user plans builds on https://buildmaker.ravenswatch.com/ before a run. This
tool brings that plan into the game: when a talent choice appears on screen, the
overlay detects it, OCRs the talent names, matches them against the user's
priority list, and highlights which one to pick.

## Core features (v1)

1. **Always-on-top transparent overlay window**
   - Frameless, transparent background, click-through by default
     (mouse events pass to the game).
   - A global hotkey (e.g. `Ctrl+Shift+O`) toggles "interactive mode" so the
     user can move/configure the overlay.
   - Positioned/resizable; remembers position per monitor.
   - Must sit above the game in **borderless windowed** mode (this is the
     supported mode; document it in the README).

2. **Screen capture + talent detection**
   - Capture the Ravenswatch window (Windows Graphics Capture API via
     Electron's `desktopCapturer`, or `windows-capture`/`mss` if Python).
   - User calibrates once: drags a box over the region where talent choices
     appear (the 2–3 card area shown on level-up). Store the region
     per-resolution.
   - Detection loop (~1 fps is enough): OCR the region (Tesseract), normalize
     text, fuzzy-match (e.g. Levenshtein / token match) against the current
     hero's priority-talent list.
   - On match: overlay flashes a "★ PICK: <talent>" banner anchored near the
     region. On no match but talent screen detected: show muted "no priority
     here — reroll?" hint.
   - Optional stretch: template-match the talent-screen frame itself so
     scanning only runs when a choice is actually open (cheap OpenCV
     `matchTemplate` on a downscaled frame).

3. **Build plan management**
   - Per-hero storage (JSON on disk): priority talents (ordered), item wishlist
     (legendary/cursed), free-text notes / combo cycle.
   - Heroes: Scarlet, Beowulf, The Pied Piper, Snow Queen, Aladdin, Melusine,
     Sun Wukong, Geppetto, Carmilla, Romeo, Merlin. (Verify current roster —
     game receives content updates.)
   - Import helper: paste a BuildMaker share URL or its visible text; parse
     talent names out of it. (No official API — treat as best-effort text
     parsing, keep manual entry as the primary path.)

4. **Run HUD**
   - Day/night phase timer with adjustable phase length, day counter,
     start/pause/skip via hotkeys.
   - Compact tally of talents/legendaries/cursed picked this run (hotkey or
     click to log).

## Architecture decision — read this first

**Option A (BUILD THIS): external transparent overlay window.**
- Electron (recommended for speed) or C++/Win32 + Direct2D if we want tiny
  footprint.
- `BrowserWindow` with `transparent: true, frame: false, alwaysOnTop: true`,
  `setIgnoreMouseEvents(true, { forward: true })` for click-through,
  `screen-saver` level for always-on-top above games.
- Never touches the game process. No anticheat/EULA risk. Can't crash the game.
- Limitation: does not render over **exclusive fullscreen** — borderless
  windowed only. This is acceptable and standard (Discord overlay has the same
  practical guidance).

**Option B (do NOT build unless A proves insufficient): DLL injection.**
- Hook `IDXGISwapChain::Present` (game is D3D11/12 — verify with RenderDoc or
  PIX), render ImGui inside the game's frame.
- Works in exclusive fullscreen, but: requires per-game-update maintenance,
  can crash the game, gray area with EULA/anticheat even in a PvE game, and
  vastly more debugging. Not worth it for this use case.

Decision: **Option A.** Mention B in README as consciously rejected.

## Suggested stack (Electron path)

- Electron + TypeScript, Vite for the renderer.
- Main process: window management, global hotkeys (`globalShortcut`), capture
  source selection, JSON persistence (`electron-store`).
- Renderer 1 (overlay): the transparent HUD.
- Renderer 2 (control panel): normal window for setup — hero select, build
  plans, region calibration with live capture preview.
- OCR: `tesseract.js` in a worker, OR spawn native tesseract binary for speed.
  Preprocess: crop → 2x upscale → grayscale → contrast stretch (already proven
  to help on Ravenswatch's stylized font).
- Optional CV: `opencv4nodejs` is painful to build — prefer
  `@techstark/opencv-js` (WASM) or skip template matching in v1.

## Milestones (each should end runnable)

1. **M1 — Overlay shell:** transparent always-on-top click-through window
   showing a static HUD + hotkey to toggle interactive mode. Test over the
   actual game in borderless windowed.
2. **M2 — Control panel + persistence:** hero plans CRUD, JSON storage,
   overlay reflects selected hero's plan live (IPC).
3. **M3 — Capture + calibration:** pick the game window, live preview, drag
   region, store per-resolution.
4. **M4 — OCR pipeline:** manual "scan now" hotkey → OCR → fuzzy match →
   overlay banner. Tune preprocessing against real screenshots.
5. **M5 — Auto-detection loop:** periodic scan, debounce, only alert on
   changes. Perf budget: capture+OCR under ~150 ms per pass, loop ≤ 1 Hz.
6. **M6 — Timer/HUD polish + packaging:** electron-builder, single installer.

## Testing notes for Claude Code sessions

- The developer (Leandro) will run the app locally with the game open —
  ask him for screenshots of the talent screen early (M3) and save them to
  `test-assets/` so OCR tuning (M4) can run headless against real frames.
- Machine: Windows, NVIDIA RTX 4050 laptop or RTX 4090 desktop available.
- Write a small `npm run ocr-bench` script that runs the OCR pipeline over
  `test-assets/*.png` and prints match results — makes iteration fast without
  the game running.

## Non-goals (v1)

- No game-memory reading, no injection, no input automation (no auto-picking
  talents — advise only).
- No overlay in exclusive fullscreen.
- No cloud sync; local JSON is fine.

## BuildMaker API (unofficial, discovered 2026-07, isolated in src/main/api.ts)

- `GET https://buildmaker.ravenswatch.com/api/game-heroes/?lang=<l>` — heroes
- `GET .../api/game-heroes/<raw_name>?lang=<l>` — hero + talent catalog under
  **`skills`** key: `{id, name, tier, icon, descriptions[]}` (no rarity/type)
- `GET .../api/game-items/` — item catalog
- `GET .../backend/builds?hero=<raw_name>&page=N` — community builds
- `GET .../backend/builds/<id>` — one build; `talents[]` here HAS
  type/rarity/iconUrl; `items[]` is `{id, quantity}` referencing the catalog
- Share URL: `buildmaker.ravenswatch.com/build/<24-hex-id>`
- Localized talent names confirmed for fr/es (de likely); pt/br/jp/cn return
  English. Talent `id` UUIDs are stable across languages — always match
  builds↔catalog by id, not name.

## Current status (v1 feature-complete, pending live-game verification)

- All milestones M1–M6 implemented: overlay HUD with waiting/detected/no-match
  states, splash, tray, control panel (My Builds / Browse / Editor /
  Calibration / Settings), BuildMaker import + community browsing + manual
  editor, per-resolution calibration with live preview, tesseract.js OCR in a
  hidden worker window, 1 Hz detection loop with debounce, `npm run
  ocr-bench` (3/3 on synthetic cards), NSIS installer via electron-builder.
- Hotkeys: Ctrl+Shift+O interactive, Ctrl+Shift+S scan once, Ctrl+Shift+P panel.
- NOT yet verified against the real game: window capture of the actual game,
  OCR accuracy on the real talent-screen font (needs screenshots in
  `test-assets/`), detected/no-match banner in a live run.
- Storage: plain JSON at `%APPDATA%/ravenswatch-overlay/` (electron-store was
  dropped — ESM-only friction with electron-vite CJS main output).
- Node.js was not preinstalled on the dev machine; installed via
  `winget install OpenJS.NodeJS.LTS`. Network drops large downloads
  occasionally — retry npm install / electron-builder on ECONNRESET.
