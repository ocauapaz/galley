// Settings window: schema-driven controls, custom snippet manager, shortcut reference.
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { settings, setSettings, DEFAULTS, THEMES } from './settings.js'
import { h, icon, esc, modal, confirm } from './ui.js'

const ACCENTS = ['', '#e85d3a', '#d4a72c', '#3fae6a', '#2f9fd8', '#6f7bf7', '#c05bd6', '#e0508a']
const FONTS = [
  ["'JetBrains Mono Variable'", 'JetBrains Mono'], ["'Fira Code'", 'Fira Code'], ["'IBM Plex Mono'", 'IBM Plex Mono'],
  ["'Cascadia Code'", 'Cascadia Code (system)'], ['Consolas', 'Consolas (system)'],
]

export const SHORTCUTS = [
  ['Ctrl+S', 'Save (and compile, if enabled)'], ['Ctrl+Shift+S', 'Save all'], ['Ctrl+Enter', 'Compile'], ['Ctrl+Alt+J', 'Show cursor position in PDF'],
  ['Double-click PDF', 'Jump to the source line'], ['Ctrl+P', 'Quick open file'], ['Ctrl+Shift+P', 'Command palette'], ['Ctrl+N', 'New file'],
  ['Ctrl+O', 'Open folder'], ['Ctrl+W', 'Close tab'], ['Ctrl+Tab', 'Next tab'], ['Ctrl+B / Ctrl+I', 'Bold / italic'], ['Ctrl+Shift+E', 'Emphasis'],
  ['Ctrl+/', 'Toggle comment'], ['Ctrl+F / Ctrl+H', 'Find / replace'], ['Tab', 'Accept completion, expand snippet trigger, next field'],
  ['Ctrl+Space', 'Show completions'], ['Ctrl+[ / Ctrl+]', 'Indent less / more'], ['Ctrl+Shift+[ / ]', 'Fold / unfold'], ['Ctrl+Alt+Up/Down', 'Add cursor above / below'],
  ['Ctrl+Shift+B', 'Toggle sidebar'], ['Ctrl+J', 'Toggle problems panel'], ['Ctrl+Alt+P', 'Toggle PDF preview'], ['Ctrl+= / Ctrl+-', 'Zoom PDF'],
  ['Ctrl+,', 'Settings'], ['F1', 'Keyboard shortcuts'],
]

const S = (key, label, desc, type, opts = {}) => ({ key, label, desc, type, ...opts })

const SECTIONS = [
  { id: 'appearance', name: 'Appearance', items: [
    S('theme', 'Theme', 'Colors of the whole app. High contrast themes maximise legibility.', 'themes'),
    S('accent', 'Accent color', 'Used for highlights, the caret and active items.', 'accent'),
    S('uiScale', 'Interface size', 'Scales all text and controls.', 'range', { min: 80, max: 160, step: 5, unit: '%' }),
    S('density', 'Density', 'Spacing between items in lists and toolbars.', 'select', { options: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']] }),
    S('reduceMotion', 'Reduce motion', 'Turns off animations and smooth scrolling.', 'select', { options: [['system', 'Follow Windows'], ['on', 'On'], ['off', 'Off']] }),
  ] },
  { id: 'editor', name: 'Editor', items: [
    S('editorFont', 'Font', 'Monospaced font for the source editor.', 'select', { options: FONTS }),
    S('editorFontSize', 'Font size', '', 'range', { min: 10, max: 28, step: 1, unit: 'px' }),
    S('lineHeight', 'Line height', '', 'range', { min: 1.2, max: 2.2, step: 0.1, unit: '×' }),
    S('ligatures', 'Font ligatures', 'Combine character pairs like -> into one glyph (fonts that support it).', 'toggle'),
    S('tabSize', 'Indent size', '', 'select', { options: [[2, '2 spaces'], [4, '4 spaces'], [8, '8 spaces']], number: true }),
    S('wordWrap', 'Word wrap', 'Wrap long lines to the editor width.', 'toggle'),
    S('lineNumbers', 'Line numbers', '', 'toggle'),
    S('highlightActiveLine', 'Highlight current line', '', 'toggle'),
    S('foldGutter', 'Code folding', 'Arrows in the gutter to collapse environments and sections.', 'toggle'),
    S('closeBrackets', 'Auto-close brackets', 'Insert the closing }, ] , ) or $ automatically.', 'toggle'),
    S('autocomplete', 'Suggestions while typing', 'Commands after \\, environments, labels, citations and files. Ctrl+Space always works.', 'toggle'),
    S('tabTriggers', 'Tab expands snippets', 'Type a snippet trigger (e.g. fig) and press Tab.', 'toggle'),
    S('spellcheck', 'Spell check', 'Underline misspelled words (uses the Windows dictionary).', 'toggle'),
  ] },
  { id: 'compile', name: 'Compilation', items: [
    S('engine', 'LaTeX engine', 'Tectonic is downloaded automatically and fetches packages on demand. The others need MiKTeX or TeX Live.', 'select',
      { options: [['tectonic', 'Tectonic (recommended)'], ['latexmk', 'latexmk'], ['pdflatex', 'pdfLaTeX'], ['xelatex', 'XeLaTeX'], ['lualatex', 'LuaLaTeX']] }),
    S('enginePath', 'Engine executable', 'Leave empty to find it automatically.', 'path'),
    S('compileOnSave', 'Compile on save', '', 'toggle'),
    S('liveCompile', 'Live preview', 'Save and recompile automatically after you stop typing.', 'toggle'),
    S('liveDelay', 'Live preview delay', 'How long to wait after the last keystroke.', 'range', { min: 300, max: 5000, step: 100, unit: 'ms' }),
    S('saveAllBeforeCompile', 'Save all files before compiling', 'So included files are up to date in the PDF.', 'toggle'),
  ] },
  { id: 'pdf', name: 'PDF viewer', items: [
    S('pdfZoom', 'Default zoom', '', 'select', { options: [['width', 'Fit width'], ['page', 'Fit page'], ['1', '100%']] }),
    S('pdfInvert', 'Dark pages', 'Invert PDF colors to match dark themes. Does not change the file.', 'toggle'),
    S('syncAfterCompile', 'Follow cursor after compile', 'Scroll the PDF to the line you are editing after each compile.', 'toggle'),
  ] },
  { id: 'files', name: 'Files', items: [
    S('autoSave', 'Auto save', '', 'select', { options: [['off', 'Off'], ['delay', 'After a delay'], ['focus', 'When the window loses focus']] }),
    S('autoSaveDelay', 'Auto save delay', '', 'range', { min: 300, max: 10000, step: 100, unit: 'ms' }),
    S('showHidden', 'Show hidden files', 'Dot-files and build folders in the explorer.', 'toggle'),
    S('restoreSession', 'Restore last session', 'Reopen the last folder and tabs on start.', 'toggle'),
    S('confirmDelete', 'Confirm before deleting', 'Deleted files always go to the Recycle Bin.', 'toggle'),
  ] },
  { id: 'snippets', name: 'Snippets', custom: renderSnippets },
  { id: 'keys', name: 'Shortcuts', custom: renderShortcuts },
  { id: 'about', name: 'About', custom: renderAbout },
]

let engineStatusEl = null

async function updateEngineStatus() {
  if (!engineStatusEl) return
  const path = await invoke('engine_path', { engine: settings.engine, custom: settings.enginePath })
  engineStatusEl.innerHTML = path
    ? `${icon('check')} <span>Using <code>${esc(path)}</code></span>`
    : settings.engine === 'tectonic'
      ? `${icon('info')} <span>Tectonic will be downloaded (~30 MB) the first time you compile.</span>`
      : `${icon('warning')} <span>${esc(settings.engine)} was not found. Install MiKTeX / TeX Live, set the path, or switch to Tectonic.</span>`
  engineStatusEl.className = 'engine-status ' + (path ? 'ok' : settings.engine === 'tectonic' ? 'info' : 'bad')
}

function control(item) {
  const v = settings[item.key]
  const id = 'set-' + item.key
  const set = val => { setSettings({ [item.key]: val }); if (item.key === 'engine' || item.key === 'enginePath') updateEngineStatus() }
  switch (item.type) {
    case 'toggle':
      return h('button.switch', { id, role: 'switch', 'aria-checked': String(!!v), on: { click: e => {
        const now = e.currentTarget.getAttribute('aria-checked') !== 'true'
        e.currentTarget.setAttribute('aria-checked', String(now))
        set(now)
      } } }, h('span.knob'))
    case 'select': {
      const sel = h('select.select', { id, on: { change: e => set(item.number ? +e.target.value : item.key === 'pdfZoom' && e.target.value === '1' ? 1 : e.target.value) } },
        item.options.map(([val, label]) => h('option', { value: String(val), text: label, selected: String(val) === String(v) })))
      return sel
    }
    case 'range': {
      const out = h('output.range-value', { for: id, text: v + item.unit })
      return h('div.range', {}, h('input', { id, type: 'range', min: item.min, max: item.max, step: item.step, value: v, on: { input: e => {
        const n = +e.target.value
        out.textContent = (item.step < 1 ? n.toFixed(1) : n) + item.unit
        set(n)
      } } }), out)
    }
    case 'path': {
      const input = h('input.input', { id, value: v, placeholder: 'Automatic', spellcheck: false, on: { change: e => set(e.target.value.trim()) } })
      return h('div.path-field', {}, input, h('button.btn', { text: 'Browse…', on: { click: async () => {
        const p = await openDialog({ filters: [{ name: 'Programs', extensions: ['exe'] }] })
        if (p) { input.value = p; set(p) }
      } } }))
    }
    case 'accent':
      return h('div.swatches', { role: 'radiogroup', 'aria-label': 'Accent color' },
        ACCENTS.map(c => h('button.swatch', {
          role: 'radio', 'aria-checked': String(v === c), 'aria-label': c || 'Theme default', title: c || 'Theme default',
          class: 'swatch' + (c ? '' : ' default'), style: c ? { '--c': c } : {},
          on: { click: e => { set(c); e.currentTarget.parentElement.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget))) } },
        })),
        h('label.swatch.custom', { title: 'Custom color', html: icon('plus') },
          h('input', { type: 'color', 'aria-label': 'Custom accent color', value: v || '#e85d3a', on: { input: e => set(e.target.value) } })))
    case 'themes':
      return h('div.theme-grid', { role: 'radiogroup', 'aria-label': 'Theme' }, THEMES.map(t => h('button.theme-card', {
        role: 'radio', 'aria-checked': String(v === t.id), 'data-preview': t.id,
        on: { click: e => { set(t.id); e.currentTarget.parentElement.querySelectorAll('.theme-card').forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget))) } },
      }, h('span.theme-sample', { 'data-theme': t.id === 'system' ? undefined : t.id, html: '<i></i><i></i><i></i>' }), h('span', { text: t.name }))))
  }
}

function row(item) {
  const label = h('label.set-label', { for: 'set-' + item.key, text: item.label })
  const wide = item.type === 'themes' || item.type === 'accent'
  return h('div.set-row', { class: 'set-row' + (wide ? ' wide' : ''), 'data-search': (item.label + ' ' + item.desc).toLowerCase() },
    h('div.set-text', {}, label, item.desc ? h('p.set-desc', { text: item.desc }) : null), control(item),
    item.key === 'enginePath' ? (engineStatusEl = h('p.engine-status')) : null)
}

export function openSettings(section = 'appearance') {
  return modal('Settings', close => {
    const nav = h('nav.set-nav', { role: 'tablist', 'aria-orientation': 'vertical', 'aria-label': 'Settings sections' })
    const body = h('div.set-body', { role: 'tabpanel' })
    const search = h('input.input.set-search', { type: 'search', placeholder: 'Search settings', 'aria-label': 'Search settings' })

    const show = id => {
      const sec = SECTIONS.find(x => x.id === id)
      nav.querySelectorAll('[role=tab]').forEach(b => { const on = b.dataset.id === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1 })
      engineStatusEl = null
      body.replaceChildren(h('h3.set-title', { text: sec.name }), ...(sec.custom ? [sec.custom()] : sec.items.map(row)))
      if (id === 'compile') updateEngineStatus()
      body.scrollTop = 0
    }
    for (const sec of SECTIONS) nav.append(h('button.set-tab', { role: 'tab', 'data-id': sec.id, text: sec.name, on: { click: () => { search.value = ''; show(sec.id) } } }))
    nav.addEventListener('keydown', e => {
      const tabs = [...nav.children], i = tabs.indexOf(document.activeElement)
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const next = tabs[(i + (e.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length]
      next.focus(); next.click()
    })
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase()
      if (!q) return show('appearance')
      nav.querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', 'false'))
      engineStatusEl = null
      const rows = SECTIONS.filter(s => s.items).flatMap(s => s.items).filter(it => (it.label + ' ' + it.desc).toLowerCase().includes(q)).map(row)
      body.replaceChildren(h('h3.set-title', { text: `Results for “${search.value.trim()}”` }), ...(rows.length ? rows : [h('p.set-desc', { text: 'No settings match.' })]))
      if (engineStatusEl) updateEngineStatus()
    })
    const reset = h('button.btn.ghost', { text: 'Reset all to defaults', on: { click: async () => {
      if (!(await confirm('Reset settings?', 'All settings return to their defaults. Your custom snippets are kept.', { ok: 'Reset', danger: true }))) return
      const keep = { customSnippets: settings.customSnippets, recent: settings.recent, session: settings.session, mainFiles: settings.mainFiles }
      setSettings({ ...structuredClone(DEFAULTS), ...keep })
      close(null)
      openSettings()
    } } })
    queueMicrotask(() => show(section))
    return h('div.settings', {}, h('div.set-side', {}, search, nav, reset), body,
      h('button.icon-btn.modal-close', { 'aria-label': 'Close settings', html: icon('close'), on: { click: () => close(null) } }))
  }, { wide: true, className: 'settings-modal' })
}

function renderShortcuts() {
  return h('table.keys', {}, h('tbody', {}, SHORTCUTS.map(([k, d]) => h('tr', {}, h('td', { html: k.split(' / ').map(x => `<kbd>${esc(x)}</kbd>`).join(' / ') }), h('td', { text: d })))))
}

function renderAbout() {
  return h('div.about', { html: `
    <div class="about-brand"><svg class="brand-mark" viewBox="300 130 600 760" aria-hidden="true"><g transform="rotate(-8 512 520)"><rect x="318" y="150" width="400" height="720" rx="30" fill="#f3ecdf"/><rect x="378" y="228" width="200" height="44" rx="22" fill="#26221d"/><rect x="378" y="610" width="280" height="30" rx="15" fill="#c7bca9"/><rect x="378" y="690" width="200" height="30" rx="15" fill="#c7bca9"/><path d="M 360 461 C 470 452 580 452 676 448 C 770 444 820 392 786 352 C 752 314 694 348 724 392 C 750 430 812 440 862 424" fill="none" stroke="var(--accent)" stroke-width="56" stroke-linecap="round"/></g></svg><span>Galley</span></div>
    <p>A modern LaTeX editor. Version 1.0.0</p>
    <p class="set-desc">Settings live in <code>%APPDATA%\\Galley\\settings.json</code>. Tectonic, when downloaded, lives in <code>%APPDATA%\\Galley\\bin</code>.</p>
    <p class="set-desc">Built with Tauri, CodeMirror and PDF.js. LaTeX by Tectonic, MiKTeX or TeX Live.</p>` })
}

// ---------- custom snippets ----------

function renderSnippets() {
  const wrap = h('div.snip-manager')
  const draw = () => {
    const list = settings.customSnippets
    wrap.replaceChildren(
      h('p.set-desc', { text: 'Your own snippets appear in the Snippets panel, in completions after \\ and expand with Tab. Use ${name} for a field and ${} for a stop.' }),
      h('button.btn.primary', { html: icon('plus') + ' New snippet', on: { click: () => edit() } }),
      list.length ? h('ul.snip-list', {}, list.map((sn, i) => h('li', {},
        h('div', {}, h('strong', { text: sn.name }), h('code', { text: sn.trigger })),
        h('pre', { text: sn.body }),
        h('div.snip-actions', {},
          h('button.icon-btn', { 'aria-label': `Edit ${sn.name}`, html: icon('edit'), on: { click: () => edit(i) } }),
          h('button.icon-btn', { 'aria-label': `Delete ${sn.name}`, html: icon('trash'), on: { click: () => {
            setSettings({ customSnippets: list.filter((_, j) => j !== i) }); draw()
          } } }))))) : h('p.empty-hint', { text: 'No custom snippets yet.' }))
  }
  const edit = i => {
    const sn = settings.customSnippets[i] || { name: '', trigger: '', body: '' }
    const name = h('input.input', { value: sn.name, placeholder: 'Theorem box', 'aria-label': 'Name' })
    const trigger = h('input.input', { value: sn.trigger, placeholder: 'thmbox', 'aria-label': 'Trigger', spellcheck: false })
    const body = h('textarea.input.mono', { value: sn.body, rows: 8, placeholder: '\\begin{theorem}\n\t${}\n\\end{theorem}', 'aria-label': 'Body', spellcheck: false })
    const err = h('div.field-error', { role: 'alert' })
    body.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || e.shiftKey) return
      e.preventDefault()
      body.setRangeText('\t', body.selectionStart, body.selectionEnd, 'end')
    })
    const form = h('form.snip-form', { on: { submit: e => {
      e.preventDefault()
      const v = { name: name.value.trim(), trigger: trigger.value.trim(), body: body.value }
      if (!v.name || !v.body.trim()) { err.textContent = 'Name and body are required.'; return }
      if (!/^\w+$/.test(v.trigger)) { err.textContent = 'The trigger must be letters, digits or _ only.'; return }
      const next = [...settings.customSnippets]
      if (i === undefined) next.push(v); else next[i] = v
      setSettings({ customSnippets: next })
      draw()
    } } },
      h('label.field-label', { text: 'Name' }), name, h('label.field-label', { text: 'Trigger' }), trigger,
      h('label.field-label', { text: 'Body' }), body, err,
      h('div.modal-actions', {}, h('button.btn', { type: 'button', text: 'Cancel', on: { click: draw } }), h('button.btn.primary', { type: 'submit', text: 'Save snippet' })))
    wrap.replaceChildren(form)
    name.focus()
  }
  draw()
  return wrap
}
