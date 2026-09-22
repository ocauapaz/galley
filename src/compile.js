// Compiler glue: engine availability, running a compile, reading SyncTeX data.
import { invoke } from '@tauri-apps/api/core'
import { parseLog } from './logparse.js'
import { parseSynctex } from './synctex.js'
import { settings } from './settings.js'
import { dirname } from './ui.js'

/** Resolves `rel` against `dir`, collapsing . and .. segments. Absolute paths pass through. */
export function resolvePath(dir, rel) {
  // ponytail: drive-letter paths only; UNC (\\server\share) projects would need the prefix kept.
  const isAbs = /^[a-zA-Z]:[\\/]/.test(rel)
  const out = []
  for (const p of (isAbs ? rel : dir + '\\' + rel).split(/[\\/]+/)) {
    if (p === '.' || p === '') continue
    if (p === '..' && out.length > 1) out.pop()
    else out.push(p)
  }
  return out.join('\\')
}

/** Returns true when the configured engine can run; downloads Tectonic when it is the engine and missing. */
export async function ensureEngine(onDownload) {
  const path = await invoke('engine_path', { engine: settings.engine, custom: settings.enginePath })
  if (path) return true
  if (settings.engine !== 'tectonic' || settings.enginePath.trim()) return false
  onDownload()
  await invoke('install_tectonic')
  return true
}

/** Compiles `file`; problems carry absolute file paths. */
export async function compileFile(file) {
  const r = await invoke('compile', { file, engine: settings.engine, custom: settings.enginePath })
  const dir = dirname(file)
  const problems = parseLog(r.output, r.log, file).map(p => ({ ...p, file: p.file ? resolvePath(dir, p.file) : null }))
  if (!r.ok && !problems.some(p => p.severity === 'error')) {
    const last = r.output.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' ') || `The compiler exited with code ${r.code ?? '?'}`
    problems.unshift({ severity: 'error', file: null, line: null, message: last })
  }
  return { ...r, problems }
}

export async function loadSynctex(pdfPath) {
  const base = pdfPath.replace(/\.pdf$/i, '')
  for (const [suffix, gz] of [['.synctex.gz', true], ['.synctex', false]]) {
    const path = base + suffix
    if (!(await invoke('path_exists', { path }))) continue
    const bytes = new Uint8Array(await invoke('read_bytes', { path }))
    const text = gz
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder().decode(bytes)
    return parseSynctex(text)
  }
  return null
}
