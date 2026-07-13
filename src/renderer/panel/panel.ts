import type {
  Build,
  CommunityBuildSummary,
  GameItem,
  Hero,
  Settings,
  Talent
} from '../../shared/types'
import { SUPPORTED_LANGUAGES } from '../../shared/types'
import { setUiLanguage, t, UI_LANGUAGES, type I18nKey } from '../../shared/i18n'
import { pickGameSource } from '../../shared/game-window'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const SITE = 'https://buildmaker.ravenswatch.com'

let settings: Settings
let heroes: Hero[] = []
let builds: Build[] = []
let itemCatalog: Map<string, GameItem> | null = null

// ---------- i18n ----------
function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as I18nKey)
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    ;(el as HTMLInputElement).placeholder = t(el.dataset.i18nPlaceholder as I18nKey)
  })
  document
    .querySelectorAll<HTMLOptionElement>('#cal-cards option')
    .forEach((o) => (o.textContent = `${o.value} ${t('cal.cards')}`))
  void refreshDetectionState()
}

// ---------- tabs ----------
document.querySelectorAll<HTMLButtonElement>('nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    closeDetail()
    document.querySelectorAll('nav button').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'))
    btn.classList.add('active')
    $(`tab-${btn.dataset.tab}`).classList.add('active')
    if (btn.dataset.tab === 'calibration') void initCalibration()
  })
})

function setStatus(el: HTMLElement, msg: string, kind: '' | 'error' | 'ok' = ''): void {
  el.textContent = msg
  el.className = `status ${kind}`.trim()
}

function iconUrl(u: string | undefined): string {
  if (!u) return ''
  return u.startsWith('http') ? u : `${SITE}${u}`
}

// ---------- init ----------
async function init(): Promise<void> {
  settings = await window.overlayAPI.getSettings()
  setUiLanguage(settings.uiLanguage)
  applyI18n()
  builds = await window.overlayAPI.listBuilds()
  renderBuilds()
  initSettings()
  try {
    heroes = await window.overlayAPI.getHeroes(settings.gameLanguage)
    fillHeroSelects()
  } catch {
    setStatus($('browse-status'), t('browse.heroesOffline'), 'error')
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
    list.innerHTML = `<div class="status">${t('builds.none')}</div>`
    return
  }
  for (const b of builds) {
    const card = document.createElement('div')
    card.className = 'build-card' + (settings.activeBuildId === b.id ? ' active-build' : '')
    const chips = b.talents
      .slice(0, 10)
      .map((tal) => `<span class="rarity-${tal.rarity}">${escapeHtml(tal.name)}</span>`)
      .join('')
    card.innerHTML = `
      <h4>${escapeHtml(b.title)}</h4>
      <div class="meta">${escapeHtml(b.hero)}${b.author ? ` · ${t('builds.by')} ` + escapeHtml(b.author) : ''} · ${b.source}</div>
      <div class="talent-chips">${chips}</div>
      <div class="actions">
        <button data-act="view">${t('builds.view')}</button>
        <button data-act="activate">${settings.activeBuildId === b.id ? t('builds.active') : t('builds.setActive')}</button>
        <button data-act="delete">${t('builds.delete')}</button>
      </div>`
    card.querySelector<HTMLButtonElement>('[data-act="view"]')!.onclick = () => openDetail(b)
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
  setStatus($('import-status'), t('builds.importing'))
  try {
    const build = await window.overlayAPI.importBuild(input.value)
    builds = await window.overlayAPI.listBuilds()
    renderBuilds()
    setStatus(
      $('import-status'),
      t('builds.imported', { title: build.title, count: build.talents.length }),
      'ok'
    )
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
  setStatus($('browse-status'), t('browse.loading'))
  $('browse-page').textContent = String(browsePage)
  try {
    const results = await window.overlayAPI.browseBuilds(hero, browsePage)
    renderBrowse(results)
    setStatus($('browse-status'), results.length ? '' : t('browse.empty'))
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
      .map((tal) => `<span class="rarity-${tal.rarity}">${escapeHtml(tal.name)}</span>`)
      .join('')
    card.innerHTML = `
      <h4>${escapeHtml(b.title || '(untitled)')}</h4>
      <div class="meta">${escapeHtml(b.hero)}${b.user?.username ? ` · ${t('builds.by')} ` + escapeHtml(b.user.username) : ''} · ♥ ${b.likes?.length ?? 0}</div>
      <div class="talent-chips">${chips}</div>
      <div class="actions">
        <button data-act="view">${t('builds.view')}</button>
        <button data-act="import">${t('builds.import')}</button>
      </div>`
    card.querySelector<HTMLButtonElement>('[data-act="view"]')!.onclick = async () => {
      setStatus($('browse-status'), t('detail.loading'))
      try {
        const full = await window.overlayAPI.fetchBuild(b._id)
        setStatus($('browse-status'), '')
        openDetail(full)
      } catch (err) {
        setStatus($('browse-status'), String((err as Error).message ?? err), 'error')
      }
    }
    card.querySelector<HTMLButtonElement>('[data-act="import"]')!.onclick = async () => {
      try {
        await window.overlayAPI.importBuild(b._id)
        builds = await window.overlayAPI.listBuilds()
        renderBuilds()
        setStatus($('browse-status'), t('builds.imported', { title: b.title, count: (b.talents ?? []).length }), 'ok')
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

document.querySelector<HTMLButtonElement>('[data-tab="browse"]')!.addEventListener('click', () => {
  if ($('browse-list').childElementCount === 0) void loadBrowse()
})

// ---------- build detail (cookbook) ----------
const ALLOWED_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'STRONG', 'EM', 'BR', 'SPAN', 'UL', 'OL', 'LI'])

function sanitizeInto(target: HTMLElement, html: string): void {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (src: Node, dst: Node): void => {
    for (const child of Array.from(src.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        dst.appendChild(document.createTextNode(child.textContent ?? ''))
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element
        if (ALLOWED_TAGS.has(el.tagName)) {
          const clean = document.createElement(el.tagName.toLowerCase())
          const cls = el.getAttribute('class')
          if (cls && /^[\w -]+$/.test(cls)) clean.className = cls
          walk(el, clean)
          dst.appendChild(clean)
        } else {
          walk(el, dst) // unwrap unknown tags, keep their text
        }
      }
    }
  }
  target.innerHTML = ''
  walk(doc.body, target)
}

async function getItemCatalog(): Promise<Map<string, GameItem>> {
  if (itemCatalog) return itemCatalog
  const items = await window.overlayAPI.getItems()
  itemCatalog = new Map(items.map((i) => [i.id, i]))
  return itemCatalog
}

let detailReturnTab = 'builds'

function openDetail(build: Build): void {
  detailReturnTab =
    document.querySelector<HTMLButtonElement>('nav button.active')?.dataset.tab ?? 'builds'
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'))
  $('build-detail').classList.remove('hidden')

  $('detail-title').textContent = build.title
  $('detail-meta').textContent =
    `${build.hero}${build.author ? ` · ${t('builds.by')} ${build.author}` : ''}`
  const srcBtn = $<HTMLButtonElement>('btn-detail-source')
  srcBtn.style.display = build.sourceUrl ? '' : 'none'
  srcBtn.onclick = () => void window.overlayAPI.openExternal(build.sourceUrl!)

  // talents in priority order, with icons + full descriptions
  const talentsEl = $('detail-talents')
  talentsEl.innerHTML = ''
  build.talents.forEach((tal: Talent, i: number) => {
    const row = document.createElement('div')
    row.className = 'detail-talent'
    row.innerHTML = `
      <div class="dt-rank">${i + 1}</div>
      <img src="${iconUrl(tal.iconUrl)}" alt="" loading="lazy" />
      <div>
        <div class="dt-head">
          <span class="dt-name">${escapeHtml(tal.name)}</span>
          <span class="dt-badge">${escapeHtml(tal.rarity)} · ${escapeHtml(tal.type)}</span>
        </div>
        <div class="dt-desc"></div>
      </div>`
    const desc = row.querySelector<HTMLDivElement>('.dt-desc')!
    sanitizeInto(desc, (tal.descriptions ?? []).join('<br/>'))
    talentsEl.appendChild(row)
  })

  // items resolved against the catalog
  const itemsEl = $('detail-items')
  itemsEl.innerHTML = ''
  void getItemCatalog().then((catalog) => {
    for (const ref of build.items) {
      const item = catalog.get(ref.id)
      if (!item) continue
      const row = document.createElement('div')
      row.className = 'detail-item'
      row.innerHTML = `
        <img src="${iconUrl(item.icon ?? '')}" alt="" loading="lazy" />
        <div>
          <div class="di-name">${escapeHtml(item.name)}</div>
          <div class="di-quality">${escapeHtml(item.quality_name ?? '')}</div>
        </div>
        <span class="di-qty">${ref.quantity > 1 ? t('detail.quantity', { n: ref.quantity }) : ''}</span>`
      itemsEl.appendChild(row)
    }
  })

  // guide
  const guide = $('detail-guide')
  if (build.description || build.notes) {
    sanitizeInto(guide, build.description ?? '')
    if (build.notes) {
      const notes = document.createElement('p')
      notes.textContent = build.notes
      guide.appendChild(notes)
    }
  } else {
    guide.textContent = t('detail.noGuide')
  }
}

function closeDetail(): void {
  $('build-detail').classList.add('hidden')
}

$('btn-detail-back').onclick = () => {
  closeDetail()
  $(`tab-${detailReturnTab}`).classList.add('active')
}

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
  setStatus($('editor-status'), t('editor.loadingCatalog'))
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

function talentRow(tal: Talent, extra: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'talent-row'
  row.innerHTML = `${extra}<img src="${iconUrl(tal.iconUrl)}" alt="" loading="lazy" />
    <span class="t-name">${escapeHtml(tal.name)}</span>
    <span class="t-meta">${escapeHtml(tal.rarity)} · ${escapeHtml(tal.type)}</span>`
  return row
}

function renderEditor(): void {
  const cat = $('editor-catalog')
  const picks = $('editor-picks')
  cat.innerHTML = ''
  picks.innerHTML = ''
  for (const tal of editorCatalog) {
    if (editorPicks.some((p) => p.id === tal.id)) continue
    const row = talentRow(tal, '')
    row.onclick = () => {
      editorPicks.push(tal)
      renderEditor()
    }
    cat.appendChild(row)
  }
  editorPicks.forEach((tal, i) => {
    const row = talentRow(tal, `<span class="t-rank">${i + 1}</span>`)
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
    setStatus($('editor-status'), t('editor.needFields'), 'error')
    return
  }
  const build: Build = {
    id: `manual-${Date.now()}`,
    source: 'manual',
    hero,
    title,
    talents: editorPicks,
    items: [],
    notes: $<HTMLTextAreaElement>('editor-notes').value.trim() || undefined
  }
  builds = await window.overlayAPI.saveBuild(build)
  renderBuilds()
  setStatus($('editor-status'), t('editor.saved', { title }), 'ok')
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
  const game = pickGameSource(sources)
  if (game) sel.value = game.id
  await startCalStream(sel.value)
}

$('btn-cal-refresh').onclick = () => void initCalibration()
$('cal-source').onchange = () => void startCalStream($<HTMLSelectElement>('cal-source').value)

async function startCalStream(sourceId: string): Promise<void> {
  if (!sourceId) return
  calStream?.getTracks().forEach((track) => track.stop())
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
    setStatus($('cal-status'), t('cal.drag'))
  } catch (err) {
    setStatus($('cal-status'), t('cal.failed', { error: String((err as Error).message ?? err) }), 'error')
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
  setStatus($('cal-status'), t('cal.saved', { key }), 'ok')
}

// ---------- settings ----------
function initSettings(): void {
  const uiSel = $<HTMLSelectElement>('setting-ui-language')
  uiSel.innerHTML = ''
  for (const l of UI_LANGUAGES) {
    const opt = document.createElement('option')
    opt.value = l.code
    opt.textContent = l.label
    uiSel.appendChild(opt)
  }
  uiSel.value = settings.uiLanguage
  uiSel.onchange = async () => {
    settings = await window.overlayAPI.updateSettings({ uiLanguage: uiSel.value })
    setUiLanguage(settings.uiLanguage)
    applyI18n()
    renderBuilds()
    void checkLanguage()
  }

  const daySec = $<HTMLInputElement>('setting-day-sec')
  const nightSec = $<HTMLInputElement>('setting-night-sec')
  daySec.value = String(settings.dayPhaseSec)
  nightSec.value = String(settings.nightPhaseSec)
  const saveTimer = async (): Promise<void> => {
    settings = await window.overlayAPI.updateSettings({
      dayPhaseSec: Math.max(30, Number(daySec.value) || 540),
      nightPhaseSec: Math.max(30, Number(nightSec.value) || 150)
    })
    setStatus($('timer-save-status'), t('settings.timerSaved'), 'ok')
  }
  daySec.onchange = () => void saveTimer()
  nightSec.onchange = () => void saveTimer()

  $('btn-reset-hud').onclick = async () => {
    settings = await window.overlayAPI.resetOverlayPosition()
    setStatus($('hud-reset-status'), t('settings.hudReset'), 'ok')
  }

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
    void checkLanguage()
    heroes = await window.overlayAPI.getHeroes(sel.value)
    fillHeroSelects()
  }
  void checkLanguage()
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
      localized ? t('settings.langLocalized') : t('settings.langFallback'),
      localized ? 'ok' : 'error'
    )
  } catch {
    setStatus(warn, t('settings.langUnknown'))
  }
}

// ---------- detection controls ----------
async function refreshDetectionState(): Promise<void> {
  const running = await window.overlayAPI.isDetectionRunning()
  $('detection-state').textContent = running ? t('detection.on') : t('detection.off')
  $('detection-state').className = running ? 'on' : 'off'
  $('btn-detection-toggle').textContent = running ? t('detection.stop') : t('detection.start')
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
