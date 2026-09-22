import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLog } from '../src/logparse.js'
import { parseSynctex, inverseSearch, forwardSearch } from '../src/synctex.js'
import { outline, indexText } from '../src/latex.js'
import { fuzzy } from '../src/palette.js'

test('parseLog reads tectonic and file-line-error messages', () => {
  const out = [
    'note: Running TeX ...',
    'error: main.tex:12: Undefined control sequence',
    'warning: ./chapters/intro.tex:3: Something odd',
    'warning: Overfull \\hbox (1.2pt too wide) in paragraph at lines 20--22',
    'error: halted on potentially-recoverable error as specified',
  ].join('\n')
  const log = [
    'LaTeX Warning: Reference `fig:x\' on page 1 undefined on input line 40.',
    'Package hyperref Warning: Token not allowed in a PDF string',
    '(hyperref)                removing `math shift\' on input line 7.',
    '! Missing $ inserted.',
    '<inserted text>',
    'l.55 x^',
  ].join('\n')
  const p = parseLog(out, log, 'C:\\p\\main.tex')
  assert.equal(p[0].severity, 'error')
  assert.deepEqual(p.find(x => x.line === 12), { severity: 'error', file: 'main.tex', line: 12, message: 'Undefined control sequence' })
  assert.equal(p.find(x => x.file === './chapters/intro.tex').severity, 'warning')
  assert.ok(p.some(x => x.severity === 'info' && x.message.startsWith('Overfull')))
  assert.ok(p.some(x => x.line === 40 && /Reference `fig:x' on page 1 undefined\./.test(x.message)))
  assert.ok(p.some(x => x.line === 7 && /removing `math shift'/.test(x.message)), 'continuation lines are joined')
  assert.ok(p.some(x => x.line === 55 && x.message === 'Missing $ inserted.' && x.file === 'C:\\p\\main.tex'))
  assert.ok(!p.some(x => /halted/.test(x.message)), 'generic engine errors are dropped when a located error exists')
})

test('parseLog dedupes the same error reported by stderr and the log', () => {
  const p = parseLog('error: main.tex:14: Undefined control sequence', '! Undefined control sequence.\nl.14 \\foo', 'C:\\main.tex')
  assert.equal(p.filter(x => x.severity === 'error').length, 1)
})

const SYNC = `SyncTeX Version:1
Input:1:./main.tex
Input:2:C:/proj/intro.tex
Output:pdf
Magnification:1000
Unit:1
X Offset:0
Y Offset:0
Content:
!100
{1
[1,3:4736286,4736286:30000000,40000000,0
(1,5:4736286,6000000:20000000,655360,0
h1,5:4736286,6000000:1000000,655360,0
(2,9:4736286,9000000:20000000,655360,0
]1
}1
{2
(1,20:4736286,5000000:20000000,655360,0
}2
Postamble:
`

test('synctex converts sp to PDF points and resolves both directions', () => {
  const s = parseSynctex(SYNC)
  assert.equal(s.inputs.get(1), './main.tex')
  const r = s.records.find(x => x.type === '(' && x.line === 5)
  assert.ok(Math.abs(r.x - 72) < 0.01, `x in bp, got ${r.x}`)
  const hit = inverseSearch(s, 1, 100, 6000000 / 65781.76 - 2, 'C:\\proj')
  assert.deepEqual(hit, { file: 'C:\\proj\\main.tex', line: 5 })
  assert.equal(inverseSearch(s, 1, 100, 9000000 / 65781.76 - 2, 'C:\\proj').file, 'C:\\proj\\intro.tex')
  const box = forwardSearch(s, 'C:\\proj\\main.tex', 20, 'C:\\proj')
  assert.equal(box.page, 2)
  assert.equal(forwardSearch(s, 'C:\\proj\\main.tex', 4, 'C:\\proj').page, 1, 'falls forward to the next line with output')
  assert.equal(forwardSearch(s, 'C:\\other.tex', 1, 'C:\\proj'), null)
})

test('outline finds sections, skips comments, reads frame titles', () => {
  const o = outline('\\section{Intro}\n% \\section{Hidden}\n\\subsection*[s]{Deep {nested} title}\n\\begin{frame}{Slide}\n')
  assert.deepEqual(o.map(x => [x.kind, x.title, x.line]), [['section', 'Intro', 1], ['subsection', 'Deep {nested} title', 3], ['frame', 'Slide', 4]])
})

test('indexText extracts labels and bib keys', () => {
  assert.deepEqual(indexText('a.tex', '\\label{eq:1} x \\label{fig:a}').labels, ['eq:1', 'fig:a'])
  assert.deepEqual(indexText('r.bib', '@article{knuth84,\n title={x}}\n@book{ lamport94 ,').bibkeys, ['knuth84', 'lamport94'])
})

test('fuzzy prefers contiguous matches and rejects missing chars', () => {
  assert.equal(fuzzy('xyz', 'main.tex'), null)
  assert.ok(fuzzy('main', 'main.tex').score > fuzzy('main', 'm_a_i_n.tex').score)
})
