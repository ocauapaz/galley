// LaTeX language support for CodeMirror: tokenizer, highlight style, completions, outline.
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { snippet } from '@codemirror/autocomplete'
import { tags as t } from '@lezer/highlight'

const SECTION = /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph|frametitle|title)\*?/
const REF_ARG = /^\\(label|ref|eqref|cref|Cref|autoref|pageref|nameref|cite|citep|citet|parencite|textcite|autocite|footcite|nocite|input|include|subfile|usepackage|RequirePackage|documentclass|includegraphics|bibliography|addbibresource|bibliographystyle|url)\b\*?/
export const MATH_ENVS = new Set(['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*',
  'flalign', 'flalign*', 'alignat', 'alignat*', 'eqnarray', 'eqnarray*', 'displaymath', 'math'])

function tokenArg(stream, s) {
  if (stream.eat('{')) { s.depth++; return 'bracket' }
  if (stream.eat('}')) {
    if (--s.depth <= 0) {
      if (s.pendingMath) { s.math = s.pendingMath; s.pendingMath = null }
      s.arg = null; s.depth = 0
    }
    return 'bracket'
  }
  if (stream.peek() === '\\' || stream.peek() === '$') return null
  if (s.arg === 'typeName') {
    const m = stream.match(/^[^{}\n]+/)
    if (m && s.envCmd === 'begin' && MATH_ENVS.has(m[0].trim())) s.pendingMath = 'env:' + m[0].trim()
    if (m && s.envCmd === 'end' && s.math === 'env:' + m[0].trim()) s.math = null
    return 'typeName'
  }
  stream.match(/^[^{}\\$%\n]+/) || stream.next()
  return s.arg
}

function tokenMath(stream, s) {
  const close = s.math
  if (close === '$' && stream.eat('$')) { s.math = null; return 'meta' }
  if (close === '$$' && stream.match('$$')) { s.math = null; return 'meta' }
  if ((close === '\\)' || close === '\\]') && stream.match(close)) { s.math = null; return 'meta' }
  if (close.startsWith('env:') && stream.match(/^\\end\b/)) { s.arg = 'typeName'; s.envCmd = 'end'; return 'keyword' }
  if (stream.match(/^\\[a-zA-Z@]+\*?/)) return 'atom'
  if (stream.match(/^\\./)) return 'escape'
  if (stream.match(/^%.*/)) return 'comment'
  if (stream.match(/^\d+(\.\d+)?/)) return 'number'
  if (stream.match(/^[{}]/)) return 'bracket'
  if (stream.match(/^[_^&]/)) return 'operator'
  stream.match(/^[^\\$%{}_^&\d]+/) || stream.next()
  return 'string'
}

const latexMode = {
  name: 'latex',
  startState: () => ({ math: null, arg: null, depth: 0, envCmd: null, pendingMath: null }),
  copyState: s => ({ ...s }),
  token(stream, s) {
    if (s.arg && (s.depth > 0 || stream.peek() === '{')) {
      const style = tokenArg(stream, s)
      if (style !== null) return style
    } else if (s.arg && stream.peek() === '[') {
      stream.match(/^\[[^\]\n]*\]?/)
      return 'attributeName'
    } else if (s.arg && !stream.match(/^\s+/, false)) {
      s.arg = null
    }
    if (s.math && !s.arg) return tokenMath(stream, s)
    if (stream.match(/^%.*/)) return 'comment'
    if (stream.match(/^\\(begin|end)\b/)) {
      s.arg = 'typeName'; s.envCmd = stream.current().slice(1); s.depth = 0
      return 'keyword'
    }
    if (stream.match(SECTION)) { s.arg = 'heading'; s.depth = 0; return 'keyword' }
    if (stream.match(REF_ARG)) { s.arg = 'labelName'; s.depth = 0; return 'tagName' }
    if (stream.match('\\[')) { s.math = '\\]'; return 'meta' }
    if (stream.match('\\(')) { s.math = '\\)'; return 'meta' }
    if (stream.match(/^\\[a-zA-Z@]+\*?/)) return 'tagName'
    if (stream.match(/^\\./)) return 'escape'
    if (stream.match('$$')) { s.math = '$$'; return 'meta' }
    if (stream.eat('$')) { s.math = '$'; return 'meta' }
    if (stream.match(/^[{}[\]]/)) return 'bracket'
    if (stream.match(/^[&~^_#]/)) return 'operator'
    if (stream.match(/^\d+(\.\d+)?/)) return 'number'
    stream.match(/^[^\\%$&~^_#{}[\]\d]+/) || stream.next()
    return null
  },
  languageData: { commentTokens: { line: '%' }, closeBrackets: { brackets: ['(', '[', '{', '$'] } },
}

export const latexLanguage = StreamLanguage.define(latexMode)

export const latexHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: t.tagName, color: 'var(--syn-cmd)' },
  { tag: t.typeName, color: 'var(--syn-env)' },
  { tag: t.heading, color: 'var(--syn-heading)', fontWeight: '700' },
  { tag: t.labelName, color: 'var(--syn-label)' },
  { tag: t.attributeName, color: 'var(--syn-muted)' },
  { tag: t.string, color: 'var(--syn-math)' },
  { tag: t.atom, color: 'var(--syn-mathcmd)' },
  { tag: t.meta, color: 'var(--syn-mathdelim)', fontWeight: '700' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: t.operator, color: 'var(--syn-operator)' },
  { tag: t.escape, color: 'var(--syn-operator)' },
  { tag: t.bracket, color: 'var(--syn-bracket)' },
]))

// ---------- outline ----------

const OUTLINE_RE = /\\(part|chapter|section|subsection|subsubsection|frametitle)\*?\s*(?:\[[^\]]*\])?\{((?:[^{}]|\{[^{}]*\})*)\}|\\begin\{frame\}(?:\[[^\]]*\])?\{([^}]*)\}/
const LEVELS = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, frametitle: 3, frame: 3 }

/** Sections of a document as [{ level, kind, title, line }] (line is 1-based). */
export function outline(text) {
  const out = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/(^|[^\\])%.*/, '$1')
    const m = OUTLINE_RE.exec(line)
    if (!m) return
    const kind = m[1] || 'frame'
    out.push({ level: LEVELS[kind], kind, title: (m[2] ?? m[3] ?? '').trim() || '(untitled)', line: i + 1 })
  })
  return out
}

/** Labels and BibTeX keys found in a file's text. */
export function indexText(path, text) {
  if (/\.bib$/i.test(path)) return { labels: [], bibkeys: [...text.matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)].map(m => m[1]) }
  return { labels: [...text.matchAll(/\\label\{([^}]+)\}/g)].map(m => m[1]), bibkeys: [...text.matchAll(/\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g)].map(m => m[1]) }
}

// ---------- completion data ----------

const GREEK = 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega'.split(' ')
const MATH_PLAIN = ('infty partial nabla cdot cdots ldots vdots ddots times div pm mp leq geq neq approx equiv sim simeq cong propto in notin ni subset subseteq supset supseteq cup cap setminus emptyset varnothing forall exists nexists neg land lor implies impliedby iff to gets rightarrow leftarrow Rightarrow Leftarrow leftrightarrow Leftrightarrow mapsto longrightarrow Longrightarrow uparrow downarrow circ bullet star ast oplus otimes perp parallel angle triangle hbar ell Re Im aleph wp top bot vdash models prime ' +
  'sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln exp lim limsup liminf max min sup inf det dim ker gcd arg deg Pr quad qquad displaystyle textstyle left right big Big bigg Bigg middle nonumber notag').split(' ')

// [name, template?, detail]
const WITH_ARGS = [
  ['frac', '\\frac{${num}}{${den}}', 'fraction'], ['dfrac', '\\dfrac{${num}}{${den}}', 'display fraction'], ['tfrac', '\\tfrac{${num}}{${den}}', 'text fraction'],
  ['sqrt', '\\sqrt{${x}}', 'square root'], ['sqrt[]', '\\sqrt[${n}]{${x}}', 'n-th root'], ['binom', '\\binom{${n}}{${k}}', 'binomial'],
  ['sum', '\\sum_{${i=1}}^{${n}} ${}', 'sum'], ['prod', '\\prod_{${i=1}}^{${n}} ${}', 'product'], ['int', '\\int_{${a}}^{${b}} ${f(x)} \\,d${x}', 'integral'],
  ['iint', '\\iint_{${D}} ${}', 'double integral'], ['oint', '\\oint_{${C}} ${}', 'contour integral'], ['lim', '\\lim_{${x} \\to ${\\infty}} ${}', 'limit'],
  ['mathbb', '\\mathbb{${R}}', 'blackboard bold'], ['mathcal', '\\mathcal{${A}}', 'calligraphic'], ['mathbf', '\\mathbf{${x}}', 'bold (math)'],
  ['mathrm', '\\mathrm{${x}}', 'roman (math)'], ['mathit', '\\mathit{${x}}', 'italic (math)'], ['mathfrak', '\\mathfrak{${g}}', 'fraktur'],
  ['mathsf', '\\mathsf{${x}}', 'sans (math)'], ['boldsymbol', '\\boldsymbol{${x}}', 'bold symbol'], ['operatorname', '\\operatorname{${op}}', 'operator'],
  ['text', '\\text{${text}}', 'text in math'], ['vec', '\\vec{${v}}', 'vector'], ['hat', '\\hat{${x}}', 'hat'], ['widehat', '\\widehat{${xy}}', 'wide hat'],
  ['bar', '\\bar{${x}}', 'bar'], ['overline', '\\overline{${x}}', 'overline'], ['underline', '\\underline{${text}}', 'underline'],
  ['tilde', '\\tilde{${x}}', 'tilde'], ['widetilde', '\\widetilde{${xy}}', 'wide tilde'], ['dot', '\\dot{${x}}', 'dot'], ['ddot', '\\ddot{${x}}', 'double dot'],
  ['overbrace', '\\overbrace{${x}}^{${label}}', 'overbrace'], ['underbrace', '\\underbrace{${x}}_{${label}}', 'underbrace'],
  ['left(', '\\left( ${} \\right)', 'scaled parentheses'], ['left[', '\\left[ ${} \\right]', 'scaled brackets'], ['left\\{', '\\left\\{ ${} \\right\\}', 'scaled braces'],
  ['left|', '\\left| ${} \\right|', 'scaled bars'], ['langle', '\\langle ${} \\rangle', 'angle brackets'],
  ['textbf', '\\textbf{${text}}', 'bold'], ['textit', '\\textit{${text}}', 'italic'], ['emph', '\\emph{${text}}', 'emphasis'], ['texttt', '\\texttt{${text}}', 'monospace'],
  ['textsc', '\\textsc{${text}}', 'small caps'], ['textsf', '\\textsf{${text}}', 'sans serif'], ['textrm', '\\textrm{${text}}', 'roman'], ['textup', '\\textup{${text}}', 'upright'],
  ['textcolor', '\\textcolor{${red}}{${text}}', 'colored text'], ['colorbox', '\\colorbox{${yellow}}{${text}}', 'colored box'], ['fbox', '\\fbox{${text}}', 'framed box'],
  ['mbox', '\\mbox{${text}}', 'box'], ['parbox', '\\parbox{${width}}{${text}}', 'paragraph box'], ['footnote', '\\footnote{${text}}', 'footnote'],
  ['part', '\\part{${title}}', 'part'], ['chapter', '\\chapter{${title}}', 'chapter'], ['section', '\\section{${title}}', 'section'], ['section*', '\\section*{${title}}', 'unnumbered section'],
  ['subsection', '\\subsection{${title}}', 'subsection'], ['subsubsection', '\\subsubsection{${title}}', 'subsubsection'], ['paragraph', '\\paragraph{${title}}', 'paragraph'],
  ['label', '\\label{${key}}', 'label'], ['ref', '\\ref{${key}}', 'reference'], ['eqref', '\\eqref{${key}}', 'equation reference'], ['pageref', '\\pageref{${key}}', 'page reference'],
  ['cref', '\\cref{${key}}', 'clever reference'], ['autoref', '\\autoref{${key}}', 'auto reference'], ['cite', '\\cite{${key}}', 'citation'],
  ['citep', '\\citep{${key}}', 'parenthetical citation'], ['citet', '\\citet{${key}}', 'textual citation'], ['parencite', '\\parencite{${key}}', 'biblatex citation'],
  ['url', '\\url{${https://}}', 'URL'], ['href', '\\href{${https://}}{${text}}', 'hyperlink'], ['includegraphics', '\\includegraphics[width=${0.8}\\linewidth]{${file}}', 'image'],
  ['caption', '\\caption{${text}}', 'caption'], ['title', '\\title{${title}}', 'document title'], ['author', '\\author{${name}}', 'author'], ['date', '\\date{${\\today}}', 'date'],
  ['usepackage', '\\usepackage{${package}}', 'load package'], ['usepackage[]', '\\usepackage[${options}]{${package}}', 'package with options'],
  ['documentclass', '\\documentclass[${11pt}]{${article}}', 'document class'], ['input', '\\input{${file}}', 'input file'], ['include', '\\include{${file}}', 'include file'],
  ['newcommand', '\\newcommand{\\${name}}[${1}]{${definition}}', 'define command'], ['renewcommand', '\\renewcommand{\\${name}}{${definition}}', 'redefine command'],
  ['DeclareMathOperator', '\\DeclareMathOperator{\\${name}}{${text}}', 'math operator'], ['hspace', '\\hspace{${1em}}', 'horizontal space'], ['vspace', '\\vspace{${1em}}', 'vertical space'],
  ['multicolumn', '\\multicolumn{${2}}{${c}}{${text}}', 'span columns'], ['multirow', '\\multirow{${2}}{*}{${text}}', 'span rows'], ['cline', '\\cline{${1-2}}', 'partial rule'],
  ['bibliography', '\\bibliography{${refs}}', 'BibTeX database'], ['bibliographystyle', '\\bibliographystyle{${plain}}', 'BibTeX style'], ['addbibresource', '\\addbibresource{${refs.bib}}', 'biblatex database'],
  ['setlength', '\\setlength{\\${parindent}}{${0pt}}', 'set length'], ['setcounter', '\\setcounter{${counter}}{${1}}', 'set counter'], ['item[]', '\\item[${label}] ${}', 'labeled item'],
]
const TEXT_PLAIN = 'item maketitle tableofcontents listoffigures listoftables newpage clearpage cleardoublepage centering raggedright raggedleft noindent par newline linebreak pagebreak hline toprule midrule bottomrule today LaTeX TeX appendix printbibliography small footnotesize scriptsize tiny large Large LARGE huge Huge normalsize bfseries itshape ttfamily scshape linewidth textwidth columnwidth hfill vfill smallskip medskip bigskip frontmatter mainmatter backmatter'.split(' ')

export const ENVIRONMENTS = ['document', 'figure', 'figure*', 'table', 'table*', 'tabular', 'tabularx', 'equation', 'equation*', 'align', 'align*', 'gather', 'gather*',
  'multline', 'split', 'cases', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'array', 'itemize', 'enumerate', 'description', 'center', 'flushleft', 'flushright',
  'minipage', 'abstract', 'quote', 'quotation', 'verse', 'verbatim', 'lstlisting', 'theorem', 'lemma', 'proposition', 'corollary', 'definition', 'example', 'remark', 'proof',
  'frame', 'block', 'alertblock', 'exampleblock', 'columns', 'column', 'thebibliography', 'tikzpicture', 'axis', 'subfigure', 'wrapfigure', 'titlepage', 'multicols']

// Arguments stop at braces and backslashes so an unclosed \ref{ earlier on the line doesn't swallow later commands.
const REF_CMDS = /\\(?:ref|eqref|cref|Cref|autoref|pageref|nameref)\{([^{}\\]*)$/
const CITE_CMDS = /\\(?:cite|citep|citet|parencite|textcite|autocite|footcite|nocite|citeauthor|citeyear)(?:\[[^\]]*\])*\{(?:[^{}\\]*,)?\s*([^,{}\\]*)$/
const FILE_CMDS = /\\(includegraphics|input|include|subfile|addbibresource|bibliography)(?:\[[^\]]*\])?\{([^{}\\]*)$/
const IMG_EXT = /\.(png|jpe?g|pdf|eps|svg)$/i

const commandOptions = (() => {
  const opts = []
  const seen = new Set()
  for (const [name, tpl, detail] of WITH_ARGS) {
    seen.add(name)
    opts.push({ label: '\\' + name, detail, type: 'function', apply: snippet(tpl.includes('${}') ? tpl : tpl + '${}') })
  }
  for (const n of GREEK) if (!seen.has(n)) opts.push({ label: '\\' + n, detail: 'greek', type: 'constant' })
  for (const n of [...MATH_PLAIN, ...TEXT_PLAIN]) if (!seen.has(n)) { seen.add(n); opts.push({ label: '\\' + n, type: 'keyword' }) }
  return opts
})()

// Extends a completion's range over an auto-inserted closing brace so it isn't doubled.
function overBrace(view, to) {
  return view.state.sliceDoc(to, to + 1) === '}' ? to + 1 : to
}

const ENV_HEAD = { tabular: '{${ll}}', tabularx: '{\\linewidth}{${lX}}', frame: '{${Title}}', minipage: '{${0.5}\\linewidth}', column: '{${0.5}\\textwidth}',
  figure: '[${htbp}]', table: '[${htbp}]', multicols: '{${2}}', array: '{${cc}}', alignat: '{${2}}' }
const ENV_BODY = { itemize: '\\item ${}', enumerate: '\\item ${}', description: '\\item[${label}] ${}' }

function envOption(name) {
  const apply = snippet(name + '}' + (ENV_HEAD[name] ?? '') + '\n\t' + (ENV_BODY[name] ?? '${}') + '\n\\end{' + name + '}')
  return { label: name, type: 'type', apply: (view, c, from, to) => apply(view, c, from, overBrace(view, to)) }
}
const envOptions = ENVIRONMENTS.map(envOption)

function plainList(items, type, detail) {
  return items.map(label => ({ label, type, detail, apply: (view, c, from, to) => {
    view.dispatch({ changes: { from, to: overBrace(view, to), insert: label + '}' }, selection: { anchor: from + label.length + 1 } })
  } }))
}

/**
 * Completion source. `ctx()` supplies { labels, bibkeys, files, snippets } from the open project;
 * files are paths relative to the current document's folder.
 */
export function latexCompletions(ctx) {
  return context => {
    const line = context.state.doc.lineAt(context.pos)
    const before = line.text.slice(0, context.pos - line.from)
    const p = ctx()
    let m
    if ((m = /\\(?:begin|end)\{([^{}\\]*)$/.exec(before))) {
      const opts = /\\end\{/.test(before.slice(-m[0].length)) ? plainList(ENVIRONMENTS, 'type') : envOptions
      return { from: context.pos - m[1].length, options: opts, validFor: /^[\w*]*$/ }
    }
    if ((m = REF_CMDS.exec(before))) return { from: context.pos - m[1].length, options: plainList(p.labels, 'variable', 'label'), validFor: /^[^}]*$/ }
    if ((m = CITE_CMDS.exec(before))) return { from: context.pos - m[1].length, options: plainList(p.bibkeys, 'text', 'citation'), validFor: /^[^,}]*$/ }
    if ((m = FILE_CMDS.exec(before))) {
      const cmd = m[1]
      const files = p.files.filter(f => cmd === 'includegraphics' ? IMG_EXT.test(f) : cmd === 'addbibresource' || cmd === 'bibliography' ? /\.bib$/i.test(f) : /\.tex$/i.test(f))
        .map(f => cmd === 'input' || cmd === 'include' || cmd === 'subfile' || cmd === 'bibliography' ? f.replace(/\.(tex|bib)$/i, '') : f)
      return { from: context.pos - m[2].length, options: plainList(files, 'text', 'file'), validFor: /^[^}]*$/ }
    }
    const word = context.matchBefore(/\\[a-zA-Z@]*\*?$/)
    if (!word || (word.from === word.to - 1 && !context.explicit && !/\\$/.test(before))) return null
    const snips = p.snippets.map(s => ({ label: '\\' + s.trigger, detail: s.name, type: 'text', boost: -1, apply: snippet(s.body) }))
    return { from: word.from, options: [...commandOptions, ...snips], validFor: /^\\[a-zA-Z@]*\*?$/ }
  }
}
