// Small DOM helpers: element builder, icons, toasts, menus and modal dialogs.

const PATHS = {
  files: 'M4 4h6l2 2h8v12a2 2 0 0 1-2 2H4z',
  outline: 'M4 6h16M8 12h12M12 18h8M4 12h.01M4 18h.01M8 18h.01',
  snippets: 'M8 6 3 12l5 6M16 6l5 6-5 6M14 4l-4 16',
  symbols: 'M18 5H7l6 7-6 7h11',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M6 6h12v12H6z',
  pdf: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h4',
  panel: 'M3 4h18v16H3zM3 15h18',
  sidebar: 'M3 4h18v16H3zM9 4v16',
  folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  folderOpen: 'M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v1H7l-3 9H4a1 1 0 0 1-1-1zM7 10h15l-3 9H4z',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5',
  fileTex: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8.5 12h5M11 12v6',
  fileBib: 'M5 4a1 1 0 0 1 1-1h13v16H6a1 1 0 0 0-1 1zM5 20a1 1 0 0 0 1 1h13M9 7h6',
  image: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  newFile: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M12 12v6M9 15h6',
  newFolder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM12 10v6M9 13h6',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4',
  collapse: 'M7 9l5-5 5 5M7 15l5 5 5-5',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  maximize: 'M5 5h14v14H5z',
  restore: 'M8 8h11v11H8zM5 16V5h11',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  zoomIn: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M11 8v6M8 11h6',
  zoomOut: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6',
  fitWidth: 'M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3',
  fitPage: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3',
  contrast: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18',
  sync: 'M4 12h13M13 7l5 5-5 5M20 4v16',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  error: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01',
  warning: 'M12 4 2.5 20h19zM12 10v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  star: 'M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
}

export function icon(name, cls = '') {
  const d = PATHS[name] || PATHS.file
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** h('button.cls#id', { attrs, on: {click} }, children...) */
export function h(tag, props = {}, ...children) {
  const [, name, rest] = /^([a-z0-9-]+)(.*)$/i.exec(tag)
  const el = document.createElement(name)
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1))
    else el.id = part.slice(1)
  }
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn)
    else if (k === 'html') el.innerHTML = v
    else if (k === 'text') el.textContent = v
    else if (k === 'value') el.value = v
    else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val)
    else if (k in el && typeof v !== 'string') el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c)
  return el
}

// ---------- toasts ----------

export function toast(message, kind = 'info', ms = 3500) {
  const host = document.getElementById('toasts')
  const el = h('div.toast', { class: `toast toast-${kind}`, html: icon(kind === 'error' ? 'error' : kind === 'success' ? 'check' : 'info') + `<span>${esc(message)}</span>` })
  host.append(el)
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 250) }, ms)
  return el
}

// ---------- context menu ----------

let openMenu = null

export function closeMenu() {
  if (!openMenu) return
  const { el, restore, anchor } = openMenu
  openMenu = null
  el.remove()
  anchor?.setAttribute('aria-expanded', 'false')
  restore?.focus?.()
}

let listening = false

/** items: [{ label, icon?, kbd?, action, danger?, disabled? } | '-']; opts: { label, anchor } */
export function showMenu(x, y, items, opts = {}) {
  closeMenu()
  if (!listening) {
    listening = true
    addEventListener('mousedown', e => { if (openMenu && !openMenu.el.contains(e.target)) closeMenu() }, true)
    addEventListener('blur', () => closeMenu())
  }
  const restore = document.activeElement
  const el = h('div.menu', { role: 'menu', 'aria-label': opts.label || 'Menu' })
  const buttons = []
  for (const it of items) {
    if (it === '-') { el.append(h('div.menu-sep', { role: 'separator' })); continue }
    const b = h('button.menu-item', {
      role: 'menuitem', disabled: it.disabled, class: 'menu-item' + (it.danger ? ' danger' : ''),
      html: `${it.icon ? icon(it.icon) : '<span class="icon"></span>'}<span class="menu-label">${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}`,
      on: { click: () => { closeMenu(); it.action() } },
    })
    buttons.push(b)
    el.append(b)
  }
  el.addEventListener('keydown', e => {
    const i = buttons.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length].focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus() }
    else if (e.key === 'Home') { e.preventDefault(); buttons[0].focus() }
    else if (e.key === 'End') { e.preventDefault(); buttons.at(-1).focus() }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu() }
  })
  document.body.append(el)
  const r = el.getBoundingClientRect()
  el.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'
  el.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px'
  openMenu = { el, restore, anchor: opts.anchor }
  opts.anchor?.setAttribute('aria-expanded', 'true')
  buttons.find(b => !b.disabled)?.focus()
}


// ---------- modal dialogs ----------

/** Shows a modal; `build(close)` returns the body. Resolves with the value passed to close(). */
export function modal(title, build, { wide = false, className = '' } = {}) {
  return new Promise(resolve => {
    const restore = document.activeElement
    const backdrop = h('div.modal-backdrop')
    const titleId = 'm' + Math.random().toString(36).slice(2)
    const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, class: `modal ${wide ? 'wide' : ''} ${className}` })
    const close = value => {
      backdrop.classList.add('leaving')
      setTimeout(() => backdrop.remove(), 160)
      restore?.focus?.()
      resolve(value)
    }
    box.append(h('h2.modal-title', { id: titleId, text: title }), build(close))
    backdrop.append(box)
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(null) })
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null) }
      if (e.key === 'Tab') trapFocus(box, e)
    })
    document.body.append(backdrop)
    ;(box.querySelector('[autofocus]') || box.querySelector('input, select, textarea, button'))?.focus()
  })
}

export function trapFocus(container, e) {
  const f = [...container.querySelectorAll('button, input, select, textarea, [tabindex="0"], a[href]')].filter(x => !x.disabled && x.offsetParent !== null)
  if (!f.length) return
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus() }
  else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus() }
}

export function prompt(title, { value = '', label = '', placeholder = '', ok = 'OK', validate } = {}) {
  return modal(title, close => {
    const input = h('input.input', { value, placeholder, 'aria-label': label || title, autofocus: true, spellcheck: false })
    const err = h('div.field-error', { role: 'alert' })
    const submit = () => {
      const v = input.value.trim()
      const problem = validate?.(v)
      if (problem) { err.textContent = problem; input.setAttribute('aria-invalid', 'true'); return }
      if (v) close(v)
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
    setTimeout(() => {
      const dot = value.lastIndexOf('.')
      input.setSelectionRange(0, dot > 0 ? dot : value.length)
    })
    return h('div', {},
      label ? h('label.field-label', { text: label }) : null, input, err,
      h('div.modal-actions', {}, h('button.btn', { text: 'Cancel', on: { click: () => close(null) } }), h('button.btn.primary', { text: ok, on: { click: submit } })))
  })
}

export function confirm(title, message, { ok = 'OK', danger = false, extra } = {}) {
  return modal(title, close => h('div', {},
    h('p.modal-text', { text: message }),
    h('div.modal-actions', {},
      extra ? h('button.btn', { text: extra, on: { click: () => close('extra') } }) : null,
      h('button.btn', { text: 'Cancel', on: { click: () => close(false) } }),
      h('button.btn.primary', { class: 'btn primary' + (danger ? ' danger' : ''), text: ok, autofocus: true, on: { click: () => close(true) } }))))
}

// ---------- misc ----------

export function debounce(fn, ms) {
  let t
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), typeof ms === 'function' ? ms() : ms) }
  d.cancel = () => clearTimeout(t)
  return d
}

export const basename = p => p.split(/[\\/]/).pop()
export const dirname = p => p.replace(/[\\/][^\\/]*$/, '')
export const joinPath = (a, b) => a.replace(/[\\/]+$/, '') + '\\' + b
export const ext = p => (/\.([^.\\/]+)$/.exec(p)?.[1] || '').toLowerCase()
export const samePath = (a, b) => !!a && !!b && a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase()

/** Makes a drag handle resize something; onMove(delta from start) returns nothing. */
export function dragHandle(handle, { axis = 'x', onStart, onMove, onEnd }) {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    e.preventDefault()
    handle.setPointerCapture(e.pointerId)
    const start = axis === 'x' ? e.clientX : e.clientY
    const ctx = onStart?.()
    document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y')
    const move = ev => onMove((axis === 'x' ? ev.clientX : ev.clientY) - start, ctx)
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing-x', 'resizing-y')
      onEnd?.()
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
  })
}
