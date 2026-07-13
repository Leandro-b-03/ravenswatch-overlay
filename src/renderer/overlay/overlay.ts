import { setUiLanguage, t } from '../../shared/i18n'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const hud = $<HTMLDivElement>('hud')
const modeBadge = $<HTMLSpanElement>('mode-badge')
const heroName = $<HTMLSpanElement>('hero-name')
const buildTitle = $<HTMLDivElement>('build-title')
const detectionStatus = $<HTMLDivElement>('detection-status')
const pickBanner = $<HTMLDivElement>('pick-banner')
const pickContent = $<HTMLDivElement>('pick-content')
const phaseLabel = $<HTMLSpanElement>('phase-label')
const phaseCount = $<HTMLSpanElement>('phase-count')
const phaseClock = $<HTMLSpanElement>('phase-clock')
const timerState = $<HTMLSpanElement>('timer-state')
const tipBox = $<HTMLDivElement>('tip-box')
const tipText = $<HTMLSpanElement>('tip-text')

let interactive = false

// ---------- day/night run timer ----------
// Counts down the current phase; night end advances the day counter.
let dayPhaseSec = 540
let nightPhaseSec = 150
let phase: 'day' | 'night' = 'day'
let day = 1
let remaining = dayPhaseSec
let running = false

function renderTimer(): void {
  phaseLabel.textContent = phase === 'day' ? t('ov.day') : t('ov.night')
  phaseLabel.className = phase
  phaseCount.textContent = String(day)
  timerState.textContent = running ? '▶' : '⏸'
  const m = Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0')
  const s = (remaining % 60).toString().padStart(2, '0')
  phaseClock.textContent = `${m}:${s}`
}

function nextPhase(): void {
  if (phase === 'day') {
    phase = 'night'
    remaining = nightPhaseSec
  } else {
    phase = 'day'
    day += 1
    remaining = dayPhaseSec
  }
  renderTimer()
}

function resetRun(): void {
  phase = 'day'
  day = 1
  remaining = dayPhaseSec
  running = false
  for (const kind of Object.keys(tally) as (keyof typeof tally)[]) tally[kind] = 0
  renderTally()
  renderTimer()
}

setInterval(() => {
  if (!running) return
  remaining -= 1
  if (remaining <= 0) nextPhase()
  else renderTimer()
}, 1000)

window.overlayAPI.onRunTimerToggle(() => {
  running = !running
  renderTimer()
})

window.overlayAPI.onRunTimerSkip(() => nextPhase())

// ---------- pick tally ----------
const tally = { talent: 0, legendary: 0, cursed: 0 }

function renderTally(): void {
  document.querySelectorAll<HTMLButtonElement>('#hud-tally .tally').forEach((btn) => {
    const kind = btn.dataset.kind as keyof typeof tally
    btn.querySelector('b')!.textContent = String(tally[kind])
  })
}

document.querySelectorAll<HTMLButtonElement>('#hud-tally .tally').forEach((btn) => {
  btn.addEventListener('click', () => {
    const kind = btn.dataset.kind as keyof typeof tally
    tally[kind] += 1
    renderTally()
  })
})

$('tally-reset').addEventListener('click', resetRun)

// ---------- tips (player guide from the active build) ----------
let tips: string[] = []
let tipIndex = 0
const TIP_ROTATE_MS = 20000
let tipTimer: number | undefined

function showTip(): void {
  if (tips.length === 0) {
    tipBox.classList.add('hidden')
    return
  }
  tipBox.classList.remove('hidden')
  tipText.textContent = tips[tipIndex % tips.length]
}

function nextTip(): void {
  if (tips.length === 0) return
  tipIndex = (tipIndex + 1) % tips.length
  showTip()
}

function setTips(newTips: string[]): void {
  tips = newTips
  tipIndex = 0
  showTip()
  if (tipTimer !== undefined) clearInterval(tipTimer)
  tipTimer = window.setInterval(nextTip, TIP_ROTATE_MS)
}

window.overlayAPI.onNextTip(nextTip)

// ---------- draggable HUD (interactive mode) ----------
let drag: { startX: number; startY: number; origX: number; origY: number } | null = null

function applyPosition(pos: { x: number; y: number } | null): void {
  if (!pos) return
  hud.style.left = `${pos.x}px`
  hud.style.top = `${pos.y}px`
  hud.style.right = 'auto'
}

hud.addEventListener('mousedown', (e) => {
  if (!interactive) return
  if ((e.target as HTMLElement).closest('button')) return
  const rect = hud.getBoundingClientRect()
  drag = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top }
  hud.classList.add('dragging')
  e.preventDefault()
})

window.addEventListener('mousemove', (e) => {
  if (!drag) return
  const x = Math.max(0, drag.origX + e.clientX - drag.startX)
  const y = Math.max(0, drag.origY + e.clientY - drag.startY)
  applyPosition({ x, y })
})

window.addEventListener('mouseup', () => {
  if (!drag) return
  drag = null
  hud.classList.remove('dragging')
  const rect = hud.getBoundingClientRect()
  void window.overlayAPI.updateSettings({
    overlayPosition: { x: Math.round(rect.left), y: Math.round(rect.top) }
  })
})

window.overlayAPI.onPositionReset(() => {
  // Back to the CSS default (top-right corner).
  hud.style.left = ''
  hud.style.top = ''
  hud.style.right = ''
})

// ---------- mode + state ----------
window.overlayAPI.onInteractiveModeChanged((on) => {
  interactive = on
  document.body.classList.toggle('interactive', on)
  modeBadge.textContent = on ? t('ov.interactive') : t('ov.clickThrough')
})

// Status notes from main: what detection is doing / what's blocking it.
window.overlayAPI.onDetectionNote((key) => {
  detectionStatus.textContent = t(key as Parameters<typeof t>[0])
  detectionStatus.className = key === 'note.active' ? 'active' : 'idle'
})

// Run recorder feedback: brief toast + talent tally bump.
let toastTimer: number | undefined
window.overlayAPI.onPickLogged((talentName) => {
  tally.talent += 1
  renderTally()
  detectionStatus.textContent = t('ov.logged', { name: talentName })
  detectionStatus.className = 'active'
  if (toastTimer !== undefined) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    detectionStatus.textContent = t('note.active')
    detectionStatus.className = 'active'
  }, 3000)
})

// Maps a card's rect from game-capture coordinates onto this overlay window.
// In borderless windowed mode the game covers the screen, so scaling by the
// capture→window ratio lands the highlight on the actual card.
function cardRect(
  region: { x: number; y: number; width: number; height: number; cardCount: number; captureWidth: number; captureHeight: number },
  cardIndex: number
): { left: number; top: number; width: number; height: number } {
  const sx = window.innerWidth / region.captureWidth
  const sy = window.innerHeight / region.captureHeight
  const cardW = region.width / region.cardCount
  return {
    left: (region.x + cardIndex * cardW) * sx,
    top: region.y * sy,
    width: cardW * sx,
    height: region.height * sy
  }
}

const cardHighlights = $<HTMLDivElement>('card-highlights')

function clearHighlights(): void {
  cardHighlights.innerHTML = ''
}

function highlightCard(
  region: Parameters<typeof cardRect>[0],
  cardIndex: number,
  rank: number | null,
  bbox?: { x: number; y: number; width: number; height: number }
): void {
  // Full-frame mode gives the exact name position — pad it into a card-ish
  // frame. Card mode falls back to the calibrated card slice.
  let rect: { left: number; top: number; width: number; height: number }
  if (bbox) {
    const sx = window.innerWidth / region.captureWidth
    const sy = window.innerHeight / region.captureHeight
    const padX = bbox.width * 0.2
    const padY = bbox.height * 1.2
    rect = {
      left: (bbox.x - padX) * sx,
      top: (bbox.y - padY) * sy,
      width: (bbox.width + padX * 2) * sx,
      height: (bbox.height + padY * 2) * sy
    }
  } else {
    rect = cardRect(region, cardIndex)
  }
  const el = document.createElement('div')
  el.className = 'card-highlight' + (rank === null ? ' muted-card' : '')
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.top}px`
  el.style.width = `${rect.width}px`
  el.style.height = `${rect.height}px`
  if (rank !== null) {
    const arrow = document.createElement('div')
    arrow.className = 'ch-arrow'
    arrow.textContent = '▼'
    el.appendChild(arrow)
    const badge = document.createElement('div')
    badge.className = 'ch-rank'
    badge.textContent = `★ #${rank}`
    el.appendChild(badge)
  }
  cardHighlights.appendChild(el)
}

window.overlayAPI.onOverlayState((state) => {
  if (state.kind === 'waiting') {
    heroName.textContent = state.heroName ?? t('ov.noBuild')
    buildTitle.textContent = state.buildTitle ?? t('ov.selectBuild')
    pickBanner.classList.add('hidden')
    clearHighlights()
    setTips(state.tips ?? [])
    return
  }

  if (state.kind === 'detected') {
    detectionStatus.textContent = t('ov.detected')
    detectionStatus.className = 'active'
    const sorted = [...state.picks].sort((a, b) => a.priorityRank - b.priorityRank)
    pickContent.innerHTML = ''
    clearHighlights()
    for (const pick of sorted) {
      const line = document.createElement('div')
      line.className = 'pick-line'
      line.textContent = t('ov.pick', { name: pick.talentName })
      const rank = document.createElement('span')
      rank.className = 'rank'
      rank.textContent = t('ov.rank', { n: pick.priorityRank })
      line.appendChild(rank)
      pickContent.appendChild(line)
      highlightCard(state.region, pick.cardIndex, pick.priorityRank, pick.bbox)
    }
    pickBanner.classList.remove('hidden')
    return
  }

  // no-match
  detectionStatus.textContent = t('ov.detected')
  detectionStatus.className = 'active'
  pickContent.innerHTML = ''
  clearHighlights()
  const line = document.createElement('div')
  line.className = 'pick-line muted'
  line.textContent = t('ov.reroll')
  pickContent.appendChild(line)
  pickBanner.classList.remove('hidden')
})

// ---------- init ----------
void (async () => {
  const settings = await window.overlayAPI.getSettings()
  setUiLanguage(settings.uiLanguage)
  dayPhaseSec = settings.dayPhaseSec
  nightPhaseSec = settings.nightPhaseSec
  remaining = dayPhaseSec
  applyPosition(settings.overlayPosition)
  $('tip-label').textContent = t('ov.tip')
  modeBadge.textContent = t('ov.clickThrough')
  heroName.textContent = t('ov.noBuild')
  buildTitle.textContent = t('ov.selectBuild')
  detectionStatus.textContent = t('ov.waiting')
  renderTimer()
  renderTally()
})()
