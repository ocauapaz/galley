// Settings: defaults, persistence (%APPDATA%\Galley\settings.json) and applying them to the page.
import { invoke } from '@tauri-apps/api/core'
import { debounce } from './ui.js'

export const DEFAULTS = {
  // appearance
  theme: 'system',
  accent: '',
  uiScale: 100,
  density: 'comfortable',
  reduceMotion: 'system',
  // editor
  editorFont: "'JetBrains Mono Variable'",
  editorFontSize: 14,
  lineHeight: 1.6,
  ligatures: false,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  highlightActiveLine: true,
  closeBrackets: true,
  autocomplete: true,
  tabTriggers: true,
  spellcheck: false,
  foldGutter: true,
  // compilation
  engine: 'tectonic',
  enginePath: '',
  compileOnSave: true,
  liveCompile: true,
  liveDelay: 1200,
  saveAllBeforeCompile: true,
  // pdf
  pdfInvert: false,
  pdfZoom: 'width',
  syncAfterCompile: false,
  // files
  autoSave: 'off',
  autoSaveDelay: 1000,
  showHidden: false,
  restoreSession: true,
  confirmDelete: true,
  // layout (not shown in settings UI)
  sidebarWidth: 260,
  pdfWidth: 0.45,
  panelHeight: 180,
  sidebarVisible: true,
  pdfVisible: true,
  panelVisible: false,
  sidebarView: 'files',
  customSnippets: [],
  mainFiles: {},
  recent: [],
  session: null,
}

export const THEMES = [
  { id: 'system', name: 'Match system' },
  { id: 'ink', name: 'Ink (dark)', dark: true },
  { id: 'paper', name: 'Paper (light)' },
  { id: 'midnight', name: 'Midnight', dark: true },
  { id: 'sepia', name: 'Sepia' },
  { id: 'forest', name: 'Forest', dark: true },
  { id: 'hc-dark', name: 'High contrast dark', dark: true },
  { id: 'hc-light', name: 'High contrast light' },
]

export const settings = structuredClone(DEFAULTS)
const listeners = new Set()

// Nothing is written until the file has been read, so defaults can never overwrite real settings.
let loaded = false

export async function loadSettings() {
  let raw
  try {
    raw = await invoke('load_settings')
  } catch (e) {
    console.error('settings: could not read, running with defaults and not saving', e)
    return
  }
  try {
    if (raw) Object.assign(settings, JSON.parse(raw))
  } catch (e) {
    console.error('settings: file is corrupt, starting from defaults', e)
  }
  loaded = true
}

const write = () => loaded ? invoke('save_settings', { json: JSON.stringify(settings, null, 2) }) : Promise.resolve()
const persist = debounce(() => write().catch(e => console.error('settings: save failed', e)), 400)

/** Updates one or more settings, persists them and notifies listeners with the changed keys. */
export function setSettings(patch) {
  Object.assign(settings, patch)
  persist()
  const keys = Object.keys(patch)
  for (const fn of listeners) fn(keys)
}

export const saveNow = () => { persist.cancel(); return write() }
export const onSettings = fn => listeners.add(fn)

const darkQuery = matchMedia('(prefers-color-scheme: dark)')
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)')

export function resolvedTheme() {
  if (settings.theme !== 'system') return settings.theme
  return darkQuery.matches ? 'ink' : 'paper'
}
export const isDark = () => !!THEMES.find(t => t.id === resolvedTheme())?.dark

export function applyAppearance() {
  const root = document.documentElement
  root.dataset.theme = resolvedTheme()
  root.dataset.dark = isDark()
  root.dataset.density = settings.density
  root.style.setProperty('--ui-scale', settings.uiScale / 100)
  root.style.fontSize = (13 * settings.uiScale / 100) + 'px'
  if (settings.accent) root.style.setProperty('--accent', settings.accent)
  else root.style.removeProperty('--accent')
  const reduce = settings.reduceMotion === 'on' || (settings.reduceMotion === 'system' && motionQuery.matches)
  root.dataset.motion = reduce ? 'reduced' : 'full'
  root.style.setProperty('--editor-font', settings.editorFont + ", 'Cascadia Code', Consolas, monospace")
  root.style.setProperty('--editor-size', settings.editorFontSize + 'px')
  root.style.setProperty('--editor-line', settings.lineHeight)
  root.style.setProperty('--editor-ligatures', settings.ligatures ? 'normal' : 'none')
}

darkQuery.addEventListener('change', () => { applyAppearance(); for (const fn of listeners) fn(['theme']) })
motionQuery.addEventListener('change', applyAppearance)
