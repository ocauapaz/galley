// Live PDF viewer: lazy canvas rendering, flicker-free reloads, zoom, SyncTeX jumps.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { invoke } from '@tauri-apps/api/core'
import { h } from './ui.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
// One worker for the whole session: every live reload would otherwise spin up a new one.
let worker = null
// pdf.js 6 documents are released through their loading task (which leaves a shared worker alone).
const release = doc => doc?.loadingTask.destroy()

const PAD = 24
const GAP = 16
const MIN_SCALE = 0.25
const MAX_SCALE = 5

const s = {
  doc: null, path: null, pages: [], scale: 1, zoom: 'width', token: 0,
  scroller: null, pagesEl: null, observer: null, visible: new Set(), onChange: null, onInverse: null,
}

/** els: { scroller, empty }. cb: { onChange(info), onInverse(page, x, y) } */
export function initPdf(scroller, cb) {
  s.scroller = scroller
  s.onChange = cb.onChange
  s.onInverse = cb.onInverse
  s.pagesEl = h('div.pdf-pages')
  scroller.append(s.pagesEl)
  s.observer = new IntersectionObserver(entries => {
    for (const e of entries) {
      const p = e.target._page
      if (e.isIntersecting) { s.visible.add(p); renderPage(p) } else { s.visible.delete(p); freePage(p) }
    }
  }, { root: scroller, rootMargin: '150% 0px' })
  scroller.addEventListener('scroll', notify, { passive: true })
  scroller.addEventListener('wheel', e => {
    if (!e.ctrlKey || !s.doc) return
    e.preventDefault()
    zoomAt(s.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY)
  }, { passive: false })
  let t
  new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (typeof s.zoom === 'string') relayout() }, 60) }).observe(scroller)
}

export const pdfState = () => ({ path: s.path, page: currentPage(), pages: s.pages.length, scale: s.scale, zoom: s.zoom })

function notify() {
  s.onChange?.(pdfState())
}

function fitScale(zoom) {
  if (typeof zoom === 'number') return zoom
  if (!s.pages.length) return 1
  const maxW = Math.max(...s.pages.map(p => p.w))
  const width = (s.scroller.clientWidth - PAD * 2) / maxW
  if (zoom === 'width') return width
  const maxH = Math.max(...s.pages.map(p => p.h))
  return Math.min(width, (s.scroller.clientHeight - PAD * 2) / maxH)
}

/**
 * Loads (or reloads) a PDF from disk, keeping the reader's position when it is the same file.
 * Resolves false when a newer load superseded this one.
 */
export async function loadPdf(path) {
  const token = ++s.token
  const bytes = new Uint8Array(await invoke('read_bytes', { path }))
  worker ??= new pdfjs.PDFWorker()
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, worker }).promise
  if (token !== s.token) { release(doc); return false }

  const sameFile = s.path && s.path.toLowerCase() === path.toLowerCase()
  const anchor = sameFile ? scrollAnchor() : null
  const pages = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    pages.push({ n, page, w: vp.width, h: vp.height, el: null, canvas: null, rendered: 0, task: null })
  }
  if (token !== s.token) { release(doc); return false }

  const old = s.pages
  const oldDoc = s.doc
  s.doc = doc
  s.path = path
  s.pages = pages
  s.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale(s.zoom)))

  // Build the new page frames, carrying old canvases over as placeholders so the swap doesn't flash.
  s.observer.disconnect()
  s.visible.clear()
  const frag = document.createDocumentFragment()
  for (const p of pages) {
    p.el = h('div.pdf-page', { 'data-page': p.n, 'aria-label': `Page ${p.n}`, role: 'img' })
    p.el._page = p
    p.el.addEventListener('dblclick', e => inverseAt(p, e))
    const prev = old[p.n - 1]
    if (sameFile && prev?.canvas && Math.abs(prev.w - p.w) < 0.5 && Math.abs(prev.h - p.h) < 0.5) {
      prev.task?.cancel()
      p.el.append(prev.canvas)
      p.canvas = prev.canvas
    }
    frag.append(p.el)
  }
  sizePages()
  s.pagesEl.replaceChildren(frag)
  if (anchor) restoreAnchor(anchor)
  else s.scroller.scrollTop = 0
  for (const p of pages) s.observer.observe(p.el)
  for (const q of old) {
    q.task?.cancel()
    if (q.canvas && !pages.some(p => p.canvas === q.canvas)) q.canvas.width = q.canvas.height = 0
  }
  s.scroller.closest('.pdf-pane')?.classList.add('has-pdf')
  release(oldDoc)
  notify()
  return true
}

export function clearPdf() {
  s.token++
  s.observer?.disconnect()
  release(s.doc)
  s.doc = null
  s.path = null
  s.pages = []
  s.pagesEl.replaceChildren()
  s.scroller.closest('.pdf-pane')?.classList.remove('has-pdf')
  notify()
}

function sizePages() {
  for (const p of s.pages) {
    p.el.style.width = Math.floor(p.w * s.scale) + 'px'
    p.el.style.height = Math.floor(p.h * s.scale) + 'px'
  }
}

function scrollAnchor() {
  const p = s.pages[currentPage() - 1]
  if (!p) return null
  const within = (s.scroller.scrollTop - p.el.offsetTop) / p.el.offsetHeight
  return { n: p.n, within, left: s.scroller.scrollLeft / Math.max(1, s.scroller.scrollWidth) }
}

function restoreAnchor(a) {
  const p = s.pages[Math.min(a.n, s.pages.length) - 1]
  if (!p) return
  s.scroller.scrollTop = p.el.offsetTop + a.within * p.el.offsetHeight
  s.scroller.scrollLeft = a.left * s.scroller.scrollWidth
}

function currentPage() {
  if (!s.pages.length) return 0
  const mid = s.scroller.scrollTop + s.scroller.clientHeight / 3
  let lo = 0, hi = s.pages.length - 1
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1
    if (s.pages[m].el.offsetTop <= mid) lo = m; else hi = m - 1
  }
  return lo + 1
}

async function renderPage(p) {
  if (!s.doc || p.rendered === s.scale) return
  p.task?.cancel()
  const dpr = window.devicePixelRatio || 1
  const vp = p.page.getViewport({ scale: s.scale * dpr })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(vp.width)
  canvas.height = Math.floor(vp.height)
  const scale = s.scale
  const task = p.page.render({ canvas, viewport: vp })
  p.task = task
  try {
    await task.promise
  } catch (e) {
    if (e?.name !== 'RenderingCancelledException') console.error('pdf: render failed', e)
    return
  }
  if (p.task !== task || !s.pages.includes(p)) return
  p.task = null
  if (p.canvas && p.canvas !== canvas) p.canvas.remove()
  p.canvas = canvas
  p.rendered = scale
  p.el.prepend(canvas)
}

// Far-away pages give their canvas memory back; a 100-page document would otherwise hold gigabytes.
function freePage(p) {
  p.task?.cancel()
  p.task = null
  if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove(); p.canvas = null }
  p.rendered = 0
}

function relayout(anchorOverride) {
  if (!s.doc) return
  const a = anchorOverride || scrollAnchor()
  s.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale(s.zoom)))
  sizePages()
  if (a) restoreAnchor(a)
  for (const p of s.visible) renderPage(p)
  notify()
}

export function setZoom(zoom) {
  s.zoom = typeof zoom === 'number' ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, zoom)) : zoom
  relayout()
}

export const zoomBy = f => setZoom(s.scale * f)

function zoomAt(scale, cx, cy) {
  const r = s.scroller.getBoundingClientRect()
  const x = s.scroller.scrollLeft + cx - r.left
  const y = s.scroller.scrollTop + cy - r.top
  const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) / s.scale
  s.zoom = s.scale * k
  s.scale = s.zoom
  sizePages()
  s.scroller.scrollLeft = x * k - (cx - r.left)
  s.scroller.scrollTop = y * k - (cy - r.top)
  for (const p of s.visible) renderPage(p)
  notify()
}

export function goToPage(n) {
  const p = s.pages[Math.max(1, Math.min(n, s.pages.length)) - 1]
  if (p) s.scroller.scrollTop = p.el.offsetTop - GAP
}

function inverseAt(p, e) {
  const r = p.el.getBoundingClientRect()
  s.onInverse?.(p.n, (e.clientX - r.left) / s.scale, (e.clientY - r.top) / s.scale)
}

/** Scrolls to a SyncTeX box { page, x, y, w, h } (PDF points) and flashes it. */
export function showBox(box) {
  const p = s.pages[box.page - 1]
  if (!p) return
  const top = p.el.offsetTop + box.y * s.scale
  s.scroller.scrollTo({ top: top - s.scroller.clientHeight / 3, behavior: document.documentElement.dataset.motion === 'reduced' ? 'auto' : 'smooth' })
  const mark = h('div.sync-mark', { style: {
    top: box.y * s.scale - 3 + 'px', height: box.h * s.scale + 6 + 'px',
    left: (box.x ?? 0) * s.scale - 4 + 'px', width: box.w ? Math.max(box.w * s.scale + 8, 48) + 'px' : '100%',
  } })
  p.el.append(mark)
  setTimeout(() => mark.remove(), 1600)
}
