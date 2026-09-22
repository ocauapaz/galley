// Command palette (Ctrl+Shift+P) and quick file open (Ctrl+P).
import { h, icon, esc } from './ui.js'

/** Subsequence match; returns a score (higher is better) and the matched indexes, or null. */
export function fuzzy(query, text) {
  if (!query) return { score: 0, hits: [] }
  const q = query.toLowerCase(), t = text.toLowerCase()
  let ti = 0, score = 0, prev = -2
  const hits = []
  for (const ch of q) {
    const i = t.indexOf(ch, ti)
    if (i < 0) return null
    score += i === prev + 1 ? 5 : 1
    if (i === 0 || /[\s\\/._-]/.test(t[i - 1])) score += 3
    hits.push(i)
    prev = i
    ti = i + 1
  }
  return { score: score - t.length * 0.01, hits }
}

function highlight(text, hits) {
  const set = new Set(hits)
  return [...text].map((c, i) => set.has(i) ? `<mark>${esc(c)}</mark>` : esc(c)).join('')
}

let current = null

/**
 * items: [{ label, detail?, kbd?, icon?, run }]. Typing '>' in file mode switches to commands via getCommands.
 */
export function openPalette({ placeholder, initial = '', items, getCommands, getFiles }) {
  current?.close()
  const restore = document.activeElement
  const input = h('input.palette-input', { placeholder, role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list', spellcheck: false })
  const list = h('div.palette-list#palette-list', { role: 'listbox', 'aria-label': 'Results' })
  const box = h('div.palette', { role: 'dialog', 'aria-modal': 'true', 'aria-label': placeholder }, h('div.palette-field', { html: icon('search') }, input), list)
  const backdrop = h('div.palette-backdrop', {}, box)
  let shown = [], sel = 0

  const source = () => {
    if (getCommands && input.value.startsWith('>')) return { list: getCommands(), q: input.value.slice(1).trim() }
    return { list: items ?? getFiles(), q: input.value.trim() }
  }

  const update = () => {
    const { list: all, q } = source()
    shown = all.map(it => ({ it, m: fuzzy(q, it.label) })).filter(x => x.m).sort((a, b) => b.m.score - a.m.score).slice(0, 80)
    sel = Math.min(sel, Math.max(0, shown.length - 1))
    list.replaceChildren(...shown.map(({ it, m }, i) => h('div.palette-item', {
      id: 'pi' + i, role: 'option', 'aria-selected': String(i === sel), class: 'palette-item' + (i === sel ? ' selected' : ''),
      html: `${icon(it.icon || 'command')}<span class="pi-label">${highlight(it.label, m.hits)}</span><span class="pi-detail">${esc(it.detail || '')}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}`,
      on: { mousedown: e => { e.preventDefault(); run(i) }, mousemove: () => { if (sel !== i) { sel = i; mark() } } },
    })))
    if (!shown.length) list.append(h('div.palette-empty', { text: 'No matches' }))
    input.setAttribute('aria-activedescendant', shown.length ? 'pi' + sel : '')
  }
  const mark = () => {
    list.querySelectorAll('.palette-item').forEach((el, i) => { el.classList.toggle('selected', i === sel); el.setAttribute('aria-selected', String(i === sel)) })
    list.children[sel]?.scrollIntoView({ block: 'nearest' })
    input.setAttribute('aria-activedescendant', 'pi' + sel)
  }
  const close = (refocus = true) => {
    backdrop.remove()
    current = null
    if (refocus) restore?.focus?.()
  }
  const run = i => {
    const x = shown[i]
    if (!x) return
    close(false)
    x.it.run()
  }

  input.addEventListener('input', () => { sel = 0; update() })
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark() }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  })
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close() })
  document.body.append(backdrop)
  current = { close }
  input.value = initial
  update()
  input.focus()
}
