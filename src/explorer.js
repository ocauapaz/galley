// File explorer: tree view of the open folder with keyboard navigation and file operations.
import { invoke } from '@tauri-apps/api/core'
import { h, icon, esc, basename, dirname, joinPath, ext, samePath, showMenu, prompt, confirm, toast } from './ui.js'
import { settings } from './settings.js'

const INVALID_NAME = /[<>:"/\\|?*\x00-\x1f]|^\s|[\s.]$|^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

const state = { root: null, tree: [], expanded: new Set(), selected: null }
let host, cb

const key = p => p.toLowerCase()

function fileIcon(name) {
  const e = ext(name)
  if (e === 'tex' || e === 'sty' || e === 'cls') return 'fileTex'
  if (e === 'bib') return 'fileBib'
  if (e === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'svg', 'eps', 'gif', 'webp'].includes(e)) return 'image'
  return 'file'
}

/** callbacks: onOpen(path), onRenamed(from, to), onDeleted(path), mainFile(), setMainFile(path), openTabs() */
export function initExplorer(el, callbacks) {
  host = el
  cb = callbacks
  host.addEventListener('keydown', onKey)
}

export const explorer = {
  get root() { return state.root },
  get tree() { return state.tree },
}

export async function openFolder(path) {
  state.root = path
  state.expanded = new Set()
  state.selected = null
  await refresh()
}

export function closeFolder() {
  state.root = null
  state.tree = []
  render()
}

export async function refresh() {
  if (!state.root) return render()
  state.tree = await invoke('list_tree', { root: state.root, showHidden: settings.showHidden })
  render()
}

/** All file paths in the tree (flattened). */
export function allFiles() {
  const out = []
  const walk = list => { for (const e of list) e.dir ? walk(e.children) : out.push(e.path) }
  walk(state.tree)
  return out
}

export function reveal(path) {
  if (!state.root) return
  let d = dirname(path)
  while (d.length > state.root.length) { state.expanded.add(key(d)); d = dirname(d) }
  state.selected = path
  render()
  host.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
}

function visibleRows() {
  const rows = []
  const walk = (list, depth) => {
    for (const e of list) {
      rows.push({ e, depth })
      if (e.dir && state.expanded.has(key(e.path))) walk(e.children, depth + 1)
    }
  }
  walk(state.tree, 1)
  return rows
}

export function render() {
  if (!state.root) { host.replaceChildren(); return }
  const main = cb.mainFile()
  const open = new Set(cb.openTabs().map(key))
  const rows = visibleRows()
  if (!state.selected || !rows.some(r => samePath(r.e.path, state.selected))) state.selected = rows[0]?.e.path ?? null
  const list = h('div.tree', { role: 'tree', 'aria-label': 'Files in ' + basename(state.root) })
  for (const { e, depth } of rows) {
    const isOpen = e.dir && state.expanded.has(key(e.path))
    const sel = samePath(e.path, state.selected)
    const isMain = !e.dir && samePath(e.path, main)
    const row = h('div.tree-row', {
      class: 'tree-row' + (sel ? ' selected' : '') + (open.has(key(e.path)) ? ' is-open' : ''),
      role: 'treeitem', 'aria-level': depth, 'aria-selected': String(sel), 'aria-expanded': e.dir ? String(isOpen) : undefined,
      tabindex: sel ? '0' : '-1', title: e.path, style: { '--depth': depth - 1 },
      html: `<span class="twisty">${e.dir ? icon('chevron', isOpen ? 'open' : '') : ''}</span>${icon(e.dir ? (isOpen ? 'folderOpen' : 'folder') : fileIcon(e.name), e.dir ? 'ic-folder' : 'ic-' + (ext(e.name) || 'none'))}<span class="tree-name">${esc(e.name)}</span>${isMain ? '<span class="badge" title="Main file: this is what gets compiled">main</span>' : ''}`,
    })
    row.addEventListener('click', () => activate(e))
    row.addEventListener('contextmenu', ev => { ev.preventDefault(); state.selected = e.path; render(); entryMenu(e, ev.clientX, ev.clientY) })
    list.append(row)
  }
  list.addEventListener('contextmenu', ev => { if (ev.target === list) { ev.preventDefault(); rootMenu(ev.clientX, ev.clientY) } })
  const hadFocus = host.contains(document.activeElement)
  host.replaceChildren(list)
  if (!rows.length) host.append(h('p.empty-hint', { text: 'This folder is empty. Right-click to create a file.' }))
  if (hadFocus) (host.querySelector('[tabindex="0"]') || host).focus()
}

function activate(e) {
  state.selected = e.path
  if (e.dir) {
    const k = key(e.path)
    state.expanded.has(k) ? state.expanded.delete(k) : state.expanded.add(k)
    render()
  } else {
    render()
    cb.onOpen(e.path)
  }
}

function onKey(ev) {
  const rows = visibleRows()
  const i = rows.findIndex(r => samePath(r.e.path, state.selected))
  if (i < 0) return
  const cur = rows[i].e
  const move = j => { state.selected = rows[Math.max(0, Math.min(rows.length - 1, j))].e.path; render(); host.querySelector('[tabindex="0"]')?.scrollIntoView({ block: 'nearest' }) }
  switch (ev.key) {
    case 'ArrowDown': move(i + 1); break
    case 'ArrowUp': move(i - 1); break
    case 'Home': move(0); break
    case 'End': move(rows.length - 1); break
    case 'ArrowRight':
      if (cur.dir && !state.expanded.has(key(cur.path))) { state.expanded.add(key(cur.path)); render() } else move(i + 1)
      break
    case 'ArrowLeft':
      if (cur.dir && state.expanded.has(key(cur.path))) { state.expanded.delete(key(cur.path)); render() }
      else { const p = rows.findLastIndex((r, j) => j < i && r.depth < rows[i].depth); if (p >= 0) move(p) }
      break
    case 'Enter': case ' ': activate(cur); break
    case 'F2': renameEntry(cur); break
    case 'Delete': deleteEntry(cur); break
    case 'ContextMenu': { const r = host.querySelector('[tabindex="0"]').getBoundingClientRect(); entryMenu(cur, r.left + 24, r.bottom) } break
    default: return
  }
  ev.preventDefault()
}

export function collapseAll() {
  state.expanded.clear()
  render()
}

function targetDir() {
  const sel = state.selected && allEntries().find(e => samePath(e.path, state.selected))
  if (!sel) return state.root
  return sel.dir ? sel.path : dirname(sel.path)
}

function allEntries() {
  const out = []
  const walk = list => { for (const e of list) { out.push(e); if (e.dir) walk(e.children) } }
  walk(state.tree)
  return out
}

const validName = v => INVALID_NAME.test(v) ? 'That name contains characters Windows does not allow.' : null

export async function newFile(dir = targetDir()) {
  if (!dir) return
  const name = await prompt('New file', { label: `In ${basename(dir)}`, value: 'untitled.tex', ok: 'Create', validate: validName })
  if (!name) return
  const path = joinPath(dir, name)
  try {
    await invoke('create_file', { path, text: '' })
    state.expanded.add(key(dir))
    await refresh()
    reveal(path)
    cb.onOpen(path)
  } catch (e) { toast(String(e), 'error') }
}

export async function newFolder(dir = targetDir()) {
  if (!dir) return
  const name = await prompt('New folder', { label: `In ${basename(dir)}`, placeholder: 'figures', ok: 'Create', validate: validName })
  if (!name) return
  const path = joinPath(dir, name)
  try {
    await invoke('create_dir', { path })
    state.expanded.add(key(dir))
    await refresh()
    reveal(path)
  } catch (e) { toast(String(e), 'error') }
}

async function renameEntry(e) {
  const name = await prompt('Rename', { value: e.name, ok: 'Rename', validate: validName })
  if (!name || name === e.name) return
  const to = joinPath(dirname(e.path), name)
  try {
    await invoke('rename_path', { from: e.path, to })
    cb.onRenamed(e.path, to)
    await refresh()
    reveal(to)
  } catch (err) { toast(String(err), 'error') }
}

async function deleteEntry(e) {
  if (settings.confirmDelete) {
    const ok = await confirm('Move to Recycle Bin?', `"${e.name}"${e.dir ? ' and everything inside it' : ''} will be moved to the Recycle Bin.`, { ok: 'Delete', danger: true })
    if (!ok) return
  }
  try {
    await invoke('trash_path', { path: e.path })
    cb.onDeleted(e.path)
    await refresh()
    toast(`Moved "${e.name}" to the Recycle Bin`)
  } catch (err) { toast(String(err), 'error') }
}

function entryMenu(e, x, y) {
  const dir = e.dir ? e.path : dirname(e.path)
  showMenu(x, y, [
    !e.dir && { label: 'Open', icon: 'file', action: () => cb.onOpen(e.path) },
    !e.dir && /\.tex$/i.test(e.name) && { label: 'Set as main file', icon: 'star', action: () => { cb.setMainFile(e.path); render() } },
    e.dir || !/\.tex$/i.test(e.name) ? null : '-',
    { label: 'New file…', icon: 'newFile', action: () => newFile(dir) },
    { label: 'New folder…', icon: 'newFolder', action: () => newFolder(dir) },
    '-',
    { label: 'Rename…', icon: 'edit', kbd: 'F2', action: () => renameEntry(e) },
    { label: 'Delete', icon: 'trash', kbd: 'Del', danger: true, action: () => deleteEntry(e) },
    '-',
    { label: 'Copy path', icon: 'copy', action: () => navigator.clipboard.writeText(e.path) },
    { label: 'Copy relative path', action: () => navigator.clipboard.writeText(e.path.slice(state.root.length + 1).replace(/\\/g, '/')) },
    { label: 'Reveal in File Explorer', icon: 'external', action: () => invoke('reveal', { path: e.path }) },
  ].filter(Boolean), { label: e.name })
}

function rootMenu(x, y) {
  showMenu(x, y, [
    { label: 'New file…', icon: 'newFile', action: () => newFile(state.root) },
    { label: 'New folder…', icon: 'newFolder', action: () => newFolder(state.root) },
    '-',
    { label: 'Refresh', icon: 'refresh', action: refresh },
    { label: 'Open in File Explorer', icon: 'external', action: () => invoke('open_path', { path: state.root }) },
  ])
}
