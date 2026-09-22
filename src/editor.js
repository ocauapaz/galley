// Editor: one CodeMirror view, one EditorState per open tab, plus the tab strip.
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment, EditorSelection } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentOnInput, bracketMatching, foldGutter, foldKeymap, indentUnit } from '@codemirror/language'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, acceptCompletion, completionStatus, snippet } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search'
import { setDiagnostics, lintGutter } from '@codemirror/lint'
import { latexLanguage, latexHighlight, latexCompletions } from './latex.js'
import { settings } from './settings.js'
import { h, icon, esc, basename, samePath, showMenu, confirm, ext } from './ui.js'

const LATEX_EXT = new Set(['tex', 'sty', 'cls', 'bib', 'ltx', 'dtx', 'bbx', 'cbx', 'tikz'])

const comp = {
  lineNumbers: new Compartment(), wrap: new Compartment(), activeLine: new Compartment(), brackets: new Compartment(),
  complete: new Compartment(), tabs: new Compartment(), spell: new Compartment(), fold: new Compartment(), lang: new Compartment(),
}

function settingEffects(path) {
  const isLatex = LATEX_EXT.has(ext(path))
  return [
    comp.lineNumbers.reconfigure(settings.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
    comp.wrap.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []),
    comp.activeLine.reconfigure(settings.highlightActiveLine ? highlightActiveLine() : []),
    comp.brackets.reconfigure(settings.closeBrackets ? closeBrackets() : []),
    comp.complete.reconfigure(isLatex ? autocompletion({ override: [latexCompletions(() => ctx.completionContext(path))], activateOnTyping: settings.autocomplete, icons: false }) : []),
    comp.tabs.reconfigure([EditorState.tabSize.of(settings.tabSize), indentUnit.of(' '.repeat(settings.tabSize))]),
    comp.spell.reconfigure(EditorView.contentAttributes.of({ spellcheck: settings.spellcheck ? 'true' : 'false', autocorrect: 'off', autocapitalize: 'off' })),
    comp.fold.reconfigure(settings.foldGutter ? foldGutter({ markerDOM: open => h('span.fold', { html: icon('chevron', open ? 'open' : '') }) }) : []),
    comp.lang.reconfigure(isLatex ? [latexLanguage, latexHighlight] : []),
  ]
}

// Wraps the selection in \cmd{...}, or inserts \cmd{} with the cursor inside.
const wrapWith = cmd => view => {
  view.dispatch(view.state.changeByRange(r => {
    const text = view.state.sliceDoc(r.from, r.to)
    const insert = `\\${cmd}{${text}}`
    const pos = r.empty ? r.from + cmd.length + 2 : r.from + insert.length
    return { changes: { from: r.from, to: r.to, insert }, range: EditorSelection.cursor(pos) }
  }))
  return true
}

// Expands a snippet whose trigger is the word right before the cursor ("fig" + Tab).
function expandTrigger(view) {
  if (!settings.tabTriggers || !LATEX_EXT.has(ext(ctx.activePath() || ''))) return false
  const sel = view.state.selection.main
  if (!sel.empty || view.state.selection.ranges.length > 1) return false
  const line = view.state.doc.lineAt(sel.head)
  const m = /(?:^|[^\\\w])(\w+)$/.exec(line.text.slice(0, sel.head - line.from))
  if (!m) return false
  const s = ctx.snippets().find(x => x.trigger === m[1])
  if (!s) return false
  snippet(s.body)(view, null, sel.head - m[1].length, sel.head)
  return true
}

const ctx = {}
let view
const tabs = []
let active = null
let stripEl

function baseExtensions(path) {
  return [
    Object.values(comp).map(c => c.of([])),
    highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true),
    indentOnInput(), bracketMatching(), rectangularSelection(), crosshairCursor(), highlightSelectionMatches(),
    search({ top: true }), lintGutter(),
    keymap.of([
      { key: 'Mod-s', run: () => { ctx.onSave(); return true }, preventDefault: true },
      { key: 'Mod-Enter', run: () => { ctx.onCompile(); return true } },
      { key: 'Mod-Alt-j', run: () => { ctx.onForwardSync(); return true } },
      { key: 'Mod-b', run: wrapWith('textbf') },
      { key: 'Mod-i', run: wrapWith('textit') },
      { key: 'Mod-Shift-e', run: wrapWith('emph') },
      { key: 'Tab', run: v => completionStatus(v.state) === 'active' ? acceptCompletion(v) : expandTrigger(v) },
      ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab,
    ]),
    EditorView.updateListener.of(u => {
      if (!active) return
      if (u.docChanged) {
        active.state = u.state
        const dirty = !u.state.doc.eq(active.saved)
        if (dirty !== active.dirty) { active.dirty = dirty; renderTabs() }
        ctx.onChange(active)
      }
      if (u.docChanged || u.selectionSet) ctx.onCursor(u.state)
    }),
    EditorView.domEventHandlers({ focus: () => ctx.onFocus?.() }),
    EditorView.contentAttributes.of({ 'aria-label': 'LaTeX source editor' }),
  ]
}

function newState(path, text) {
  const state = EditorState.create({ doc: text, extensions: baseExtensions(path) })
  return state.update({ effects: settingEffects(path) }).state
}

/**
 * callbacks: onChange(tab), onCursor(state), onSave(), onCompile(), onForwardSync(), onActivate(tab|null),
 * onTabMenu(tab, x, y), completionContext(path), snippets(), activePath()
 */
export function initEditor(host, strip, callbacks) {
  Object.assign(ctx, callbacks, { activePath: () => active?.path })
  stripEl = strip
  view = new EditorView({ parent: host, state: EditorState.create({ doc: '' }) })
  strip.addEventListener('keydown', e => {
    const btns = [...strip.querySelectorAll('[role=tab]')]
    const i = btns.indexOf(document.activeElement)
    if (i < 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length].focus()
    } else if (e.key === 'Delete') closeTab(tabs[i].path)
  })
  return view
}

export const editor = {
  get view() { return view },
  get tabs() { return tabs },
  get active() { return active },
  find: path => tabs.find(t => samePath(t.path, path)),
}

export function openTab(path, text, { activate = true } = {}) {
  let tab = editor.find(path)
  if (!tab) {
    const state = newState(path, text)
    tab = { path, state, saved: state.doc, dirty: false, scroll: 0, diagnostics: [] }
    tabs.push(tab)
  }
  if (activate) activateTab(tab.path)
  else renderTabs()
  return tab
}

export function activateTab(path) {
  const tab = editor.find(path)
  if (!tab) return
  if (active && active !== tab) {
    active.state = view.state
    active.scroll = view.scrollDOM.scrollTop
  }
  if (active !== tab) {
    active = tab
    view.setState(tab.state)
    view.dispatch({ effects: settingEffects(tab.path) })
    view.dispatch(setDiagnostics(view.state, tab.diagnostics))
    tab.state = view.state
    requestAnimationFrame(() => { view.scrollDOM.scrollTop = tab.scroll })
  }
  renderTabs()
  ctx.onActivate(tab)
  ctx.onCursor(view.state)
}

/** Closes a tab; asks first when it has unsaved changes. Returns false if the user cancelled. */
export async function closeTab(path, { force = false } = {}) {
  const tab = editor.find(path)
  if (!tab) return true
  if (tab.dirty && !force) {
    const r = await confirm('Unsaved changes', `Save changes to ${basename(tab.path)} before closing?`, { ok: 'Save', extra: "Don't save" })
    if (r === true) { if (!(await ctx.saveTab(tab))) return false }
    else if (r !== 'extra') return false
  }
  const i = tabs.indexOf(tab)
  tabs.splice(i, 1)
  if (active === tab) {
    active = null
    const next = tabs[Math.min(i, tabs.length - 1)]
    if (next) activateTab(next.path)
    else { view.setState(EditorState.create({ doc: '' })); ctx.onActivate(null) }
  }
  renderTabs()
  return true
}

export const tabDoc = tab => (tab === active ? view.state : tab.state).doc

/** `doc` is the content that was written; edits typed while the write was in flight stay dirty. */
export function markSaved(tab, doc) {
  tab.saved = doc
  tab.dirty = !tabDoc(tab).eq(doc)
  renderTabs()
}

/** Replaces a clean tab's content when the file changed on disk. Dirty tabs are never overwritten. */
export function reloadTab(tab, text) {
  const state = tab === active ? view.state : tab.state
  if (tab.dirty || state.doc.toString() === text) return
  const tr = state.update({ changes: { from: 0, to: state.doc.length, insert: text } })
  if (tab === active) view.dispatch(tr)
  tab.state = tr.state
  tab.saved = tr.state.doc
  tab.dirty = false
  renderTabs()
}

export function renameTab(oldPath, newPath) {
  for (const t of tabs) {
    if (samePath(t.path, oldPath)) t.path = newPath
    else if (t.path.toLowerCase().startsWith(oldPath.toLowerCase() + '\\')) t.path = newPath + t.path.slice(oldPath.length)
  }
  renderTabs()
}

export const tabText = tab => (tab === active ? view.state : tab.state).doc.toString()

export function gotoLine(line, col = 0) {
  const doc = view.state.doc
  const l = doc.line(Math.max(1, Math.min(line, doc.lines)))
  const pos = Math.min(l.from + col, l.to)
  view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
  view.focus()
}

export function insertSnippet(body) {
  if (!active) return
  const r = view.state.selection.main
  snippet(body)(view, null, r.from, r.to)
  view.focus()
}

export function refreshSettings() {
  if (active) view.dispatch({ effects: settingEffects(active.path) })
  for (const t of tabs) if (t !== active) t.state = t.state.update({ effects: settingEffects(t.path) }).state
}

/** problems: [{ severity, file, line, message }] with absolute file paths. */
export function setProblems(problems) {
  for (const t of tabs) {
    const state = t === active ? view.state : t.state
    t.diagnostics = problems.filter(p => p.line && samePath(p.file, t.path) && p.line <= state.doc.lines).map(p => {
      const line = state.doc.line(p.line)
      return { from: line.from, to: line.to, severity: p.severity, message: p.message }
    })
    if (t === active) view.dispatch(setDiagnostics(view.state, t.diagnostics))
    else t.state = t.state.update(setDiagnostics(t.state, t.diagnostics)).state
  }
}

function renderTabs() {
  stripEl.replaceChildren(...tabs.map(t => {
    const isActive = t === active
    const name = basename(t.path)
    const el = h('div.tab', {
      class: 'tab' + (isActive ? ' active' : '') + (t.dirty ? ' dirty' : ''), role: 'tab', 'aria-selected': String(isActive),
      tabindex: isActive ? '0' : '-1', title: t.path, 'aria-label': name + (t.dirty ? ', unsaved' : ''),
      html: `${icon(/\.bib$/i.test(name) ? 'fileBib' : /\.tex$/i.test(name) ? 'fileTex' : 'file')}<span class="tab-name">${esc(name)}</span>`,
      on: {
        click: () => activateTab(t.path),
        auxclick: e => { if (e.button === 1) closeTab(t.path) },
        keydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(t.path) } },
        contextmenu: e => { e.preventDefault(); ctx.onTabMenu(t, e.clientX, e.clientY) },
      },
    })
    el.append(h('button.tab-close', {
      tabindex: '-1', 'aria-label': `Close ${name}`, title: 'Close (Ctrl+W)', html: `<span class="dot"></span>${icon('close')}`,
      on: { click: e => { e.stopPropagation(); closeTab(t.path) } },
    }))
    return el
  }))
  stripEl.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

export function tabMenu(tab, x, y, extra) {
  showMenu(x, y, [
    { label: 'Close', kbd: 'Ctrl+W', icon: 'close', action: () => closeTab(tab.path) },
    { label: 'Close others', action: async () => { for (const t of [...tabs]) if (t !== tab && !(await closeTab(t.path))) return } },
    { label: 'Close all', action: async () => { for (const t of [...tabs]) if (!(await closeTab(t.path))) return } },
    '-', ...extra,
  ], { label: 'Tab actions' })
}

/** Rough word count for LaTeX source: ignores comments, commands and math delimiters. */
export function wordCount(text) {
  const stripped = text.replace(/(^|[^\\])%.*$/gm, '$1').replace(/\\[a-zA-Z@]+\*?/g, ' ').replace(/\$[^$]*\$/g, ' x ')
  return (stripped.match(/\p{L}[\p{L}\p{N}'’-]*/gu) || []).length
}
