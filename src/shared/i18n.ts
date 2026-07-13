// Minimal dictionary-based i18n for the app UI (not game data).
// Keys are stable identifiers; en is the fallback for missing entries.

export type UiLanguage = 'en' | 'pt'

const en = {
  // tabs
  'tab.builds': 'My Builds',
  'tab.browse': 'Browse',
  'tab.editor': 'Editor',
  'tab.calibration': 'Calibration',
  'tab.settings': 'Settings',
  // detection
  'detection.off': 'detection off',
  'detection.on': 'detection on',
  'detection.start': 'Start detection',
  'detection.stop': 'Stop detection',
  // builds
  'builds.importPlaceholder': 'Paste a buildmaker.ravenswatch.com/build/… link',
  'builds.import': 'Import',
  'builds.importing': 'Importing…',
  'builds.imported': 'Imported “{title}” ({count} talents)',
  'builds.none': 'No builds yet — import one or use the editor.',
  'builds.setActive': 'Set active',
  'builds.active': '✓ Active',
  'builds.delete': 'Delete',
  'builds.view': 'View',
  'builds.by': 'by',
  // browse
  'browse.loading': 'Loading…',
  'browse.empty': 'No builds on this page.',
  'browse.heroesOffline': 'Could not load hero list (offline?)',
  // editor
  'editor.title': 'Build title',
  'editor.save': 'Save build',
  'editor.notesPlaceholder':
    'Notes / combo cycle — each line becomes a rotating tip on the overlay',
  'editor.catalog': 'Talent catalog',
  'editor.catalogHint': '(click to add)',
  'editor.priority': 'Priority order',
  'editor.priorityHint': '(click to remove, drag to reorder)',
  'editor.loadingCatalog': 'Loading talent catalog…',
  'editor.needFields': 'Pick a hero, a title, and at least one talent.',
  'editor.saved': 'Saved “{title}”.',
  // calibration
  'cal.findGame': 'Find game window',
  'cal.saveRegion': 'Save region',
  'cal.cards': 'cards',
  'cal.instructions':
    'Start the game, click “Find game window”, then drag a box over the area where the talent cards appear.',
  'cal.drag': 'Drag a box over the talent-card area, then Save region.',
  'cal.saved': 'Saved calibration for {key}.',
  'cal.failed': 'Capture failed: {error}',
  // settings
  'settings.uiLanguage': 'App language',
  'settings.gameLanguage': 'Game language',
  'settings.timer': 'Run timer',
  'settings.daySec': 'Day phase length (seconds)',
  'settings.nightSec': 'Night phase length (seconds)',
  'settings.timerSaved': 'Saved — applies on next overlay run/reset.',
  'settings.overlay': 'Overlay',
  'settings.resetHud': 'Reset HUD position (top-right)',
  'settings.hudReset': 'HUD moved back to the top-right corner.',
  'settings.hotkeys': 'Hotkeys',
  'settings.langLocalized':
    'Talent names are localized for this language — OCR will match native text.',
  'settings.langFallback':
    'BuildMaker has no translation for this language: OCR will match ENGLISH talent names. Set the game to English for reliable detection, or provide a translation file (see README).',
  'settings.langUnknown': 'Could not verify language support (offline?).',
  // hotkey descriptions
  'hk.interactive': 'Toggle overlay interactive mode (move HUD by dragging)',
  'hk.scan': 'Scan talent screen once',
  'hk.panel': 'Open this control panel',
  'hk.timer': 'Start/pause the run timer',
  'hk.skip': 'Skip to next phase (day/night)',
  'hk.tip': 'Show next tip from the build guide',
  // build detail (cookbook)
  'detail.back': '← Back',
  'detail.talents': 'Talent priority',
  'detail.items': 'Magical objects',
  'detail.guide': 'Player guide',
  'detail.openSource': 'Open on BuildMaker',
  'detail.noGuide': 'This build has no written guide.',
  'detail.loading': 'Loading build…',
  'detail.quantity': 'x{n}',
  // overlay
  'ov.noBuild': 'No build',
  'ov.selectBuild': 'select a build in the control panel',
  'ov.waiting': 'waiting for talent choice…',
  'ov.detected': 'talent choice detected',
  'ov.clickThrough': 'click-through',
  'ov.interactive': 'interactive (Ctrl+Shift+O)',
  'ov.pick': '★ PICK: {name}',
  'ov.rank': '#{n} in build',
  'ov.reroll': 'no priority here — reroll?',
  'ov.day': 'Day',
  'ov.night': 'Night',
  'ov.tip': 'TIP',
  // detection status notes pushed from main
  'note.noBuild': 'no active build — pick one in the panel (Ctrl+Shift+P)',
  'note.noCalibration': 'not calibrated — open panel (Ctrl+Shift+P) → Calibration',
  'note.noGame': 'game window not found — start Ravenswatch (borderless windowed)',
  'note.active': 'detection active — scanning for talent choices',
  'note.stopped': 'detection stopped',
  'note.error': 'detection error — check the control panel'
}

const pt: Record<keyof typeof en, string> = {
  'tab.builds': 'Minhas Builds',
  'tab.browse': 'Explorar',
  'tab.editor': 'Editor',
  'tab.calibration': 'Calibração',
  'tab.settings': 'Configurações',
  'detection.off': 'detecção desligada',
  'detection.on': 'detecção ligada',
  'detection.start': 'Iniciar detecção',
  'detection.stop': 'Parar detecção',
  'builds.importPlaceholder': 'Cole um link buildmaker.ravenswatch.com/build/…',
  'builds.import': 'Importar',
  'builds.importing': 'Importando…',
  'builds.imported': 'Importada “{title}” ({count} talentos)',
  'builds.none': 'Nenhuma build ainda — importe uma ou use o editor.',
  'builds.setActive': 'Ativar',
  'builds.active': '✓ Ativa',
  'builds.delete': 'Excluir',
  'builds.view': 'Ver',
  'builds.by': 'por',
  'browse.loading': 'Carregando…',
  'browse.empty': 'Nenhuma build nesta página.',
  'browse.heroesOffline': 'Não foi possível carregar os heróis (sem internet?)',
  'editor.title': 'Nome da build',
  'editor.save': 'Salvar build',
  'editor.notesPlaceholder':
    'Notas / ciclo de combos — cada linha vira uma dica rotativa no overlay',
  'editor.catalog': 'Catálogo de talentos',
  'editor.catalogHint': '(clique para adicionar)',
  'editor.priority': 'Ordem de prioridade',
  'editor.priorityHint': '(clique para remover, arraste para reordenar)',
  'editor.loadingCatalog': 'Carregando catálogo de talentos…',
  'editor.needFields': 'Escolha um herói, um nome e pelo menos um talento.',
  'editor.saved': 'Salva “{title}”.',
  'cal.findGame': 'Localizar janela do jogo',
  'cal.saveRegion': 'Salvar região',
  'cal.cards': 'cartas',
  'cal.instructions':
    'Abra o jogo, clique em “Localizar janela do jogo” e arraste uma caixa sobre a área onde as cartas de talento aparecem.',
  'cal.drag': 'Arraste uma caixa sobre a área das cartas e clique em Salvar região.',
  'cal.saved': 'Calibração salva para {key}.',
  'cal.failed': 'Falha na captura: {error}',
  'settings.uiLanguage': 'Idioma do aplicativo',
  'settings.gameLanguage': 'Idioma do jogo',
  'settings.timer': 'Timer da partida',
  'settings.daySec': 'Duração do dia (segundos)',
  'settings.nightSec': 'Duração da noite (segundos)',
  'settings.timerSaved': 'Salvo — vale a partir do próximo reinício do timer.',
  'settings.overlay': 'Overlay',
  'settings.resetHud': 'Restaurar posição do HUD (canto superior direito)',
  'settings.hudReset': 'HUD de volta ao canto superior direito.',
  'settings.hotkeys': 'Atalhos',
  'settings.langLocalized':
    'Os nomes dos talentos são localizados neste idioma — o OCR vai reconhecer o texto nativo.',
  'settings.langFallback':
    'O BuildMaker não tem tradução para este idioma: o OCR vai comparar com nomes em INGLÊS. Jogue em inglês para detecção confiável, ou forneça um arquivo de tradução (veja o README).',
  'settings.langUnknown': 'Não foi possível verificar o idioma (sem internet?).',
  'hk.interactive': 'Alternar modo interativo do overlay (arraste o HUD)',
  'hk.scan': 'Escanear a tela de talentos uma vez',
  'hk.panel': 'Abrir este painel de controle',
  'hk.timer': 'Iniciar/pausar o timer da partida',
  'hk.skip': 'Pular para a próxima fase (dia/noite)',
  'hk.tip': 'Mostrar a próxima dica do guia da build',
  'detail.back': '← Voltar',
  'detail.talents': 'Prioridade de talentos',
  'detail.items': 'Objetos mágicos',
  'detail.guide': 'Guia do jogador',
  'detail.openSource': 'Abrir no BuildMaker',
  'detail.noGuide': 'Esta build não tem guia escrito.',
  'detail.loading': 'Carregando build…',
  'detail.quantity': 'x{n}',
  'ov.noBuild': 'Sem build',
  'ov.selectBuild': 'selecione uma build no painel de controle',
  'ov.waiting': 'aguardando escolha de talento…',
  'ov.detected': 'escolha de talento detectada',
  'ov.clickThrough': 'clique atravessa',
  'ov.interactive': 'interativo (Ctrl+Shift+O)',
  'ov.pick': '★ PEGUE: {name}',
  'ov.rank': '#{n} na build',
  'ov.reroll': 'sem prioridade aqui — rerolar?',
  'ov.day': 'Dia',
  'ov.night': 'Noite',
  'ov.tip': 'DICA',
  'note.noBuild': 'nenhuma build ativa — escolha uma no painel (Ctrl+Shift+P)',
  'note.noCalibration': 'sem calibração — abra o painel (Ctrl+Shift+P) → Calibração',
  'note.noGame': 'jogo não encontrado — abra o Ravenswatch (janela sem borda)',
  'note.active': 'detecção ativa — procurando escolhas de talento',
  'note.stopped': 'detecção parada',
  'note.error': 'erro na detecção — verifique o painel de controle'
}

const DICTS: Record<UiLanguage, Record<string, string>> = { en, pt }

let current: UiLanguage = 'en'

export function setUiLanguage(lang: string): void {
  current = lang === 'pt' ? 'pt' : 'en'
}

export type I18nKey = keyof typeof en

export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  }
  return s
}

export const UI_LANGUAGES: { code: UiLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português (Brasil)' }
]
