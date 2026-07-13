import type {
  Build,
  CommunityBuildSummary,
  Hero,
  Settings,
  Talent
} from '../../shared/types'
import { SUPPORTED_LANGUAGES } from '../../shared/types'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const SITE = 'https://buildmaker.ravenswatch.com'

let settings: Settings
let heroes: Hero[] = []
let builds: Build[] = []

// ---------- tabs ----------
document.querySelectorAll<HTMLButtonElement>('nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
    btn.classList.add('active')
    $(`tab-${btn.dataset.tab}`).classList.add('active')
    if (btn.dataset.tab === 'calibration') void initCalibration()
  })
})

function setStatus(el: HTMLElement, msg: string, kind: '' | 'error' | 'ok' = ''): void {
  el.textContent = msg
  el.className = `status ${kind}`.trim()
}

function iconUrl(t: Talent): string {
  const u = t.iconUrl || ''
  return u.startsWith('http') ? u : `${SITE}${u}`
}

// ---------- init ----------
async function init(): Promise<void> {
  settings = await window.overlayAPI.getSettings()
  builds = await window.overlayAPI.listBuilds()
  renderBuilds()
  initSettings()
  try {
    heroes = await window.overlayAPI.getHeroes(settings.gameLanguage)
    fillHeroSelects()
  } catch {
    setStatus($('browse-status'), 'Could not load hero list (offline?)', 'error')
  }
  void refreshDetectionState()
}

function fillHeroSelects(): void {
  for (const selId of ['browse-hero', 'editor-hero']) {
    const sel = $<HTMLSelectElement>(selId)
    sel.innerHTML = ''
    for (const h of heroes) {
      const opt = document.createElement('option')
      opt.value = h.raw_name
      opt.textContent = h.name
      sel.appendChild(opt)
    }
  }
}

// ---------- my builds ----------
function renderBuilds(): void {
  const list = $('builds-list')
  list.innerHTML = ''
  if (builds.length === 0) {
    list.innerHTML = '<div class="status">No builds yet — import one or use the editor.</div>'
    return
  }
  for (const b of builds) {
    const card = document.createElement('div')
    card.className = 'build-card' + (settings.activeBuildId === b.id ? ' active-build' : '')
    const chips = b.talents
      .slice(0, 10)
      .map((t) => `<span class="rarity-${t.rarity}">${escapeHtml(t.name)}</span>`)
      .join('')
    card.innerHTML = `
      <h4>${escapeHtml(b.title)}</h4>
      <div class="meta">${escapeHtml(b.hero)}${b.author ? ' · by ' + escapeHtml(b.author) : ''} · ${b.source}</div>
      <div class="talent-chips">${chips}</div>
      <div class="actions">
        <button data-act="activate">${settings.activeBuildId === b.id ? '✓ Active' : 'Set active'}</button>
        <button data-act="delete">Delete</button>
      </div>`
    card.querySelector<HTMLButtonElement>('[data-act="activate"]')!.onclick = async () => {
      settings = await window.overlayAPI.updateSettings({ activeBuildId: b.id })
      renderBuilds()
    }
    card.querySelector<HTMLButtonElement>('[data-act="delete"]')!.onclick = async () => {
      builds = await window.overlayAPI.deleteBuild(b.id)
      settings = await window.overlayAPI.getSettings()
      renderBuilds()
    }
    list.appendChild(card)
  }
}

$('btn-import').onclick = async () => {
  const input = $<HTMLInputElement>('import-url')
  setStatus($('import-status'), 'Importing…')
  try {
    const build = await window.overlayAPI.importBuild(input.value)
    builds = await window.overlayAPI.listBuilds()
    renderBuilds()
    setStatus($('import-status'), `Imported “${build.title}” (${build.talents.length} talents)`, 'ok')
    input.value = ''
  } catch (err) {
    setStatus($('import-status'), String((err as Error).message ?? err), 'error')
  }
}

// ---------- browse ----------
let browsePage = 1

async function loadBrowse(): Promise<void> {
  const hero = $<HTMLSelectElement>('browse-hero').value
  if (!hero) return
  setStatus($('browse-status'), 'Loading…')
  $('browse-page').textContent = String(browsePage)
  try {
    const results = await window.overlayAPI.browseBuilds(hero, browsePage)
    renderBrowse(results)
    setStatus($('browse-status'), results.length ? '' : 'No builds on this page.')
  } catch (err) {
    setStatus($('browse-status'), String((err as Error).message ?? err), 'error')
  }
}

function renderBrowse(results: CommunityBuildSummary[]): void {
  const list = $('browse-list')
  list.innerHTML = ''
  for (const b of results) {
    const card = document.createElement('div')
    card.className = 'build-card'
    const chips = (b.talents ?? [])
      .slice(0, 10)
      .map((t) => `<span class="rarity-${t.rarity}">${escapeHtml(t.name)}</span>`)
      .join('')
    card.innerHTML = `
      <h4>${escapeHtml(b.title || '(untitled)')}</h4>
      <div class="meta">${escapeHtml(b.hero)}${b.user?.username ? ' · by ' + escapeHtml(b.user.username) : ''} · ♥ ${b.likes?.length ?? 0}</div>
      <div class="talent-chips">${chips}</div>
      <div class="actions"><button>Import</button></div>`
    card.querySelector('button')!.onclick = async () => {
      try {
        await window.overlayAPI.importBuild(b._id)
        builds = await window.overlayAPI.listBuilds()
        renderBuilds()
        setStatus($('browse-status'), `Imported “${b.title}”`, 'ok')
      } catch (err) {
        setStatus($('browse-status'), String((err as Error).message ?? err), 'error')
      }
    }
    list.appendChild(card)
  }
}

$('browse-hero').onchange = () => {
  browsePage = 1
  void loadBrowse()
}
$('btn-browse-prev').onclick = () => {
  if (browsePage > 1) {
    browsePage--
    void loadBrowse()
  }
}
$('btn-browse-next').onclick = () => {
  browsePage++
  void loadBrowse()
}

// first visit to browse tab loads automatically once heroes exist
document.querySelector<HTMLButtonElement>('[data-tab="browse"]')!.addEventListener('click', () => {
  if ($('browse-list').childElementCount === 0) void loadBrowse()
})

// ---------- editor ----------
let editorCatalog: Talent[] = []
let editorPicks: Talent[] = []

$('editor-hero').onchange = () => void loadEditorCatalog()
document.querySelector<HTMLButtonElement>('[data-tab="editor"]')!.addEventListener('click', () => {
  if (editorCatalog.length === 0) void loadEditorCatalog()
})

async function loadEditorCatalog(): Promise<void> {
  const hero = $<HTMLSelectElement>('editor-hero').value
  if (!hero) return
  setStatus($('editor-status'), 'Loading talent catalog…')
  try {
    const heroData = await window.overlayAPI.getHero(hero, settings.gameLanguage)
    editorCatalog = heroData.talents ?? []
    editorPicks = []
    renderEditor()
    setStatus($('editor-status'), '')
  } catch (err) {
    setStatus($('editor-status'), String((err as Error).message ?? err), 'error')
  }
}

function talentRow(t: Talent, extra: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'talent-row'
  row.innerHTML = `${extra}<img src="${iconUrl(t)}" alt="" loading="lazy" />
    <span class="t-name">${escapeHtml(t.name)}</span>
    <span class="t-meta">${escapeHtml(t.rarity)} · ${escapeHtml(t.type)}</span>`
  return row
}

function renderEditor(): void {
  const cat = $('editor-catalog')
  const picks = $('editor-picks')
  cat.innerHTML = ''
  picks.innerHTML = ''
  for (const t of editorCatalog) {
    if (editorPicks.some((p) => p.id === t.id)) continue
    const row = talentRow(t, '')
    row.onclick = () => {
      editorPicks.push(t)
      renderEditor()
    }
    cat.appendChild(row)
  }
  editorPicks.forEach((t, i) => {
    const row = talentRow(t, `<span class="t-rank">${i + 1}</span>`)
    row.draggable = true
    row.onclick = () => {
      editorPicks.splice(i, 1)
      renderEditor()
    }
    row.ondragstart = (e) => e.dataTransfer!.setData('text/plain', String(i))
    row.ondragover = (e) => e.preventDefault()
    row.ondrop = (e) => {
      e.preventDefault()
      const from = Number(e.dataTransfer!.getData('text/plain'))
      const [moved] = editorPicks.splice(from, 1)
      editorPicks.splice(i, 0, moved)
      renderEditor()
    }
    picks.appendChild(row)
  })
}

$('btn-editor-save').onclick = async () => {
  const hero = $<HTMLSelectElement>('editor-hero').value
  const title = $<HTMLInputElement>('editor-title').value.trim()
  if (!hero || !title || editorPicks.length === 0) {
    setStatus($('editor-status'), 'Pick a hero, a title, and at least one talent.', 'error')
    return
  }
  const build: Build = {
    id: `manual-${Date.now()}`,
    source: 'manual',
    hero,
    title,
    talents: editorPicks,
    items: []
  }
  builds = await window.overlayAPI.saveBuild(build)
  renderBuilds()
  setStatus($('editor-status'), `Saved “${title}”.`, 'ok')
}

// ---------- calibration ----------
const calVideo = $<HTMLVideoElement>('cal-video')
const calCanvas = $<HTMLCanvasElement>('cal-canvas')
let calStream: MediaStream | null = null
let calDrag: { x: number; y: number } | null = null
let calRegion: { x: number; y: number; w: number; h: number } | null = null
let calRafId = 0

async function initCalibration(): Promise<void> {
  const sources = await window.overlayAPI.getCaptureSources()
  const sel = $<HTMLSelectElement>('cal-source')
  sel.innerHTML = ''
  for (const s of sources) {
    const opt = document.createElement('option')
    opt.value = s.id
    opt.textContent = s.name
    sel.appendChild(opt)
  }
  const game = sources.find((s) => s.name.toLowerCase().includes('ravenswatch'))
  if (game) sel.value = game.id
  await startCalStream(sel.value)
}

$('btn-cal-refresh').onclick = () => void initCalibration()
$('cal-source').onchange = () => void startCalStream($<HTMLSelectElement>('cal-source').value)

async function startCalStream(sourceId: string): Promise<void> {
  if (!sourceId) return
  calStream?.getTracks().forEach((t) => t.stop())
  try {
    calStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: 3840,
          maxHeight: 2160
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    })
    calVideo.srcObject = calStream
    await calVideo.play()
    cancelAnimationFrame(calRafId)
    drawCalFrame()
    setStatus($('cal-status'), 'Drag a box over the talent-card area, then Save region.')
  } catch (err) {
    setStatus($('cal-status'), `Capture failed: ${String((err as Error).message ?? err)}`, 'error')
  }
}

function drawCalFrame(): void {
  const w = calVideo.videoWidth
  const h = calVideo.videoHeight
  if (w && h) {
    if (calCanvas.width !== w) {
      calCanvas.width = w
      calCanvas.height = h
    }
    const ctx = calCanvas.getContext('2d')!
    ctx.drawImage(calVideo, 0, 0)
    if (calRegion) {
      ctx.strokeStyle = '#ffcc33'
      ctx.lineWidth = Math.max(2, w / 640)
      ctx.strokeRect(calRegion.x, calRegion.y, calRegion.w, calRegion.h)
      const cards = Number($<HTMLSelectElement>('cal-cards').value)
      ctx.setLineDash([8, 6])
      for (let i = 1; i < cards; i++) {
        const x = calRegion.x + (calRegion.w / cards) * i
        ctx.beginPath()
        ctx.moveTo(x, calRegion.y)
        ctx.lineTo(x, calRegion.y + calRegion.h)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
  }
  calRafId = requestAnimationFrame(drawCalFrame)
}

function canvasPos(e: MouseEvent): { x: number; y: number } {
  const rect = calCanvas.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * calCanvas.width,
    y: ((e.clientY - rect.top) / rect.height) * calCanvas.height
  }
}

calCanvas.onmousedown = (e) => {
  calDrag = canvasPos(e)
  calRegion = { x: calDrag.x, y: calDrag.y, w: 0, h: 0 }
  $<HTMLButtonElement>('btn-cal-save').disabled = true
}
calCanvas.onmousemove = (e) => {
  if (!calDrag || !calRegion) return
  const p = canvasPos(e)
  calRegion.x = Math.min(calDrag.x, p.x)
  calRegion.y = Math.min(calDrag.y, p.y)
  calRegion.w = Math.abs(p.x - calDrag.x)
  calRegion.h = Math.abs(p.y - calDrag.y)
}
calCanvas.onmouseup = () => {
  calDrag = null
  if (calRegion && calRegion.w > 20 && calRegion.h > 20) {
    $<HTMLButtonElement>('btn-cal-save').disabled = false
  }
}

$('btn-cal-save').onclick = async () => {
  if (!calRegion) return
  const w = calVideo.videoWidth
  const h = calVideo.videoHeight
  const key = `${w}x${h}`
  settings = await window.overlayAPI.saveCalibration(key, {
    x: Math.round(calRegion.x),
    y: Math.round(calRegion.y),
    width: Math.round(calRegion.w),
    height: Math.round(calRegion.h),
    cardCount: Number($<HTMLSelectElement>('cal-cards').value),
    captureWidth: w,
    captureHeight: h
  })
  setStatus($('cal-status'), `Saved calibration for ${key}.`, 'ok')
}

// ---------- settings ----------
function initSettings(): void {
  const sel = $<HTMLSelectElement>('setting-language')
  sel.innerHTML = ''
  for (const l of SUPPORTED_LANGUAGES) {
    const opt = document.createElement('option')
    opt.value = l.code
    opt.textContent = l.label
    sel.appendChild(opt)
  }
  sel.value = settings.gameLanguage
  sel.onchange = async () => {
    settings = await window.overlayAPI.updateSettings({ gameLanguage: sel.value })
    checkLanguage()
    heroes = await window.overlayAPI.getHeroes(sel.value)
    fillHeroSelects()
  }
  checkLanguage()
}

async function checkLanguage(): Promise<void> {
  const warn = $('language-warning')
  if (settings.gameLanguage === 'en') {
    setStatus(warn, '')
    return
  }
  try {
    const localized = await window.overlayAPI.isLanguageLocalized(settings.gameLanguage)
    setStatus(
      warn,
      localized
        ? 'Talent names are localized for this language — OCR will match native text.'
        : 'BuildMaker has no translation for this language: OCR will match ENGLISH talent names. Set the game to English for reliable detection.',
      localized ? 'ok' : 'error'
    )
  } catch {
    setStatus(warn, 'Could not verify language support (offline?).')
  }
}

// ---------- detection controls ----------
async function refreshDetectionState(): Promise<void> {
  const running = await window.overlayAPI.isDetectionRunning()
  $('detection-state').textContent = running ? 'detection on' : 'detection off'
  $('detection-state').className = running ? 'on' : 'off'
  $('btn-detection-toggle').textContent = running ? 'Stop detection' : 'Start detection'
}

$('btn-detection-toggle').onclick = async () => {
  const running = await window.overlayAPI.isDetectionRunning()
  if (running) {
    await window.overlayAPI.stopDetection()
  } else {
    const res = await window.overlayAPI.startDetection()
    if (!res.ok) {
      setStatus($('import-status'), res.error ?? 'Could not start detection', 'error')
    }
  }
  void refreshDetectionState()
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

void init()
