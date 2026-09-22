// Turns compiler output + .log text into a list of problems.
// Problem: { severity: 'error'|'warning'|'info', file: string|null, line: number|null, message }

const FILE_LINE = /^(?:(error|warning):\s*)?(\S[^:\n]*?\.(?:tex|sty|cls|bib|ltx|dtx|bbl)):(\d+):\s*(.+)$/
const TECTONIC_GENERAL = /^(error|warning):\s*(.+)$/
const LATEX_WARNING = /^(?:LaTeX|Package|Class)\s*(?:\S+\s+)?Warning:\s*(.+)$/
const BADBOX = /^((?:Over|Under)full \\[hv]box .*?)(?: in (?:paragraph|alignment) at lines (\d+)--\d+| detected at line (\d+))?$/
const TEX_ERROR = /^! (.+)$/
const INPUT_LINE = /on input line (\d+)/
// Tectonic reports every system font fontspec scans; that is not something the author can act on.
const NOISE = /build may not be reproducible/

// Warnings wrap across lines in the log; the continuation is indented with the package name.
function joinContinuation(lines, i, first) {
  let msg = first
  while (i + 1 < lines.length && /^\(\S+\)\s+/.test(lines[i + 1])) msg += ' ' + lines[++i].replace(/^\(\S+\)\s+/, '')
  return [msg, i]
}

/** Parses tectonic/pdflatex/latexmk output. `mainFile` is used when a message carries no file. */
export function parseLog(output, log, mainFile) {
  const out = []
  const seen = new Set()
  const add = (severity, file, line, message) => {
    message = message.trim()
    if (NOISE.test(message)) return
    const key = `${severity}|${line}|${message.replace(/\.$/, '')}`
    if (!message || seen.has(key)) return
    seen.add(key)
    out.push({ severity, file, line, message })
  }

  const scan = (text, isLog) => {
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      let m
      if ((m = FILE_LINE.exec(l))) {
        add(m[1] === 'warning' ? 'warning' : 'error', m[2], +m[3], m[4])
      } else if ((m = TEX_ERROR.exec(l)) && isLog) {
        // Classic log error: the line number follows on an "l.<n>" line.
        let line = null
        for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
          const lm = /^l\.(\d+)/.exec(lines[j])
          if (lm) { line = +lm[1]; break }
        }
        add('error', line ? mainFile : null, line, m[1])
      } else if ((m = LATEX_WARNING.exec(l))) {
        let msg
        ;[msg, i] = joinContinuation(lines, i, m[1])
        const lm = INPUT_LINE.exec(msg)
        add('warning', lm ? mainFile : null, lm ? +lm[1] : null, msg.replace(/\s*on input line \d+\.?/, '.').replace(/\.\.$/, '.'))
      } else if ((m = BADBOX.exec(l))) {
        const line = m[2] || m[3]
        add('info', line ? mainFile : null, line ? +line : null, m[1])
      } else if (!isLog && (m = TECTONIC_GENERAL.exec(l))) {
        const sev = m[1] === 'warning' ? 'warning' : 'error'
        const bm = BADBOX.exec(m[2])
        if (bm) add('info', null, null, bm[1])
        else if (!/^\s*$/.test(m[2])) add(sev, null, null, m[2])
      }
    }
  }
  scan(output || '', false)
  scan(log || '', true)

  // Tectonic adds generic "the engine failed" lines; they only help when nothing better was found.
  const located = out.some(p => p.severity === 'error' && p.line)
  const rank = { error: 0, warning: 1, info: 2 }
  return out.filter(p => !(located && p.severity === 'error' && !p.line)).sort((a, b) => rank[a.severity] - rank[b.severity])
}
