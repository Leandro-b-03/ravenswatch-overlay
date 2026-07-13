const modeBadge = document.getElementById('mode-badge') as HTMLSpanElement
const phaseClock = document.getElementById('phase-clock') as HTMLSpanElement
const heroName = document.getElementById('hero-name') as HTMLSpanElement
const buildTitle = document.getElementById('build-title') as HTMLDivElement
const detectionStatus = document.getElementById('detection-status') as HTMLDivElement
const pickBanner = document.getElementById('pick-banner') as HTMLDivElement
const pickContent = document.getElementById('pick-content') as HTMLDivElement

let elapsedSeconds = 0

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

setInterval(() => {
  elapsedSeconds += 1
  phaseClock.textContent = formatClock(elapsedSeconds)
}, 1000)

window.overlayAPI.onInteractiveModeChanged((interactive) => {
  document.body.classList.toggle('interactive', interactive)
  modeBadge.textContent = interactive ? 'interactive (Ctrl+Shift+O)' : 'click-through'
})

window.overlayAPI.onOverlayState((state) => {
  if (state.kind === 'waiting') {
    heroName.textContent = state.heroName ?? 'No build'
    buildTitle.textContent = state.buildTitle ?? 'select a build in the control panel'
    detectionStatus.textContent = 'waiting for talent choice…'
    detectionStatus.className = 'idle'
    pickBanner.classList.add('hidden')
    return
  }

  if (state.kind === 'detected') {
    detectionStatus.textContent = 'talent choice detected'
    detectionStatus.className = 'active'
    const sorted = [...state.picks].sort((a, b) => a.priorityRank - b.priorityRank)
    pickContent.innerHTML = ''
    for (const pick of sorted) {
      const line = document.createElement('div')
      line.className = 'pick-line'
      line.textContent = `★ PICK: ${pick.talentName}`
      const rank = document.createElement('span')
      rank.className = 'rank'
      rank.textContent = `#${pick.priorityRank} in build`
      line.appendChild(rank)
      pickContent.appendChild(line)
    }
    pickBanner.classList.remove('hidden')
    return
  }

  // no-match
  detectionStatus.textContent = 'talent choice detected'
  detectionStatus.className = 'active'
  pickContent.innerHTML = ''
  const line = document.createElement('div')
  line.className = 'pick-line muted'
  line.textContent = 'no priority here — reroll?'
  pickContent.appendChild(line)
  pickBanner.classList.remove('hidden')
})
