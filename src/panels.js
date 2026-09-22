// Side panels (outline, snippets, symbols), the welcome screen and the problems panel.
import { h, icon, esc, basename } from './ui.js'
import { SNIPPETS, SYMBOLS, symbolBody } from './snippets.js'
import { settings } from './settings.js'

// ---------- outline ----------

const OUTLINE_MARK = { part: 'Pt', chapter: 'Ch', section: '§', subsection: '§', subsubsection: '§', frametitle: '▭', frame: '▭' }

export function renderOutline(el, items, currentLine, onGo) {
  if (!items) { el.replaceChildren(h('p.empty-hint', { text: 'Open a .tex file to see its sections.' })); return }
  if (!items.length) { el.replaceChildren(h('p.empty-hint', { text: 'No \\section, \\chapter or frame titles in this file yet.' })); return }
  const minLevel = Math.min(...items.map(i => i.level))
  let current = -1
  items.forEach((it, i) => { if (it.line <= currentLine) current = i })
  el.replaceChildren(h('ul.outline', { role: 'list' }, items.map((it, i) => h('li', {},
    h('button.outline-item', {
      class: 'outline-item' + (i === current ? ' current' : ''), style: { '--lvl': it.level - minLevel },
      'aria-current': i === current ? 'location' : undefined,
      html: `<span class="ol-kind" aria-label="${it.kind}">${OUTLINE_MARK[it.kind]}</span><span class="ol-title">${esc(it.title)}</span><span class="ol-line">${it.line}</span>`,
      on: { click: () => onGo(it.line) },
    })))))
  el.querySelector('.current')?.scrollIntoView({ block: 'nearest' })
}

// ---------- snippets ----------

export function allSnippets() {
  return [...settings.customSnippets, ...SNIPPETS.flatMap(c => c.items)]
}

export function renderSnippets(el, filter, onInsert, onManage) {
  const q = filter.trim().toLowerCase()
  const match = s => !q || s.name.toLowerCase().includes(q) || s.trigger.toLowerCase().includes(q)
  const groups = [{ category: 'My snippets', items: settings.customSnippets, custom: true }, ...SNIPPETS]
  const nodes = []
  for (const g of groups) {
    const items = g.items.filter(match)
    if (!items.length && !(g.custom && !q)) continue
    const details = h('details.snip-group', { open: true },
      h('summary', { html: `${icon('chevron')}<span>${esc(g.category)}</span><span class="count">${items.length}</span>` }),
      items.length ? h('div.snip-items', {}, items.map(s => h('button.snip', {
        title: s.body, 'aria-label': `Insert ${s.name}, trigger ${s.trigger}`,
        html: `<span class="snip-name">${esc(s.name)}</span><kbd>${esc(s.trigger)}</kbd>`,
        on: { click: () => onInsert(s.body) },
      }))) : h('button.link-btn', { text: 'Create your own snippet…', on: { click: onManage } }))
    nodes.push(details)
  }
  el.replaceChildren(...(nodes.length ? nodes : [h('p.empty-hint', { text: 'No snippets match.' })]))
}

// ---------- symbols ----------

export function renderSymbols(el, filter, onInsert) {
  const q = filter.trim().toLowerCase()
  const nodes = []
  for (const g of SYMBOLS) {
    const items = g.items.filter(([, cmd]) => !q || cmd.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
    if (!items.length) continue
    nodes.push(h('details.snip-group', { open: true },
      h('summary', { html: `${icon('chevron')}<span>${esc(g.category)}</span><span class="count">${items.length}</span>` }),
      h('div.sym-grid', {}, items.map(([glyph, cmd]) => {
        const label = '\\' + cmd.replace(/\$\{\}|\{\}/g, '').replace(/\s.*$/, '')
        return h('button.sym', { title: label, 'aria-label': label, text: glyph, on: { click: () => onInsert(symbolBody(cmd)) } })
      }))))
  }
  el.replaceChildren(...(nodes.length ? nodes : [h('p.empty-hint', { text: 'No symbols match.' })]))
}

// ---------- welcome ----------

export function renderWelcome(el, { recent, hasFolder, actions }) {
  const recentList = recent.length ? h('ul.recent', {}, recent.slice(0, 6).map(p => h('li', {}, h('button.recent-item', {
    title: p, html: `${icon('folder')}<span class="r-name">${esc(basename(p))}</span><span class="r-path">${esc(p)}</span>`,
    on: { click: () => actions.openFolder(p) },
  })))) : null
  el.replaceChildren(h('div.welcome-inner', {},
    h('p.eyebrow', { text: hasFolder ? 'No file open' : 'Welcome to Galley' }),
    h('h1.welcome-title', { html: 'Typeset something <em>beautiful</em>.' }),
    h('div.welcome-actions', {},
      h('button.big-action', { html: `${icon('newFile')}<span><strong>New project</strong><small>Start from a template</small></span>`, on: { click: actions.newProject } }),
      h('button.big-action', { html: `${icon('folderOpen')}<span><strong>Open folder</strong><small>Ctrl+O</small></span>`, on: { click: () => actions.openFolder() } }),
      h('button.big-action', { html: `${icon('command')}<span><strong>Command palette</strong><small>Ctrl+Shift+P</small></span>`, on: { click: actions.palette } })),
    recentList ? h('div.recent-block', {}, h('h2.eyebrow', { text: 'Recent' }), recentList) : null,
    h('dl.welcome-keys', { html: [['Ctrl+Enter', 'compile'], ['Ctrl+P', 'find a file'], ['Tab', 'expand a snippet trigger'], ['Double-click PDF', 'jump to source']]
      .map(([k, d]) => `<div><dt><kbd>${k}</kbd></dt><dd>${d}</dd></div>`).join('') })))
}

// ---------- problems ----------

export function renderProblems(el, problems, root, onGo) {
  if (!problems.length) { el.replaceChildren(h('p.empty-hint', { text: 'No problems. Compile with Ctrl+Enter.' })); return }
  el.replaceChildren(h('ul.problems', { role: 'list' }, problems.map(p => {
    const where = p.file ? (root && p.file.toLowerCase().startsWith(root.toLowerCase()) ? p.file.slice(root.length + 1) : basename(p.file)) + (p.line ? ':' + p.line : '') : ''
    return h('li', {}, h('button.problem', {
      class: 'problem sev-' + p.severity, disabled: !p.file || !p.line,
      html: `${icon(p.severity === 'error' ? 'error' : p.severity === 'warning' ? 'warning' : 'info')}<span class="p-msg">${esc(p.message)}</span><span class="p-where">${esc(where)}</span>`,
      on: { click: () => onGo(p) },
    }))
  })))
}
