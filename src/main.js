import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/instrument-sans/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '@fontsource/fira-code/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import './styles.css'

import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { openSearchPanel } from '@codemirror/search'

import { settings, loadSettings, setSettings, saveNow, onSettings, applyAppearance } from './settings.js'
import { h, icon, esc, toast, showMenu, confirm, basename, dirname, joinPath, ext, samePath, debounce, dragHandle } from './ui.js'
import { initEditor, editor, openTab, activateTab, closeTab, markSaved, reloadTab, renameTab, tabText, tabDoc, gotoLine, insertSnippet,
  refreshSettings, setProblems, tabMenu, wordCount } from './editor.js'
import { initExplorer, openFolder as loadFolder, closeFolder as unloadFolder, refresh as refreshExplorer, allFiles, reveal,
  render as renderExplorer, newFile, newFolder, collapseAll } from './explorer.js'
import { initPdf, loadPdf, clearPdf, setZoom, zoomBy, goToPage, showBox, pdfState } from './pdfview.js'
import { openPalette } from './palette.js'
import { openSettings } from './settings-ui.js'
import { outline, indexText } from './latex.js'
import { TEMPLATES } from './snippets.js'
import { inverseSearch, forwardSearch } from './synctex.js'
import { ensureEngine, compileFile, loadSynctex, resolvePath } from './compile.js'
import { askNewProject } from './newproject.js'
import { commandList, menu } from './commands.js'
import { renderOutline, renderSnippets, renderSymbols, renderWelcome, renderProblems, allSnippets } from './panels.js'

const win = getCurrentWindow()
const $ = id => document.getElementById(id)
const TEXT_EXT = /\.(tex|sty|cls|bib|bbl|bst|ltx|dtx|ins|txt|md|log|blg|aux|toc|lof|lot|out|csv|tsv|json|xml|cfg|def|clo|fd|bbx|cbx|lbx|tikz|pgf|py|r|m|jl|lua|sh|bat|ps1|yml|yaml|toml|ini|gitignore|latexmkrc)$/i
const isTex = p => /\.(tex|ltx)$/i.test(p || '')
const EDITOR_KEYS = new Set(['editorFont', 'editorFontSize', 'lineHeight', 'ligatures', 'tabSize', 'wordWrap', 'lineNumbers',
  'highlightActiveLine', 'closeBrackets', 'autocomplete', 'tabTriggers', 'spellcheck', 'foldGutter'])
const MAX_INDEXED_FILES = 400

const app = {
  folder: null, compiling: false, pending: false, problems: [], output: '', sync: null, syncBase: null, pdfPath: null,
  index: new Map(), status: { kind: 'idle', text: 'Ready' }, panelTab: 'problems', manualCompile: false,
}

// ---------- project ----------

const folderKey = () => app.folder?.toLowerCase()
const mainFile = () => (app.folder && settings.mainFiles?.[folderKey()]) || null

function setMainFile(path) {
  if (!app.folder) return
  setSettings({ mainFiles: { ...settings.mainFiles, [folderKey()]: path } })
  renderExplorer()
  renderStatus()
}

function addRecent(path) {
  setSettings({ recent: [path, ...settings.recent.filter(p => !samePath(p, path))].slice(0, 10) })
}

async function openFolder(path, { restoring = false } = {}) {
  if (!path) {
    path = await openDialog({ directory: true, title: 'Open folder' })
    if (!path) return false
  }
  if (!(await invoke('path_exists', { path }))) {
    toast(`Folder not found: ${path}`, 'error')
    setSettings({ recent: settings.recent.filter(p => !samePath(p, path)) })
    renderSide()
    return false
  }
  if (app.folder && !samePath(app.folder, path)) {
    if (!(await settleUnsaved())) return false
    for (const t of [...editor.tabs]) await closeTab(t.path, { force: true })
  }
  app.folder = path
  app.problems = []
  app.sync = null
  app.pdfPath = null
  setProblems([])
  clearPdf()
  await loadFolder(path)
  addRecent(path)
  indexProject()
  renderAll()
  if (!restoring) {
    const main = mainFile() || allFiles().find(f => /\\main\.tex$/i.test(f))
    if (main && (await invoke('path_exists', { path: main }))) {
      if (!mainFile()) setMainFile(main)
      await openFile(main)
      await showPdfIfExists(main)
    }
    saveSession()
  }
  return true
}

/** One prompt for every unsaved tab. Returns false when the user cancels (or a save fails). */
async function settleUnsaved() {
  const dirty = editor.tabs.filter(t => t.dirty)
  if (!dirty.length) return true
  const r = await confirm('Unsaved changes', `${dirty.length} file${dirty.length > 1 ? 's have' : ' has'} unsaved changes.`, { ok: 'Save all', extra: "Don't save" })
  if (r === 'extra') return true
  if (r !== true) return false
  await saveAll()
  return !editor.tabs.some(t => t.dirty)
}

async function closeFolder() {
  if (!(await settleUnsaved())) return
  for (const t of [...editor.tabs]) await closeTab(t.path, { force: true })
  app.folder = null
  app.sync = null
  app.pdfPath = null
  app.problems = []
  clearPdf()
  unloadFolder()
  renderAll()
  saveSession()
}

async function openFile(path, { line, activate = true } = {}) {
  if (/\.pdf$/i.test(path)) return showPdf(path)
  if (ext(path) && !TEXT_EXT.test(path)) { invoke('open_path', { path }); return }
  if (!editor.find(path)) {
    let text
    try { text = await invoke('read_text', { path }) } catch (e) { toast(`Could not open ${basename(path)}: ${e}`, 'error'); return }
    openTab(path, text, { activate })
    indexFile(path, text)
  } else if (activate) activateTab(path)
  if (line) gotoLine(line)
  if (activate) reveal(path)
  saveSession()
}

async function saveTab(tab) {
  const doc = tabDoc(tab)
  const text = doc.toString()
  try {
    await invoke('write_text', { path: tab.path, text })
    markSaved(tab, doc)
    indexFile(tab.path, text)
    return true
  } catch (e) {
    toast(`Could not save ${basename(tab.path)}: ${e}`, 'error')
    return false
  }
}

async function saveAll() {
  for (const t of editor.tabs) if (t.dirty) await saveTab(t)
}

async function saveActive() {
  const t = editor.active
  if (!t) return
  if (t.dirty && !(await saveTab(t))) return
  if (settings.compileOnSave && /\.(tex|ltx|bib|sty|cls)$/i.test(t.path)) compile()
}

function indexFile(path, text) {
  if (/\.(tex|ltx|bib)$/i.test(path)) app.index.set(path.toLowerCase(), indexText(path, text))
}

async function indexProject() {
  app.index.clear()
  const files = allFiles().filter(f => /\.(tex|ltx|bib)$/i.test(f)).slice(0, MAX_INDEXED_FILES)
  await Promise.all(files.map(f => invoke('read_text', { path: f }).then(t => indexFile(f, t)).catch(() => {})))
}

function completionContext(path) {
  const labels = new Set(), bibkeys = new Set()
  for (const [k, v] of app.index) {
    if (editor.active && k === editor.active.path.toLowerCase()) continue
    v.labels.forEach(l => labels.add(l)); v.bibkeys.forEach(b => bibkeys.add(b))
  }
  if (editor.active) {
    const live = indexText(editor.active.path, tabText(editor.active))
    live.labels.forEach(l => labels.add(l)); live.bibkeys.forEach(b => bibkeys.add(b))
  }
  const dir = dirname(path).toLowerCase() + '\\'
  const files = allFiles().filter(f => f.toLowerCase().startsWith(dir)).map(f => f.slice(dir.length).replace(/\\/g, '/'))
  return { labels: [...labels], bibkeys: [...bibkeys], files, snippets: allSnippets() }
}

/** Which file to compile: "% !TEX root", the project's main file, the active file, or a detected root. */
async function resolveMain() {
  const t = editor.active
  if (t && /\.(tex|ltx)$/i.test(t.path)) {
    const head = tabText(t).split('\n', 30).join('\n')
    const m = /^%\s*!\s*TEX\s+root\s*=\s*(.+?)\s*$/im.exec(head)
    if (m) return resolvePath(dirname(t.path), m[1])
  }
  const main = mainFile()
  if (main && (await invoke('path_exists', { path: main }))) return main
  if (t && isTex(t.path) && /\\documentclass/.test(tabText(t))) { setMainFile(t.path); return t.path }
  for (const f of allFiles().filter(isTex).sort((a, b) => a.split('\\').length - b.split('\\').length)) {
    const text = await invoke('read_text', { path: f }).catch(() => '')
    if (/^\s*\\documentclass/m.test(text)) { setMainFile(f); return f }
  }
  return t && isTex(t.path) ? t.path : null
}

// ---------- compile ----------

function setStatus(kind, text) {
  app.status = { kind, text }
  renderStatus()
}

async function compile({ manual = true } = {}) {
  if (app.compiling) { app.pending = true; return }
  // Claimed before any await so a second trigger queues instead of starting a parallel compile.
  app.compiling = true
  const main = await resolveMain().catch(() => null)
  if (!main) { app.compiling = false; toast('Open a .tex file to compile it.'); return }
  app.manualCompile = manual
  document.body.classList.add('compiling')
  setStatus('busy', 'Compiling…')
  let slowTimer
  try {
    if (settings.saveAllBeforeCompile) await saveAll()
    else { const mt = editor.find(main); if (mt?.dirty) await saveTab(mt) }
    const ready = await ensureEngine(() => setStatus('busy', 'Downloading Tectonic…'))
    if (!ready) {
      setStatus('error', `${settings.engine} not found`)
      toast(`${settings.engine} was not found. Install MiKTeX or TeX Live, or choose Tectonic in Settings › Compilation.`, 'error', 7000)
      return
    }
    setStatus('busy', 'Compiling…')
    if (settings.engine === 'tectonic') {
      slowTimer = setTimeout(() => setStatus('busy', 'Compiling… (the first run downloads LaTeX packages)'), 5000)
    }
    const r = await compileFile(main)
    app.problems = r.problems
    app.output = r.output + (r.log ? '\n──────── log ────────\n' + r.log : '')
    setProblems(r.problems)
    renderPanel()
    const errors = r.problems.filter(p => p.severity === 'error').length
    if (r.pdf) {
      await showPdf(r.pdf, { reveal: false })
      app.sync = await loadSynctex(r.pdf).catch(() => null)
      app.syncBase = dirname(main)
    }
    const secs = (r.ms / 1000).toFixed(1)
    if (errors) {
      setStatus('error', `${errors} error${errors > 1 ? 's' : ''} · ${secs}s`)
      if (manual && !settings.panelVisible) togglePanel(true)
    } else setStatus('ok', `Compiled in ${secs}s`)
    if (settings.syncAfterCompile) forwardSync({ quiet: true })
  } catch (e) {
    setStatus('error', 'Compile failed')
    app.output = String(e)
    renderPanel()
    toast(String(e), 'error', 6000)
  } finally {
    clearTimeout(slowTimer)
    app.compiling = false
    document.body.classList.remove('compiling')
    renderStatus()
    if (app.pending) { app.pending = false; compile({ manual: false }) }
  }
}

function stopCompile() {
  app.pending = false
  invoke('cancel_compile')
}

const liveCompile = debounce(async () => {
  if (!settings.liveCompile || !editor.active) return
  for (const t of editor.tabs) if (t.dirty && /\.(tex|ltx|bib|sty|cls)$/i.test(t.path)) await saveTab(t)
  compile({ manual: false })
}, () => settings.liveDelay)

const autoSave = debounce(() => { for (const t of editor.tabs) if (t.dirty) saveTab(t) }, () => settings.autoSaveDelay)

// ---------- pdf ----------

async function showPdf(path, { reveal: doReveal = true } = {}) {
  if (!settings.pdfVisible) setSettings({ pdfVisible: true })
  try {
    if (await loadPdf(path)) {
      if (!samePath(app.pdfPath, path)) setZoom(settings.pdfZoom)
      app.pdfPath = path
      if (doReveal) saveSession()
    }
  } catch (e) {
    toast(`Could not show the PDF: ${e.message || e}`, 'error')
  }
  renderPdfChrome()
}

async function showPdfIfExists(texPath) {
  const pdf = texPath.replace(/\.[^.\\]+$/, '.pdf')
  if (!(await invoke('path_exists', { path: pdf }))) return
  await showPdf(pdf, { reveal: false })
  app.sync = await loadSynctex(pdf).catch(() => null)
  app.syncBase = dirname(texPath)
}

function forwardSync({ quiet = false } = {}) {
  const t = editor.active
  if (!t || !app.sync) { if (!quiet) toast('Compile the document first to link source and PDF.'); return }
  const line = editor.view.state.doc.lineAt(editor.view.state.selection.main.head).number
  const box = forwardSearch(app.sync, t.path, line, app.syncBase)
  if (box) showBox(box)
  else if (!quiet) toast('This line has no position in the PDF.')
}

async function inverseSync(page, x, y) {
  if (!app.sync) { toast('Compile the document to enable jumping to the source.'); return }
  const hit = inverseSearch(app.sync, page, x, y, app.syncBase)
  if (hit) await openFile(hit.file, { line: hit.line })
}

function renderPdfChrome() {
  const st = pdfState()
  const pageInput = $('pdf-page')
  if (document.activeElement !== pageInput) pageInput.value = st.page
  $('pdf-pages').textContent = '/ ' + st.pages
  $('pdf-zoom').textContent = Math.round(st.scale * 100) + '%'
  $('pdf-fit-width').setAttribute('aria-pressed', String(st.zoom === 'width'))
  $('pdf-fit-page').setAttribute('aria-pressed', String(st.zoom === 'page'))
  $('pdf-invert').setAttribute('aria-pressed', String(settings.pdfInvert))
  $('pdf-pane').classList.toggle('inverted', settings.pdfInvert)
  $('pdf-pane').classList.toggle('has-pdf', !!st.path)
}

// ---------- rendering ----------

function renderTitle() {
  const t = editor.active
  const parts = [t ? basename(t.path) + (t.dirty ? ' •' : '') : null, app.folder ? basename(app.folder) : null].filter(Boolean)
  const title = parts.length ? parts.join(' — ') : 'Galley'
  $('doc-title').textContent = title
  win.setTitle(parts.length ? `${parts.join(' — ')} — Galley` : 'Galley').catch(() => {})
}

function renderStatus() {
  const s = app.status
  const ic = { busy: '<span class="spinner"></span>', ok: icon('check'), error: icon('error'), idle: icon('bolt') }[s.kind]
  $('st-compile').innerHTML = `${ic}<span>${esc(s.text)}</span>`
  $('st-compile').className = 'status-item st-' + s.kind
  const errs = app.problems.filter(p => p.severity === 'error').length
  const warns = app.problems.filter(p => p.severity === 'warning').length
  $('st-problems').innerHTML = `${icon('error')}<span>${errs}</span>${icon('warning')}<span>${warns}</span>`
  $('st-problems').setAttribute('aria-label', `${errs} errors, ${warns} warnings. Toggle problems panel.`)
  const main = mainFile()
  $('st-main').innerHTML = `${icon('star')}<span>${esc(main ? basename(main) : 'No main file')}</span>`
  $('st-main').hidden = !app.folder
  $('st-engine').textContent = { tectonic: 'Tectonic', latexmk: 'latexmk', pdflatex: 'pdfLaTeX', xelatex: 'XeLaTeX', lualatex: 'LuaLaTeX' }[settings.engine]
  const btn = $('compile-btn')
  btn.classList.toggle('busy', app.compiling)
  btn.querySelector('.cb-icon').innerHTML = app.compiling ? icon('stop') : icon('play')
  btn.querySelector('.cb-label').textContent = app.compiling ? 'Stop' : 'Compile'
  btn.setAttribute('aria-label', app.compiling ? 'Stop compiling' : 'Compile (Ctrl+Enter)')
}

function renderCursor(state) {
  const sel = state.selection.main
  const line = state.doc.lineAt(sel.head)
  const n = sel.to - sel.from
  $('st-cursor').textContent = `Ln ${line.number}, Col ${sel.head - line.from + 1}${n ? ` (${n} selected)` : ''}`
  scheduleOutline()
}

const renderWords = debounce(() => {
  const t = editor.active
  $('st-words').textContent = t && isTex(t.path) ? `${wordCount(tabText(t)).toLocaleString()} words` : ''
}, 300)

let outlineRaf = 0
function scheduleOutline() {
  cancelAnimationFrame(outlineRaf)
  outlineRaf = requestAnimationFrame(() => {
    if (settings.sidebarView !== 'outline' || !settings.sidebarVisible) return
    const t = editor.active
    const items = t && isTex(t.path) ? outline(tabText(t)) : null
    const line = t ? editor.view.state.doc.lineAt(editor.view.state.selection.main.head).number : 0
    renderOutline($('outline'), items, line, l => gotoLine(l))
  })
}

function renderSide() {
  const hasFolder = !!app.folder
  $('folder-name').hidden = !hasFolder
  $('folder-name').innerHTML = hasFolder ? `${icon('folderOpen')}<span>${esc(basename(app.folder))}</span>` : ''
  $('folder-name').title = app.folder || ''
  $('explorer').hidden = !hasFolder
  $('files-tools').hidden = !hasFolder
  $('files-empty').hidden = hasFolder
  if (!hasFolder) {
    $('files-empty').replaceChildren(
      h('p', { text: 'No folder open.' }),
      h('button.btn.primary.block', { html: icon('folderOpen') + ' Open folder', on: { click: () => openFolder() } }),
      h('button.btn.block', { html: icon('newFile') + ' New project', on: { click: newProject } }),
      settings.recent.length ? h('h3.eyebrow', { text: 'Recent' }) : null,
      ...settings.recent.slice(0, 6).map(p => h('button.recent-mini', { title: p, text: basename(p), on: { click: () => openFolder(p) } })))
  }
  renderSnippets($('snippets'), $('snip-filter').value, insertSnippet, () => openSettings('snippets'))
  renderSymbols($('symbols'), $('sym-filter').value, insertSnippet)
  scheduleOutline()
}

function renderWelcomeScreen() {
  const show = !editor.active
  $('welcome').hidden = !show
  $('editor-host').hidden = show
  if (show) renderWelcome($('welcome'), { recent: settings.recent, hasFolder: !!app.folder, actions: { openFolder, newProject, palette: commandPalette } })
}

function renderPanel() {
  const counts = app.problems.length
  $('problem-count').textContent = counts
  document.querySelectorAll('.panel-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.panel === app.panelTab)))
  $('panel-problems').hidden = app.panelTab !== 'problems'
  $('panel-output').hidden = app.panelTab !== 'output'
  renderProblems($('panel-problems'), app.problems, app.folder, p => openFile(p.file, { line: p.line }))
  $('panel-output').textContent = app.output || 'Nothing compiled yet.'
  renderStatus()
}

function applyLayout() {
  const root = document.documentElement.style
  root.setProperty('--sidebar-w', settings.sidebarWidth + 'px')
  root.setProperty('--pdf-w', settings.pdfWidth * 100 + '%')
  root.setProperty('--panel-h', settings.panelHeight + 'px')
  const a = $('app').classList
  a.toggle('no-sidebar', !settings.sidebarVisible)
  a.toggle('no-pdf', !settings.pdfVisible)
  a.toggle('no-panel', !settings.panelVisible)
  document.querySelectorAll('.act[data-view]').forEach(b => {
    const on = settings.sidebarVisible && b.dataset.view === settings.sidebarView
    b.setAttribute('aria-selected', String(on))
    b.tabIndex = b.dataset.view === settings.sidebarView ? 0 : -1
  })
  document.querySelectorAll('.side-view').forEach(v => { v.hidden = v.dataset.view !== settings.sidebarView })
  $('toggle-pdf').setAttribute('aria-pressed', String(settings.pdfVisible))
}

function renderAll() {
  applyLayout()
  renderSide()
  renderExplorer()
  renderWelcomeScreen()
  renderTitle()
  renderPanel()
  renderPdfChrome()
}

// ---------- session ----------

function saveSession() {
  setSettings({ session: { folder: app.folder, tabs: editor.tabs.map(t => t.path), active: editor.active?.path ?? null, pdf: app.pdfPath } })
}

async function restore() {
  const arg = await invoke('launch_arg')
  if (arg && (await invoke('path_exists', { path: arg }))) {
    if (TEXT_EXT.test(arg) || /\.pdf$/i.test(arg)) {
      if (await openFolder(dirname(arg), { restoring: true })) await openFile(arg)
    } else await openFolder(arg)
    return
  }
  const s = settings.session
  if (!settings.restoreSession || !s?.folder) return
  if (!(await openFolder(s.folder, { restoring: true }))) return
  for (const p of s.tabs || []) if (await invoke('path_exists', { path: p })) await openFile(p, { activate: false })
  if (s.active && editor.find(s.active)) activateTab(s.active)
  else if (editor.tabs[0]) activateTab(editor.tabs[0].path)
  const main = mainFile()
  if (main) await showPdfIfExists(main)
  else if (s.pdf && (await invoke('path_exists', { path: s.pdf }))) await showPdf(s.pdf, { reveal: false })
}

async function requestClose() {
  if (!(await settleUnsaved())) return
  saveSession()
  await saveNow().catch(() => {})
  await win.destroy()
}

// ---------- new project ----------

async function newProject() {
  const res = await askNewProject()
  if (!res) return
  const folder = joinPath(res.location, res.name)
  const main = joinPath(folder, 'main.tex')
  try {
    await invoke('create_dir', { path: folder })
    await invoke('create_file', { path: main, text: TEMPLATES.find(t => t.id === res.tpl).body })
  } catch (e) { toast(String(e), 'error'); return }
  if (!(await openFolder(folder, { restoring: true }))) return
  setMainFile(main)
  await openFile(main)
  compile()
}

// ---------- commands ----------

function toggleSidebar(view) {
  if (typeof view === 'string') {
    const same = settings.sidebarView === view && settings.sidebarVisible
    setSettings({ sidebarView: view, sidebarVisible: !same })
  } else setSettings({ sidebarVisible: !settings.sidebarVisible })
  renderSide()
}
const togglePdf = () => setSettings({ pdfVisible: !settings.pdfVisible })
const togglePanel = force => setSettings({ panelVisible: typeof force === 'boolean' ? force : !settings.panelVisible })

function cycleTab(dir) {
  const tabs = editor.tabs
  if (tabs.length < 2) return
  const i = tabs.indexOf(editor.active)
  activateTab(tabs[(i + dir + tabs.length) % tabs.length].path)
}

function chooseMainFile() {
  if (!app.folder) return
  openPalette({ placeholder: 'Choose the main file to compile', items: allFiles().filter(isTex).map(f => ({
    label: f.slice(app.folder.length + 1), icon: 'fileTex', detail: samePath(f, mainFile()) ? 'current' : '', run: () => setMainFile(f),
  })) })
}

const actions = () => ({ app, compile, stopCompile, forwardSync, chooseMainFile, setMainFile, newProject, openFolder, openFileDialog,
  saveActive, saveAll, closeFolder, toggleSidebar, togglePdf, togglePanel, requestClose, commandPalette, quickOpen })
const commands = () => commandList(actions())

const commandPalette = () => openPalette({ placeholder: 'Type a command', initial: '>', getCommands: commands, getFiles: fileItems })
const quickOpen = () => openPalette({ placeholder: 'Search files by name (type > for commands)', getCommands: commands, getFiles: fileItems })

function fileItems() {
  if (!app.folder) return [{ label: 'Open a folder first…', icon: 'folderOpen', run: () => openFolder() }]
  return allFiles().map(f => ({ label: f.slice(app.folder.length + 1), icon: 'file', run: () => openFile(f) }))
}

async function openFileDialog() {
  const p = await openDialog({ filters: [{ name: 'LaTeX', extensions: ['tex', 'bib', 'sty', 'cls', 'pdf'] }, { name: 'All files', extensions: ['*'] }] })
  if (!p) return
  if (!app.folder || !p.toLowerCase().startsWith(app.folder.toLowerCase() + '\\')) {
    if (!(await openFolder(dirname(p), { restoring: true }))) return
  }
  await openFile(p)
}

// ---------- wiring ----------

function setupChrome() {
  const set = (id, name) => { $(id).innerHTML = icon(name) }
  set('toggle-pdf', 'pdf'); set('open-settings', 'settings'); set('act-settings', 'settings'); set('panel-close', 'close')
  set('wc-min', 'minus'); set('wc-max', 'maximize'); set('wc-close', 'close')
  set('pdf-zoom-out', 'zoomOut'); set('pdf-zoom-in', 'zoomIn'); set('pdf-fit-width', 'fitWidth'); set('pdf-fit-page', 'fitPage')
  set('pdf-invert', 'contrast'); set('pdf-sync', 'sync'); set('pdf-external', 'external')
  document.querySelector('.ts-icon').innerHTML = icon('search')
  const views = { files: 'files', outline: 'outline', snippets: 'snippets', symbols: 'symbols' }
  document.querySelectorAll('.act[data-view]').forEach(b => {
    b.innerHTML = icon(views[b.dataset.view])
    b.addEventListener('click', () => toggleSidebar(b.dataset.view))
  })
  document.querySelector('.activitybar').addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const acts = [...document.querySelectorAll('.act')]
    const i = acts.indexOf(document.activeElement)
    e.preventDefault()
    acts[(i + (e.key === 'ArrowDown' ? 1 : -1) + acts.length) % acts.length].focus()
  })
  $('files-tools').append(
    h('button.icon-btn', { 'aria-label': 'New file', title: 'New file', html: icon('newFile'), on: { click: () => newFile() } }),
    h('button.icon-btn', { 'aria-label': 'New folder', title: 'New folder', html: icon('newFolder'), on: { click: () => newFolder() } }),
    h('button.icon-btn', { 'aria-label': 'Refresh', title: 'Refresh', html: icon('refresh'), on: { click: refreshExplorer } }),
    h('button.icon-btn', { 'aria-label': 'Collapse all', title: 'Collapse all', html: icon('collapse'), on: { click: collapseAll } }))
  $('snip-tools').append(h('button.icon-btn', { 'aria-label': 'New snippet', title: 'New snippet', html: icon('plus'), on: { click: () => openSettings('snippets') } }))

  $('act-settings').addEventListener('click', () => openSettings())
  $('open-settings').addEventListener('click', () => openSettings())
  $('toggle-pdf').addEventListener('click', togglePdf)
  $('title-search').addEventListener('click', quickOpen)
  $('compile-btn').addEventListener('click', () => app.compiling ? stopCompile() : compile())
  $('panel-close').addEventListener('click', () => togglePanel(false))
  $('st-problems').addEventListener('click', () => togglePanel())
  $('st-compile').addEventListener('click', () => { app.panelTab = 'output'; togglePanel(true); renderPanel() })
  $('st-main').addEventListener('click', chooseMainFile)
  $('st-engine').addEventListener('click', () => openSettings('compile'))
  document.querySelectorAll('.panel-tab').forEach(b => b.addEventListener('click', () => { app.panelTab = b.dataset.panel; renderPanel() }))
  $('snip-filter').addEventListener('input', () => renderSnippets($('snippets'), $('snip-filter').value, insertSnippet, () => openSettings('snippets')))
  $('sym-filter').addEventListener('input', () => renderSymbols($('symbols'), $('sym-filter').value, insertSnippet))

  document.querySelectorAll('.menu-btn').forEach(b => {
    const openIt = () => { const r = b.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, menu(b.dataset.menu, actions()), { label: b.textContent, anchor: b }) }
    b.addEventListener('click', openIt)
    b.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); openIt() } })
  })

  $('wc-min').addEventListener('click', () => win.minimize())
  $('wc-max').addEventListener('click', () => win.toggleMaximize())
  $('wc-close').addEventListener('click', requestClose)
  const syncMax = async () => {
    const max = await win.isMaximized()
    document.documentElement.classList.toggle('maximized', max)
    $('wc-max').innerHTML = icon(max ? 'restore' : 'maximize')
    $('wc-max').setAttribute('aria-label', max ? 'Restore' : 'Maximize')
  }
  win.onResized(syncMax)
  syncMax()
  win.onCloseRequested(e => { e.preventDefault(); requestClose() })
  listen('tray-quit', requestClose)
  win.onFocusChanged(async ({ payload: focused }) => {
    if (!focused) { if (settings.autoSave === 'focus') saveAll(); return }
    if (!app.folder) return
    await refreshExplorer()
    for (const t of editor.tabs) {
      if (t.dirty) continue
      const text = await invoke('read_text', { path: t.path }).catch(() => null)
      if (text !== null) reloadTab(t, text)
    }
  })

  // PDF toolbar
  $('pdf-zoom-in').addEventListener('click', () => zoomBy(1.15))
  $('pdf-zoom-out').addEventListener('click', () => zoomBy(1 / 1.15))
  $('pdf-fit-width').addEventListener('click', () => setZoom('width'))
  $('pdf-fit-page').addEventListener('click', () => setZoom('page'))
  $('pdf-invert').addEventListener('click', () => setSettings({ pdfInvert: !settings.pdfInvert }))
  $('pdf-sync').addEventListener('click', () => forwardSync())
  $('pdf-external').addEventListener('click', () => app.pdfPath && invoke('open_path', { path: app.pdfPath }))
  $('pdf-zoom').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect()
    showMenu(r.left, r.bottom + 4, [
      { label: 'Fit width', icon: 'fitWidth', action: () => setZoom('width') },
      { label: 'Fit page', icon: 'fitPage', action: () => setZoom('page') },
      '-', ...[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(z => ({ label: z * 100 + '%', action: () => setZoom(z) })),
    ], { label: 'Zoom' })
  })
  $('pdf-page').addEventListener('change', e => goToPage(parseInt(e.target.value, 10) || 1))
  $('pdf-page').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur() })
  $('pdf-scroll').addEventListener('keydown', e => {
    const sc = $('pdf-scroll')
    if (e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End') return
    if (e.key === 'ArrowDown') sc.scrollBy(0, 60)
    else if (e.key === 'ArrowUp') sc.scrollBy(0, -60)
    else return
    e.preventDefault()
  })
  $('pdf-empty').innerHTML = `<div class="pdf-empty-inner"><div class="sheet" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <p><strong>Your PDF appears here</strong></p><p>Compile with <kbd>Ctrl</kbd> <kbd>Enter</kbd>. With live preview on, it updates as you type.</p></div>`
}

function setupSashes() {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const root = document.documentElement.style
  let tmp = {}
  dragHandle($('sash-sidebar'), {
    onStart: () => settings.sidebarWidth,
    onMove: (d, w0) => { tmp.sidebarWidth = clamp(w0 + d, 170, 620); root.setProperty('--sidebar-w', tmp.sidebarWidth + 'px') },
    onEnd: () => { setSettings(tmp); tmp = {} },
  })
  dragHandle($('sash-pdf'), {
    onStart: () => ({ w0: $('pdf-pane').offsetWidth, total: document.querySelector('.workbench').offsetWidth }),
    onMove: (d, c) => { tmp.pdfWidth = clamp((c.w0 - d) / c.total, 0.18, 0.8); root.setProperty('--pdf-w', tmp.pdfWidth * 100 + '%') },
    onEnd: () => { setSettings(tmp); tmp = {} },
  })
  dragHandle($('sash-panel'), {
    axis: 'y',
    onStart: () => settings.panelHeight,
    onMove: (d, h0) => { tmp.panelHeight = clamp(h0 - d, 80, innerHeight * 0.7); root.setProperty('--panel-h', tmp.panelHeight + 'px') },
    onEnd: () => { setSettings(tmp); tmp = {} },
  })
  const keys = (id, fn) => $(id).addEventListener('keydown', e => {
    const d = { ArrowLeft: -16, ArrowUp: -16, ArrowRight: 16, ArrowDown: 16 }[e.key]
    if (d === undefined) return
    e.preventDefault()
    fn(d)
  })
  keys('sash-sidebar', d => setSettings({ sidebarWidth: clamp(settings.sidebarWidth + d, 170, 620) }))
  keys('sash-pdf', d => setSettings({ pdfWidth: clamp(settings.pdfWidth - d / document.querySelector('.workbench').offsetWidth, 0.18, 0.8) }))
  keys('sash-panel', d => setSettings({ panelHeight: clamp(settings.panelHeight - d, 80, innerHeight * 0.7) }))
}

function setupKeys() {
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const combo = (e.ctrlKey ? 'C' : '') + (e.shiftKey ? 'S' : '') + (e.altKey ? 'A' : '') + '+' + k
    const map = {
      'C+p': quickOpen, 'CS+p': commandPalette, 'C+o': () => openFolder(), 'C+n': () => app.folder ? newFile() : newProject(),
      'C+w': () => editor.active && closeTab(editor.active.path), 'C+s': saveActive, 'CS+s': saveAll, 'C+Enter': () => compile(),
      'CS+b': () => toggleSidebar(), 'C+j': () => togglePanel(), 'CA+p': togglePdf, 'CA+j': () => forwardSync(),
      'C+=': () => zoomBy(1.15), 'C++': () => zoomBy(1.15), 'CS++': () => zoomBy(1.15), 'C+-': () => zoomBy(1 / 1.15), 'C+0': () => setZoom('width'),
      'C+,': () => openSettings(), '+F1': () => openSettings('keys'), 'C+Tab': () => cycleTab(1), 'CS+Tab': () => cycleTab(-1),
      '+F5': () => compile(), 'C+r': () => {}, 'CS+r': () => {}, 'C+f': () => editor.active && openSearchPanel(editor.view),
    }
    const fn = map[combo]
    if (!fn) return
    e.preventDefault()
    fn()
  })
  // Keep the native menu (spelling suggestions, copy/paste) only where text is edited.
  document.addEventListener('contextmenu', e => {
    if (!e.defaultPrevented && !e.target.closest('input, textarea, .cm-content, .output')) e.preventDefault()
  })
}

async function boot() {
  await loadSettings()
  applyAppearance()
  setupChrome()
  initEditor($('editor-host'), $('tabs'), {
    onChange: tab => {
      renderTitle()
      renderWords()
      scheduleOutline()
      if (settings.liveCompile && tab.dirty && /\.(tex|ltx|bib|sty|cls)$/i.test(tab.path)) liveCompile()
      if (settings.autoSave === 'delay') autoSave()
    },
    onCursor: renderCursor,
    onSave: saveActive,
    onCompile: () => compile(),
    onForwardSync: () => forwardSync(),
    onActivate: () => { renderWelcomeScreen(); renderTitle(); renderWords(); scheduleOutline(); saveSession(); if (!editor.active) $('st-cursor').textContent = '' },
    onTabMenu: (tab, x, y) => tabMenu(tab, x, y, [
      isTex(tab.path) && { label: 'Set as main file', icon: 'star', action: () => setMainFile(tab.path) },
      { label: 'Reveal in explorer', icon: 'files', action: () => { toggleSidebar('files'); reveal(tab.path) } },
      { label: 'Reveal in File Explorer', icon: 'external', action: () => invoke('reveal', { path: tab.path }) },
      { label: 'Copy path', icon: 'copy', action: () => navigator.clipboard.writeText(tab.path) },
    ].filter(Boolean)),
    saveTab,
    completionContext,
    snippets: allSnippets,
  })
  initExplorer($('explorer'), {
    onOpen: path => openFile(path),
    onRenamed: (from, to) => {
      renameTab(from, to)
      if (samePath(mainFile(), from)) setMainFile(to)
      indexProject()
      saveSession()
    },
    onDeleted: async path => {
      const lower = path.toLowerCase()
      const gone = editor.tabs.filter(t => samePath(t.path, path) || t.path.toLowerCase().startsWith(lower + '\\'))
      // Unsaved tabs stay open so their text can still be saved (which recreates the file).
      for (const t of gone) if (!t.dirty) await closeTab(t.path, { force: true })
      if (gone.some(t => t.dirty)) toast('Files with unsaved changes were kept open. Save them to restore the files.', 'info', 6000)
      indexProject()
    },
    mainFile,
    setMainFile,
    openTabs: () => editor.tabs.map(t => t.path),
  })
  initPdf($('pdf-scroll'), { onChange: renderPdfChrome, onInverse: inverseSync })
  setupSashes()
  setupKeys()
  onSettings(keys => {
    applyAppearance()
    applyLayout()
    if (keys.some(k => EDITOR_KEYS.has(k))) refreshSettings()
    if (keys.includes('showHidden')) refreshExplorer()
    if (keys.includes('customSnippets')) renderSide()
    if (keys.includes('pdfZoom')) setZoom(settings.pdfZoom)
    if (keys.includes('sidebarView') || keys.includes('sidebarVisible')) scheduleOutline()
    renderPdfChrome()
    renderStatus()
  })
  renderAll()
  await win.show()
  await restore().catch(e => { console.error('restore failed', e); toast('Could not restore the last session.', 'error') })
  renderAll()
}

if (import.meta.env.DEV) window.__kt = { editor, app, settings, openFolder }

boot()
  .catch(e => { console.error('boot failed', e); toast(`Galley could not start properly: ${e.message || e}`, 'error', 10000) })
  .finally(() => win.show())
