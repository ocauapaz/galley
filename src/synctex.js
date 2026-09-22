// Minimal SyncTeX reader: enough for PDF <-> source jumps.
// Coordinates are returned in PDF points (bp) from the top-left of the page.

const SP_PER_BP = 65781.76
const RECORD = /^([[(vhxkg$])(\d+),(\d+):(-?\d+),(-?\d+)(?::(-?\d+),(-?\d+),(-?\d+))?/

/** Parses an uncompressed .synctex text into { inputs: Map<tag, path>, records: [] }. */
export function parseSynctex(text) {
  const inputs = new Map()
  const records = []
  let unit = 1, mag = 1000, xoff = 0, yoff = 0, page = 0
  for (const line of text.split('\n')) {
    const c = line[0]
    if (c === 'I' && line.startsWith('Input:')) {
      const rest = line.slice(6)
      const k = rest.indexOf(':')
      inputs.set(+rest.slice(0, k), rest.slice(k + 1).trim())
    } else if (c === '{') {
      page = +line.slice(1)
    } else if (RECORD.test(line)) {
      const m = RECORD.exec(line)
      const s = unit * (mag / 1000) / SP_PER_BP
      records.push({
        type: m[1], tag: +m[2], line: +m[3], page,
        x: (+m[4] * unit + xoff) * (mag / 1000) / SP_PER_BP,
        y: (+m[5] * unit + yoff) * (mag / 1000) / SP_PER_BP,
        w: m[6] ? +m[6] * s : 0, h: m[7] ? +m[7] * s : 0, d: m[8] ? +m[8] * s : 0,
      })
    } else if (line.startsWith('Unit:')) unit = +line.slice(5)
    else if (line.startsWith('Magnification:')) mag = +line.slice(14) || 1000
    else if (line.startsWith('X Offset:')) xoff = +line.slice(9)
    else if (line.startsWith('Y Offset:')) yoff = +line.slice(9)
  }
  return { inputs, records }
}

const norm = p => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/\.\//g, '/').toLowerCase()

function samePath(input, file, baseDir) {
  const a = norm(input), f = norm(file)
  if (a === f) return true
  const abs = /^[a-z]:\//.test(a) ? a : norm(baseDir + '/' + a)
  return abs === f
}

// Leaf nodes: glue, kern, math, current position and void boxes. Their line numbers are the precise ones.
const LEAF = new Set(['g', 'k', '$', 'x', 'h', 'v'])
const TEXT_HEIGHT = 8
const TEXT_DEPTH = 2

function toFile(sync, tag, baseDir) {
  const input = sync.inputs.get(tag) || ''
  const file = /^([a-zA-Z]:|\/)/.test(input) ? input : baseDir.replace(/[\\/]$/, '') + '/' + input.replace(/^\.\//, '')
  return file.replace(/\//g, '\\')
}

/** PDF point (page, x, y) -> { file, line }: the text line (innermost hbox) under the point, then its nearest leaf. */
export function inverseSearch(sync, page, x, y, baseDir) {
  const onPage = sync.records.filter(r => r.page === page && r.line > 0)
  let box = null
  for (const r of onPage) {
    if (r.type !== '(' || r.w <= 0 || x < r.x || x > r.x + r.w || y < r.y - r.h - 1 || y > r.y + r.d + 1) continue
    if (!box || r.w * (r.h + r.d) <= box.w * (box.h + box.d)) box = r
  }
  let best = null, bestScore = Infinity
  for (const r of onPage) {
    if (!LEAF.has(r.type)) continue
    if (box && (Math.abs(r.y - box.y) > 0.5 || r.x < box.x - 0.5 || r.x > box.x + box.w + 0.5)) continue
    // Prefer the node just left of the click: that is where the clicked word's source begins.
    const dx = r.x <= x ? x - r.x : (r.x - x) * 2
    const score = box ? dx : Math.abs(y - r.y) * 4 + dx
    if (score < bestScore) { bestScore = score; best = r }
  }
  best = best || box
  return best ? { file: toFile(sync, best.tag, baseDir), line: best.line } : null
}

/** Source (file, line) -> { page, x, y, w, h } around that line's output (or the nearest later line with output). */
export function forwardSearch(sync, file, line, baseDir) {
  const tags = [...sync.inputs].filter(([, p]) => p && samePath(p, file, baseDir)).map(([t]) => t)
  if (!tags.length) return null
  let bestLine = Infinity
  let hits = []
  for (const r of sync.records) {
    if (r.type === '[' || !tags.includes(r.tag) || r.line < line || r.page === 0) continue
    if (r.line < bestLine) { bestLine = r.line; hits = [r] } else if (r.line === bestLine) hits.push(r)
  }
  if (!hits.length) return null
  const page = hits[0].page
  const onPage = hits.filter(r => r.page === page)
  const top = Math.min(...onPage.map(r => r.y - (r.h || TEXT_HEIGHT)))
  const bottom = Math.max(...onPage.map(r => r.y + (r.d || TEXT_DEPTH)))
  const left = Math.min(...onPage.map(r => r.x))
  const right = Math.max(...onPage.map(r => r.x + r.w))
  const wide = right - left >= 5
  return { page, y: top, h: bottom - top, x: wide ? left : null, w: wide ? right - left : null }
}
