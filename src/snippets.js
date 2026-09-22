// Built-in snippets, math symbols and project templates.
// Snippet bodies use CodeMirror syntax: ${name} is a field, ${} an empty stop, \t an indent.

export const SNIPPETS = [
  { category: 'Structure', items: [
    { name: 'Section', trigger: 'sec', body: '\\section{${Title}}\n\\label{sec:${label}}\n\n${}' },
    { name: 'Subsection', trigger: 'sub', body: '\\subsection{${Title}}\n\\label{sub:${label}}\n\n${}' },
    { name: 'Subsubsection', trigger: 'ssub', body: '\\subsubsection{${Title}}\n\n${}' },
    { name: 'Chapter', trigger: 'chap', body: '\\chapter{${Title}}\n\\label{chap:${label}}\n\n${}' },
    { name: 'Paragraph', trigger: 'par', body: '\\paragraph{${Title}} ${}' },
    { name: 'Abstract', trigger: 'abs', body: '\\begin{abstract}\n\t${}\n\\end{abstract}' },
    { name: 'Title block', trigger: 'titleblock', body: '\\title{${Title}}\n\\author{${Author}}\n\\date{\\today}\n\\maketitle\n${}' },
    { name: 'Table of contents', trigger: 'toc', body: '\\tableofcontents\n\\newpage\n${}' },
    { name: 'Appendix', trigger: 'app', body: '\\appendix\n\\section{${Title}}\n${}' },
  ] },
  { category: 'Environments', items: [
    { name: 'Environment', trigger: 'env', body: '\\begin{${name}}\n\t${}\n\\end{${name}}' },
    { name: 'Center', trigger: 'cent', body: '\\begin{center}\n\t${}\n\\end{center}' },
    { name: 'Minipage', trigger: 'mini', body: '\\begin{minipage}{${0.48}\\linewidth}\n\t${}\n\\end{minipage}' },
    { name: 'Two columns', trigger: 'cols', body: '\\begin{minipage}[t]{0.48\\linewidth}\n\t${left}\n\\end{minipage}\\hfill\n\\begin{minipage}[t]{0.48\\linewidth}\n\t${right}\n\\end{minipage}' },
    { name: 'Quote', trigger: 'quote', body: '\\begin{quote}\n\t${}\n\\end{quote}' },
    { name: 'Verbatim', trigger: 'verb', body: '\\begin{verbatim}\n${}\n\\end{verbatim}' },
    { name: 'Code listing', trigger: 'lst', body: '\\begin{lstlisting}[language=${Python}, caption={${Caption}}]\n${}\n\\end{lstlisting}' },
    { name: 'Theorem', trigger: 'thm', body: '\\begin{theorem}[${Name}]\n\t${}\n\\end{theorem}' },
    { name: 'Lemma', trigger: 'lem', body: '\\begin{lemma}\n\t${}\n\\end{lemma}' },
    { name: 'Definition', trigger: 'def', body: '\\begin{definition}[${Term}]\n\t${}\n\\end{definition}' },
    { name: 'Proof', trigger: 'proof', body: '\\begin{proof}\n\t${}\n\\end{proof}' },
  ] },
  { category: 'Lists', items: [
    { name: 'Bullet list', trigger: 'item', body: '\\begin{itemize}\n\t\\item ${}\n\\end{itemize}' },
    { name: 'Numbered list', trigger: 'enum', body: '\\begin{enumerate}\n\t\\item ${}\n\\end{enumerate}' },
    { name: 'Description list', trigger: 'desc', body: '\\begin{description}\n\t\\item[${Term}] ${}\n\\end{description}' },
    { name: 'Compact list (enumitem)', trigger: 'citem', body: '\\begin{itemize}[noitemsep]\n\t\\item ${}\n\\end{itemize}' },
  ] },
  { category: 'Math', items: [
    { name: 'Inline math', trigger: 'mk', body: '$${}$' },
    { name: 'Display math', trigger: 'dm', body: '\\[\n\t${}\n\\]' },
    { name: 'Equation', trigger: 'eq', body: '\\begin{equation}\n\t${}\n\t\\label{eq:${label}}\n\\end{equation}' },
    { name: 'Equation (unnumbered)', trigger: 'eqs', body: '\\begin{equation*}\n\t${}\n\\end{equation*}' },
    { name: 'Align', trigger: 'ali', body: '\\begin{align}\n\t${a} &= ${b} \\\\\n\t${c} &= ${d}\n\\end{align}' },
    { name: 'Align (unnumbered)', trigger: 'alis', body: '\\begin{align*}\n\t${a} &= ${b}\n\\end{align*}' },
    { name: 'Cases', trigger: 'case', body: '\\begin{cases}\n\t${a} & \\text{if } ${x > 0} \\\\\n\t${b} & \\text{otherwise}\n\\end{cases}' },
    { name: 'Matrix (parentheses)', trigger: 'pmat', body: '\\begin{pmatrix}\n\t${a} & ${b} \\\\\n\t${c} & ${d}\n\\end{pmatrix}' },
    { name: 'Matrix (brackets)', trigger: 'bmat', body: '\\begin{bmatrix}\n\t${a} & ${b} \\\\\n\t${c} & ${d}\n\\end{bmatrix}' },
    { name: 'Determinant', trigger: 'vmat', body: '\\begin{vmatrix}\n\t${a} & ${b} \\\\\n\t${c} & ${d}\n\\end{vmatrix}' },
    { name: 'Fraction', trigger: 'fr', body: '\\frac{${num}}{${den}}${}' },
    { name: 'Sum', trigger: 'sum', body: '\\sum_{${i=1}}^{${n}} ${}' },
    { name: 'Integral', trigger: 'int', body: '\\int_{${a}}^{${b}} ${f(x)}\\,\\mathrm{d}${x}' },
    { name: 'Limit', trigger: 'lim', body: '\\lim_{${n} \\to ${\\infty}} ${}' },
    { name: 'Derivative', trigger: 'dv', body: '\\frac{\\mathrm{d}${f}}{\\mathrm{d}${x}}${}' },
    { name: 'Partial derivative', trigger: 'pdv', body: '\\frac{\\partial ${f}}{\\partial ${x}}${}' },
    { name: 'Norm', trigger: 'norm', body: '\\left\\lVert ${x} \\right\\rVert${}' },
    { name: 'Absolute value', trigger: 'absv', body: '\\left| ${x} \\right|${}' },
    { name: 'Set builder', trigger: 'set', body: '\\left\\{ ${x} \\in ${X} \\;\\middle|\\; ${P(x)} \\right\\}${}' },
  ] },
  { category: 'Figures & tables', items: [
    { name: 'Figure', trigger: 'fig', body: '\\begin{figure}[${htbp}]\n\t\\centering\n\t\\includegraphics[width=${0.8}\\linewidth]{${image}}\n\t\\caption{${Caption}}\n\t\\label{fig:${label}}\n\\end{figure}' },
    { name: 'Side-by-side figures', trigger: 'subfig', body: '\\begin{figure}[htbp]\n\t\\centering\n\t\\begin{subfigure}{0.48\\linewidth}\n\t\t\\includegraphics[width=\\linewidth]{${left}}\n\t\t\\caption{${Left}}\n\t\\end{subfigure}\\hfill\n\t\\begin{subfigure}{0.48\\linewidth}\n\t\t\\includegraphics[width=\\linewidth]{${right}}\n\t\t\\caption{${Right}}\n\t\\end{subfigure}\n\t\\caption{${Caption}}\n\\end{figure}' },
    { name: 'Table', trigger: 'tab', body: '\\begin{table}[${htbp}]\n\t\\centering\n\t\\caption{${Caption}}\n\t\\label{tab:${label}}\n\t\\begin{tabular}{${lcr}}\n\t\t\\hline\n\t\t${A} & ${B} & ${C} \\\\\n\t\t\\hline\n\t\t${} &  &  \\\\\n\t\t\\hline\n\t\\end{tabular}\n\\end{table}' },
    { name: 'Booktabs table', trigger: 'btab', body: '\\begin{table}[htbp]\n\t\\centering\n\t\\caption{${Caption}}\n\t\\begin{tabular}{${lrr}}\n\t\t\\toprule\n\t\t${Item} & ${Value} & ${Unit} \\\\\n\t\t\\midrule\n\t\t${} &  &  \\\\\n\t\t\\bottomrule\n\t\\end{tabular}\n\\end{table}' },
    { name: 'Tabular', trigger: 'tabular', body: '\\begin{tabular}{${ll}}\n\t${a} & ${b} \\\\\n\\end{tabular}' },
    { name: 'TikZ picture', trigger: 'tikz', body: '\\begin{tikzpicture}\n\t\\draw[->] (0,0) -- (${2},0) node[right] {$x$};\n\t\\draw[->] (0,0) -- (0,${2}) node[above] {$y$};\n\t${}\n\\end{tikzpicture}' },
    { name: 'Plot (pgfplots)', trigger: 'plot', body: '\\begin{tikzpicture}\n\t\\begin{axis}[xlabel={$x$}, ylabel={$y$}, grid=major]\n\t\t\\addplot[domain=${-2}:${2}, samples=100, thick] {${x^2}};\n\t\\end{axis}\n\\end{tikzpicture}' },
  ] },
  { category: 'Formatting', items: [
    { name: 'Bold', trigger: 'bf', body: '\\textbf{${text}}${}' },
    { name: 'Italic', trigger: 'it', body: '\\textit{${text}}${}' },
    { name: 'Emphasis', trigger: 'em', body: '\\emph{${text}}${}' },
    { name: 'Monospace', trigger: 'tt', body: '\\texttt{${text}}${}' },
    { name: 'Small caps', trigger: 'sc', body: '\\textsc{${text}}${}' },
    { name: 'Colored text', trigger: 'col', body: '\\textcolor{${red}}{${text}}${}' },
    { name: 'Footnote', trigger: 'fn', body: '\\footnote{${text}}${}' },
    { name: 'Hyperlink', trigger: 'href', body: '\\href{${https://}}{${text}}${}' },
    { name: 'Quotes', trigger: 'qq', body: '``${text}\'\'${}' },
  ] },
  { category: 'References', items: [
    { name: 'Label', trigger: 'lbl', body: '\\label{${key}}${}' },
    { name: 'Reference', trigger: 'rf', body: '\\ref{${key}}${}' },
    { name: 'Equation reference', trigger: 'erf', body: '\\eqref{${key}}${}' },
    { name: 'Citation', trigger: 'ct', body: '\\cite{${key}}${}' },
    { name: 'Bibliography (BibTeX)', trigger: 'bib', body: '\\bibliographystyle{${plain}}\n\\bibliography{${references}}' },
    { name: 'Bibliography (biblatex)', trigger: 'biblatex', body: '\\usepackage[backend=biber, style=${authoryear}]{biblatex}\n\\addbibresource{${references.bib}}' },
    { name: 'BibTeX article entry', trigger: 'article', body: '@article{${key},\n\tauthor  = {${Author}},\n\ttitle   = {${Title}},\n\tjournal = {${Journal}},\n\tyear    = {${2026}},\n}' },
    { name: 'BibTeX book entry', trigger: 'book', body: '@book{${key},\n\tauthor    = {${Author}},\n\ttitle     = {${Title}},\n\tpublisher = {${Publisher}},\n\tyear      = {${2026}},\n}' },
  ] },
  { category: 'Beamer', items: [
    { name: 'Frame', trigger: 'frame', body: '\\begin{frame}{${Title}}\n\t${}\n\\end{frame}' },
    { name: 'Frame with bullets', trigger: 'bframe', body: '\\begin{frame}{${Title}}\n\t\\begin{itemize}\n\t\t\\item<1-> ${}\n\t\\end{itemize}\n\\end{frame}' },
    { name: 'Block', trigger: 'block', body: '\\begin{block}{${Title}}\n\t${}\n\\end{block}' },
    { name: 'Columns', trigger: 'bcols', body: '\\begin{columns}\n\t\\begin{column}{0.5\\textwidth}\n\t\t${left}\n\t\\end{column}\n\t\\begin{column}{0.5\\textwidth}\n\t\t${right}\n\t\\end{column}\n\\end{columns}' },
  ] },
]

// [glyph, command] — commands taking an argument end with {}.
export const SYMBOLS = [
  { category: 'Greek', items: [
    ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['δ', 'delta'], ['ε', 'epsilon'], ['ϵ', 'varepsilon'], ['ζ', 'zeta'], ['η', 'eta'], ['θ', 'theta'], ['ϑ', 'vartheta'],
    ['ι', 'iota'], ['κ', 'kappa'], ['λ', 'lambda'], ['μ', 'mu'], ['ν', 'nu'], ['ξ', 'xi'], ['π', 'pi'], ['ρ', 'rho'], ['σ', 'sigma'], ['τ', 'tau'], ['υ', 'upsilon'],
    ['φ', 'phi'], ['ϕ', 'varphi'], ['χ', 'chi'], ['ψ', 'psi'], ['ω', 'omega'], ['Γ', 'Gamma'], ['Δ', 'Delta'], ['Θ', 'Theta'], ['Λ', 'Lambda'], ['Ξ', 'Xi'],
    ['Π', 'Pi'], ['Σ', 'Sigma'], ['Φ', 'Phi'], ['Ψ', 'Psi'], ['Ω', 'Omega'],
  ] },
  { category: 'Operators', items: [
    ['±', 'pm'], ['∓', 'mp'], ['×', 'times'], ['÷', 'div'], ['·', 'cdot'], ['∘', 'circ'], ['∗', 'ast'], ['⊕', 'oplus'], ['⊗', 'otimes'], ['∑', 'sum'], ['∏', 'prod'],
    ['∫', 'int'], ['∬', 'iint'], ['∮', 'oint'], ['∂', 'partial'], ['∇', 'nabla'], ['√', 'sqrt{}'], ['∞', 'infty'], ['…', 'ldots'], ['⋯', 'cdots'], ['⋮', 'vdots'], ['⋱', 'ddots'],
  ] },
  { category: 'Relations', items: [
    ['≤', 'leq'], ['≥', 'geq'], ['≠', 'neq'], ['≈', 'approx'], ['≡', 'equiv'], ['∼', 'sim'], ['≃', 'simeq'], ['≅', 'cong'], ['∝', 'propto'], ['≪', 'll'], ['≫', 'gg'],
    ['⊥', 'perp'], ['∥', 'parallel'], ['≺', 'prec'], ['≻', 'succ'], ['⊢', 'vdash'], ['⊨', 'models'], ['≐', 'doteq'],
  ] },
  { category: 'Arrows', items: [
    ['→', 'to'], ['←', 'leftarrow'], ['↔', 'leftrightarrow'], ['⇒', 'Rightarrow'], ['⇐', 'Leftarrow'], ['⇔', 'Leftrightarrow'], ['↦', 'mapsto'], ['⟶', 'longrightarrow'],
    ['⟹', 'implies'], ['⟸', 'impliedby'], ['⟺', 'iff'], ['↑', 'uparrow'], ['↓', 'downarrow'], ['↗', 'nearrow'], ['↘', 'searrow'], ['↪', 'hookrightarrow'],
  ] },
  { category: 'Sets & logic', items: [
    ['∈', 'in'], ['∉', 'notin'], ['∋', 'ni'], ['⊂', 'subset'], ['⊆', 'subseteq'], ['⊃', 'supset'], ['⊇', 'supseteq'], ['∪', 'cup'], ['∩', 'cap'], ['∖', 'setminus'],
    ['∅', 'emptyset'], ['∀', 'forall'], ['∃', 'exists'], ['∄', 'nexists'], ['¬', 'neg'], ['∧', 'land'], ['∨', 'lor'], ['ℕ', 'mathbb{N}'], ['ℤ', 'mathbb{Z}'],
    ['ℚ', 'mathbb{Q}'], ['ℝ', 'mathbb{R}'], ['ℂ', 'mathbb{C}'], ['ℵ', 'aleph'],
  ] },
  { category: 'Accents & misc', items: [
    ['x̂', 'hat{}'], ['x̄', 'bar{}'], ['x⃗', 'vec{}'], ['x̃', 'tilde{}'], ['ẋ', 'dot{}'], ['ẍ', 'ddot{}'], ['ℏ', 'hbar'], ['ℓ', 'ell'], ['∠', 'angle'], ['△', 'triangle'],
    ['′', 'prime'], ['⟨⟩', 'langle ${} \\rangle'], ['‖', '|'], ['§', 'S'], ['¶', 'P'], ['†', 'dagger'], ['★', 'star'],
  ] },
]

/** CodeMirror snippet body for a symbol command. */
export function symbolBody(cmd) {
  if (cmd.includes('${')) return '\\' + cmd
  return cmd.endsWith('{}') ? '\\' + cmd.slice(0, -1) + '${}}' : '\\' + cmd
}

export const TEMPLATES = [
  { id: 'article', name: 'Article', desc: 'Paper or report with sections, math and references', body:
`\\documentclass[11pt, a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{amsmath, amssymb, amsthm}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{hyperref}

\\title{Untitled Article}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
A short summary of the work.
\\end{abstract}

\\section{Introduction}
\\label{sec:intro}

Start writing here. Inline math looks like $e^{i\\pi} + 1 = 0$, and displayed math like
\\begin{equation}
  \\int_{-\\infty}^{\\infty} e^{-x^2}\\,\\mathrm{d}x = \\sqrt{\\pi}.
  \\label{eq:gauss}
\\end{equation}

Equation~\\eqref{eq:gauss} is the Gaussian integral.

\\section{Conclusion}

\\end{document}
` },
  { id: 'report', name: 'Report', desc: 'Longer document with chapters and a table of contents', body:
`\\documentclass[11pt, a4paper]{report}

\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{amsmath, amssymb}
\\usepackage{graphicx}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{hyperref}

\\title{Untitled Report}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents

\\chapter{Introduction}
\\label{chap:intro}

Start writing here.

\\chapter{Results}

\\end{document}
` },
  { id: 'beamer', name: 'Presentation', desc: 'Beamer slides with a title frame', body:
`\\documentclass{beamer}

\\usetheme{metropolis}
\\usepackage{amsmath}

\\title{Untitled Presentation}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{frame}{Outline}
  \\tableofcontents
\\end{frame}

\\section{Introduction}

\\begin{frame}{First slide}
  \\begin{itemize}
    \\item<1-> A first point
    \\item<2-> A second point
  \\end{itemize}
\\end{frame}

\\end{document}
` },
  { id: 'letter', name: 'Letter', desc: 'Formal letter', body:
`\\documentclass[11pt]{letter}

\\usepackage[T1]{fontenc}
\\usepackage{lmodern}

\\signature{Your Name}
\\address{Street 1 \\\\ City}

\\begin{document}

\\begin{letter}{Recipient \\\\ Their Street \\\\ Their City}
\\opening{Dear Sir or Madam,}

Write your letter here.

\\closing{Yours faithfully,}
\\end{letter}

\\end{document}
` },
  { id: 'blank', name: 'Blank', desc: 'Just the essentials', body:
`\\documentclass{article}

\\begin{document}

Hello, \\LaTeX!

\\end{document}
` },
]
