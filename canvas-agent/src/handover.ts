import type { CanvasNode } from './ai'
import type { DesignSystem } from './lab'
import { componentSpec, getLibrary, type ComponentSpec, type LibraryId } from './realui/catalog'

/* ================================================================== *
 *  Handover — everything a developer needs from a finished design:
 *    - code: a React + Tailwind component, or a standalone HTML file
 *    - inspect: Tailwind classes grouped by purpose, plus the REAL
 *      computed values (px sizes, hex colors, fonts) read off the DOM
 *    - tokens: the palette, type scale, spacing and radii the page uses
 *    - style-template export: CSS variables / Tailwind @theme
 * ================================================================== */

/* ------------------------------------------------------------------ *
 *  Small utilities
 * ------------------------------------------------------------------ */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Downloads a text file. Runs from a click handler, so the browser allows it. */
export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

/** "Frame · crypto-dashboard" → "CryptoDashboard" */
export function componentName(frameLabel: string): string {
  const slug = frameLabel.split('·').pop() ?? frameLabel
  const name = slug
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
  return /^[A-Za-z]/.test(name) ? name : 'GeneratedPage'
}

/* ------------------------------------------------------------------ *
 *  Code generation
 * ------------------------------------------------------------------ */

/** The artboard is a fixed 1200px in the editor; shipped code should be fluid. */
function fluid(classes: string): string {
  return classes
    .replace(/(^|\s)w-\[1200px\](?=\s|$)/, '$1w-full max-w-[1200px] mx-auto')
    .replace(/(^|\s)(?:shadcn-scope|relume-scope|dark)(?=\s|$)/g, ' ') // the editor's theme scope is not part of the design
    .replace(/\s+/g, ' ')
    .trim()
}

interface EmitCtx {
  lang: 'jsx' | 'html'
  seenH1: boolean
  /** Real component library of this design, if any. */
  library: LibraryId | null
  /** Catalog entries and icon names the emitted code uses (for the import block). */
  used: Map<string, ComponentSpec>
  icons: Set<string>
}

const newCtx = (lang: EmitCtx['lang'], library: LibraryId | null, seenH1 = false): EmitCtx => ({ lang, seenH1, library, used: new Map(), icons: new Set() })

function tagFor(node: CanvasNode, depth: number, ctx: EmitCtx): string {
  switch (node.type) {
    case 'button':
      return 'button'
    case 'image':
      return 'div'
    case 'text': {
      const size = /(?:^|\s)text-(\d)xl(?=\s|$)/.exec(node.classes)
      const big = size ? Number(size[1]) : 0
      const bold = /(?:^|\s)font-(semibold|bold|extrabold|black)(?=\s|$)/.test(node.classes)
      if (big >= 4 && !ctx.seenH1) {
        ctx.seenH1 = true
        return 'h1'
      }
      if (big >= 2) return 'h2'
      if (bold && /(?:^|\s)text-(lg|xl)(?=\s|$)/.test(node.classes)) return 'h3'
      return 'p'
    }
    default: {
      if (depth === 1) {
        if (/\bnav/i.test(node.label)) return 'nav'
        if (/\bfooter\b/i.test(node.label)) return 'footer'
        if (/\bheader\b|\btop ?bar\b/i.test(node.label)) return 'header'
        return 'section'
      }
      return 'div'
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

function textOut(content: string, lang: 'jsx' | 'html') {
  if (lang === 'html') return escapeHtml(content)
  return /[{}<>]/.test(content) ? `{${JSON.stringify(content)}}` : content
}

/** One prop as JSX: strings quoted, numbers and booleans in braces / bare. */
function propAttr(key: string, value: string | number | boolean): string {
  if (typeof value === 'string') return `${key}="${escapeAttr(value)}"`
  if (typeof value === 'number') return `${key}={${value}}`
  return value ? key : `${key}={false}`
}

/** A real library component, as JSX with its real props. */
function emitComponent(node: CanvasNode, depth: number, indent: string, ctx: EmitCtx): string {
  const spec = componentSpec(ctx.library!, node.component)
  if (!spec) return `${indent}{/* unknown component ${node.component} */}`
  const isIcon = spec.name === 'Icon'
  const tag = isIcon ? String(node.props?.name ?? 'Circle') : spec.name
  if (isIcon) ctx.icons.add(tag)
  else ctx.used.set(spec.name, spec)
  const attrs = Object.entries({ ...spec.fixed, ...(isIcon ? {} : node.props) }).map(([k, v]) => propAttr(k, v))
  if (node.classes) attrs.push(`className="${escapeAttr(node.classes)}"`)
  const open = `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}`
  const comment = depth === 1 ? `${indent}{/* ${node.label} */}\n` : ''
  const text = (spec.takes === 'text' || spec.takes === 'both') && node.content ? textOut(node.content, 'jsx') : ''
  const kids = (spec.takes === 'children' || spec.takes === 'both' ? (node.children ?? []) : []).map((c) => emit(c, depth + 1, indent + '  ', ctx, false))
  if (!text && kids.length === 0) return `${comment}${indent}${open} />`
  if (kids.length === 0) return `${comment}${indent}${open}>${text}</${tag}>`
  return `${comment}${indent}${open}>\n${text ? `${indent}  ${text}\n` : ''}${kids.join('\n')}\n${indent}</${tag}>`
}

function emit(node: CanvasNode, depth: number, indent: string, ctx: EmitCtx, isRoot: boolean): string {
  if (node.type === 'component' && ctx.library) return emitComponent(node, depth, indent, ctx)
  const tag = tagFor(node, depth, ctx)
  const classes = isRoot ? fluid(node.classes) : node.classes
  const cls = ctx.lang === 'jsx' ? 'className' : 'class'
  const attrs: string[] = [`${cls}="${escapeAttr(classes)}"`]
  if (node.type === 'button') attrs.push('type="button"')
  if (node.type === 'image') attrs.push('role="img"', `aria-label="${escapeAttr(node.label)}"`)
  const open = `<${tag} ${attrs.join(' ')}>`
  const comment = depth === 1 ? `${indent}${ctx.lang === 'jsx' ? `{/* ${node.label} */}` : `<!-- ${node.label} -->`}\n` : ''

  if (node.type === 'image') return `${comment}${indent}${open}</${tag}>`
  if (node.type === 'text' || node.type === 'button') {
    return `${comment}${indent}${open}${textOut(node.content ?? '', ctx.lang)}</${tag}>`
  }
  const kids = (node.children ?? []).map((c) => emit(c, depth + 1, indent + '  ', ctx, false))
  if (kids.length === 0) return `${comment}${indent}${open}</${tag}>`
  return `${comment}${indent}${open}\n${kids.join('\n')}\n${indent}</${tag}>`
}

/** The import block and setup comments for a design that uses real components. */
function libraryHeader(ctx: EmitCtx): string {
  const lib = getLibrary(ctx.library)
  if (!lib) return ''
  const specs = [...ctx.used.values()]
  const byModule = new Map<string, string[]>()
  for (const c of specs) byModule.set(c.module, [...(byModule.get(c.module) ?? []), c.name])
  if (ctx.icons.size) byModule.set('lucide-react', [...ctx.icons])
  const imports = [...byModule].map(([mod, names]) => `import { ${[...new Set(names)].sort().join(', ')} } from "${mod}"`)
  const notes = lib.setupNotes([...specs, ...(ctx.icons.size ? [{ name: 'Icon' } as ComponentSpec] : [])]).map((l) => `// ${l}`)
  return `${notes.join('\n')}\n${imports.join('\n')}\n\n`
}

/** A React + Tailwind component for the whole page (real library imports when the design uses them). */
export function toReact(root: CanvasNode): string {
  const ctx = newCtx('jsx', root.library ?? null)
  const name = componentName(root.label)
  const body = emit(root, 0, '    ', ctx, true) // emit first: it collects what the import block needs
  const header = ctx.library ? libraryHeader(ctx) : '// Needs Tailwind CSS (v4, or v3 with these utilities).\n'
  return `// Generated by Canvas Agent.\n${header}export default function ${name}() {
  return (
${body}
  )
}
`
}

/** A JSX snippet for one node and everything inside it. */
export function toSnippet(node: CanvasNode, library: LibraryId | null = null): string {
  return emit(node, 2, '', newCtx('jsx', library, true), false)
}

/** A standalone HTML page that renders by itself (Tailwind Play CDN). Not available for real-component designs. */
export function toHtml(root: CanvasNode): string {
  const ctx = newCtx('html', null)
  const title = componentName(root.label).replace(/([a-z])([A-Z])/g, '$1 $2')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <!-- Tailwind Play CDN: fine for previews. For production, build with Tailwind CSS instead. -->
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="min-h-screen bg-zinc-100 p-6">
${emit(root, 0, '    ', ctx, true)}
  </body>
</html>
`
}

/* ------------------------------------------------------------------ *
 *  Tailwind classes, grouped by purpose
 * ------------------------------------------------------------------ */

export const CLASS_GROUPS = ['Layout', 'Size', 'Spacing', 'Typography', 'Color', 'Border & effects', 'Other'] as const
export type ClassGroup = (typeof CLASS_GROUPS)[number]

const GROUP_RULES: Array<[ClassGroup, RegExp]> = [
  ['Typography', /^(text-(xs|sm|base|lg|[2-9]?xl|left|center|right|justify|\[\d)|font-|leading-|tracking-|uppercase$|lowercase$|capitalize$|italic$|underline$|truncate$|whitespace-|break-|line-clamp)/],
  ['Size', /^(w-|h-|min-w-|max-w-|min-h-|max-h-|size-|aspect-|basis-)/],
  ['Spacing', /^(-?[pm][xytblrse]?-|gap-|space-[xy]-)/],
  ['Border & effects', /^(border(-[xytblrse])?(-\d+)?$|rounded|shadow(-(sm|md|lg|xl|2xl|inner|none))?$|ring(-\d+)?$|opacity-|blur|backdrop-|mix-blend|outline(-\d+)?$)/],
  ['Layout', /^(flex|grid|block$|inline|hidden$|relative$|absolute$|fixed$|sticky$|items-|justify-|self-|place-|content-|col-|row-|order-|overflow-|z-|inset-|top-|left-|right-|bottom-|object-|shrink|grow)/],
  ['Color', /^(bg-|text-|from-|via-|to-|border-|fill-|stroke-|ring-|divide-|accent-|caret-|placeholder-|outline-|shadow-)/],
]

export function groupClasses(classes: string): Array<{ group: ClassGroup; items: string[] }> {
  const buckets = new Map<ClassGroup, string[]>()
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const bare = token.replace(/^(?:[\w-]+:)+/, '') // strip hover:, md:, …
    const group = GROUP_RULES.find(([, re]) => re.test(bare))?.[0] ?? 'Other'
    buckets.set(group, [...(buckets.get(group) ?? []), token])
  }
  return CLASS_GROUPS.filter((g) => buckets.has(g)).map((group) => ({ group, items: buckets.get(group)! }))
}

/* ------------------------------------------------------------------ *
 *  Real values, read off the rendered DOM (Figma "inspect" style)
 * ------------------------------------------------------------------ */

let colorCtx: CanvasRenderingContext2D | null | undefined

/** Any CSS color (rgb, oklch, …) → #rrggbb / #rrggbbaa. Null when transparent. */
export function toHex(css: string): string | null {
  if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return null
  if (colorCtx === undefined) colorCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!colorCtx) return null
  colorCtx.clearRect(0, 0, 1, 1)
  colorCtx.fillStyle = '#000'
  colorCtx.fillStyle = css
  colorCtx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data
  if (a === 0) return null
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}${a < 255 ? h(a) : ''}`
}

const px = (v: string) => Math.round(parseFloat(v) * 100) / 100
/** Zero, empty, or not a length at all (computed `gap` is the word "normal" on block boxes). */
const isZero = (v: string) => !(Math.abs(parseFloat(v)) > 0)

/** "24px 32px 24px 32px" → "24 32" */
function boxValues(top: string, right: string, bottom: string, left: string): string {
  const [t, r, b, l] = [top, right, bottom, left].map(px)
  if (t === r && r === b && b === l) return `${t}`
  if (t === b && r === l) return `${t} ${r}`
  return `${t} ${r} ${b} ${l}`
}

/**
 * Tailwind sets several fully transparent shadow layers (ring, inset, …) on every
 * element. Drop them, so only a shadow you can actually see is reported.
 */
function visibleShadow(value: string): string {
  if (value === 'none') return ''
  const layers: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i <= value.length; i++) {
    const ch = value[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if ((ch === ',' && depth === 0) || i === value.length) {
      layers.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  return layers.filter((l) => l && !/^rgba\(0, 0, 0, 0\)/.test(l) && !/^transparent/.test(l)).join(', ')
}

export interface SpecRow {
  label: string
  value: string
  /** Set for color values so the UI can draw a swatch. */
  swatch?: string
}

export interface ElementSpec {
  sections: Array<{ title: string; rows: SpecRow[] }>
  css: string
}

/**
 * The editor draws selection / hover / "agent is building" outlines with ring-*
 * classes. They are not part of the design, so take off any ring class the node
 * did not declare itself while values are read. Returns the undo function.
 */
function hideEditorRings(el: HTMLElement, declared: string): () => void {
  const own = new Set(declared.split(/\s+/))
  const added = [...el.classList].filter((c) => c.startsWith('ring-') && !own.has(c))
  if (added.length === 0) return () => {}
  el.classList.remove(...added)
  return () => el.classList.add(...added)
}

export function readSpec(el: HTMLElement, declaredClasses: string): ElementSpec {
  const restore = hideEditorRings(el, declaredClasses)
  try {
    return readSpecNow(el)
  } finally {
    restore()
  }
}

function readSpecNow(el: HTMLElement): ElementSpec {
  const cs = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  const sections: ElementSpec['sections'] = []
  const cssLines: string[] = []
  const add = (prop: string, value: string) => cssLines.push(`  ${prop}: ${value};`)

  const size: SpecRow[] = [{ label: 'Size', value: `${Math.round(rect.width)} × ${Math.round(rect.height)} px` }]
  sections.push({ title: 'Frame', rows: size })

  const layout: SpecRow[] = []
  layout.push({ label: 'Display', value: cs.display })
  add('display', cs.display)
  if (cs.display.includes('flex')) {
    layout.push({ label: 'Direction', value: cs.flexDirection })
    add('flex-direction', cs.flexDirection)
  }
  if (cs.display.includes('flex') || cs.display.includes('grid')) {
    if (!isZero(cs.rowGap) || !isZero(cs.columnGap)) {
      const gap = cs.rowGap === cs.columnGap ? `${px(cs.rowGap)}` : `${px(cs.rowGap)} ${px(cs.columnGap)}`
      layout.push({ label: 'Gap', value: `${gap} px` })
      add('gap', gap.split(' ').map((n) => `${n}px`).join(' '))
    }
    if (cs.alignItems !== 'normal') layout.push({ label: 'Align', value: cs.alignItems })
    if (cs.justifyContent !== 'normal') layout.push({ label: 'Justify', value: cs.justifyContent })
  }
  if (cs.display.includes('grid') && cs.gridTemplateColumns !== 'none') {
    layout.push({ label: 'Columns', value: `${cs.gridTemplateColumns.split(' ').length}` })
    add('grid-template-columns', cs.gridTemplateColumns)
  }
  sections.push({ title: 'Layout', rows: layout })

  const spacing: SpecRow[] = []
  const pad = boxValues(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft)
  if (pad !== '0') {
    spacing.push({ label: 'Padding', value: `${pad} px` })
    add('padding', pad.split(' ').map((n) => `${n}px`).join(' '))
  }
  const mar = boxValues(cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft)
  if (mar !== '0') {
    spacing.push({ label: 'Margin', value: `${mar} px` })
    add('margin', mar.split(' ').map((n) => `${n}px`).join(' '))
  }
  if (spacing.length) sections.push({ title: 'Spacing', rows: spacing })

  const hasOwnText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())
  if (hasOwnText) {
    const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()
    const color = toHex(cs.color)
    const type: SpecRow[] = [
      { label: 'Font', value: family },
      { label: 'Size', value: `${px(cs.fontSize)} px` },
      { label: 'Weight', value: cs.fontWeight },
      { label: 'Line height', value: cs.lineHeight === 'normal' ? 'normal' : `${px(cs.lineHeight)} px` },
    ]
    if (cs.letterSpacing !== 'normal' && !isZero(cs.letterSpacing)) type.push({ label: 'Tracking', value: `${px(cs.letterSpacing)} px` })
    if (cs.textAlign !== 'start' && cs.textAlign !== 'left') type.push({ label: 'Align', value: cs.textAlign })
    if (color) type.push({ label: 'Color', value: color, swatch: color })
    sections.push({ title: 'Typography', rows: type })
    add('font-family', cs.fontFamily)
    add('font-size', `${px(cs.fontSize)}px`)
    add('font-weight', cs.fontWeight)
    if (cs.lineHeight !== 'normal') add('line-height', `${px(cs.lineHeight)}px`)
    if (color) add('color', color)
  }

  const fill: SpecRow[] = []
  const bg = toHex(cs.backgroundColor)
  if (bg) {
    fill.push({ label: 'Fill', value: bg, swatch: bg })
    add('background-color', bg)
  }
  if (cs.backgroundImage !== 'none') {
    fill.push({ label: 'Gradient', value: cs.backgroundImage.length > 90 ? `${cs.backgroundImage.slice(0, 90)}…` : cs.backgroundImage })
    add('background-image', cs.backgroundImage)
  }
  if (cs.opacity !== '1') fill.push({ label: 'Opacity', value: `${Math.round(parseFloat(cs.opacity) * 100)}%` })
  if (fill.length) sections.push({ title: 'Fill', rows: fill })

  const stroke: SpecRow[] = []
  if (!isZero(cs.borderTopWidth)) {
    const bc = toHex(cs.borderTopColor)
    stroke.push({ label: 'Border', value: `${px(cs.borderTopWidth)} px ${cs.borderTopStyle}${bc ? ` ${bc}` : ''}`, swatch: bc ?? undefined })
    add('border', `${px(cs.borderTopWidth)}px ${cs.borderTopStyle} ${bc ?? 'currentColor'}`)
  }
  if (!isZero(cs.borderTopLeftRadius)) {
    const r = boxValues(cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius)
    stroke.push({ label: 'Radius', value: `${r} px` })
    add('border-radius', r.split(' ').map((n) => `${n}px`).join(' '))
  }
  const shadow = visibleShadow(cs.boxShadow)
  if (shadow) {
    stroke.push({ label: 'Shadow', value: shadow.length > 90 ? `${shadow.slice(0, 90)}…` : shadow })
    add('box-shadow', shadow)
  }
  if (stroke.length) sections.push({ title: 'Border & effects', rows: stroke })

  return { sections, css: `.${kebab(el.dataset.nodeId ?? 'element')} {\n${cssLines.join('\n')}\n}` }
}

/* ------------------------------------------------------------------ *
 *  Page-wide tokens: what the design actually uses
 * ------------------------------------------------------------------ */

export interface UsedColor {
  hex: string
  /** Tailwind color name when a class gave it (e.g. slate-950). */
  name?: string
  count: number
}

export interface PageTokens {
  colors: UsedColor[]
  fonts: Array<{ family: string; count: number }>
  type: Array<{ size: number; weight: string; lineHeight: string; count: number }>
  spacing: Array<{ px: number; count: number }>
  radii: Array<{ px: number; count: number }>
  shadows: Array<{ value: string; count: number }>
}

const COLOR_CLASS = /^(?:bg|text|border|from|via|to)-((?:[a-z]+-\d{2,3})|white|black|background|foreground|card|muted|muted-foreground|primary|primary-foreground|secondary|secondary-foreground|accent|destructive|border|input|background-(?:primary|secondary|tertiary|alternative|success|error)|text-(?:primary|secondary|alternative|success|error)|border-(?:primary|secondary|tertiary|alternative|success|error))$/

export function collectTokens(root: HTMLElement, tree: CanvasNode): PageTokens {
  const declared = new Map<string, string>()
  const walk = (n: CanvasNode) => {
    declared.set(n.id, n.classes)
    n.children?.forEach(walk)
  }
  walk(tree)
  const colors = new Map<string, UsedColor>()
  const fonts = new Map<string, number>()
  const type = new Map<string, { size: number; weight: string; lineHeight: string; count: number }>()
  const spacing = new Map<number, number>()
  const radii = new Map<number, number>()
  const shadows = new Map<string, number>()

  const bump = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1)
  const addColor = (css: string, el: HTMLElement, prefix: string) => {
    const hex = toHex(css)
    if (!hex) return
    const named = [...el.classList].map((c) => c.replace(/^(?:[\w-]+:)+/, '')).find((c) => c.startsWith(`${prefix}-`) && COLOR_CLASS.test(c))
    const entry = colors.get(hex) ?? { hex, name: named ? COLOR_CLASS.exec(named)![1] : undefined, count: 0 }
    entry.count++
    if (!entry.name && named) entry.name = COLOR_CLASS.exec(named)![1]
    colors.set(hex, entry)
  }

  const els = [root, ...root.querySelectorAll<HTMLElement>('[data-node-id]')]
  for (const el of els) {
    const restore = hideEditorRings(el, declared.get(el.dataset.nodeId ?? '') ?? '')
    const cs = getComputedStyle(el)
    addColor(cs.backgroundColor, el, 'bg')
    if (!isZero(cs.borderTopWidth)) addColor(cs.borderTopColor, el, 'border')
    if ([...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())) {
      addColor(cs.color, el, 'text')
      bump(fonts, cs.fontFamily.split(',')[0].replace(/["']/g, '').trim())
      const lh = cs.lineHeight === 'normal' ? 'normal' : `${px(cs.lineHeight)}`
      const key = `${px(cs.fontSize)}|${cs.fontWeight}|${lh}`
      const t = type.get(key) ?? { size: px(cs.fontSize), weight: cs.fontWeight, lineHeight: lh, count: 0 }
      t.count++
      type.set(key, t)
    }
    for (const side of [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft, cs.rowGap, cs.columnGap]) {
      if (!isZero(side)) bump(spacing, px(side))
    }
    if (!isZero(cs.borderTopLeftRadius)) bump(radii, px(cs.borderTopLeftRadius))
    const shadow = visibleShadow(cs.boxShadow)
    if (shadow) bump(shadows, shadow)
    restore()
  }

  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count
  return {
    colors: [...colors.values()].sort(byCount),
    fonts: [...fonts].map(([family, count]) => ({ family, count })).sort(byCount),
    type: [...type.values()].sort((a, b) => b.size - a.size),
    spacing: [...spacing].map(([p, count]) => ({ px: p, count })).sort((a, b) => a.px - b.px),
    radii: [...radii].map(([p, count]) => ({ px: p, count })).sort((a, b) => a.px - b.px),
    shadows: [...shadows].map(([value, count]) => ({ value, count })).sort(byCount),
  }
}

/** The page's tokens as CSS custom properties. */
export function pageTokensToCss(t: PageTokens): string {
  const lines: string[] = []
  t.colors.forEach((c, i) => lines.push(`  --color-${c.name ?? i + 1}: ${c.hex};`))
  t.fonts.forEach((f, i) => lines.push(`  --font-${i + 1}: "${f.family}";`))
  t.type.forEach((s) => lines.push(`  --text-${s.size}: ${s.size}px; /* weight ${s.weight}, line-height ${s.lineHeight === 'normal' ? 'normal' : `${s.lineHeight}px`} */`))
  t.spacing.forEach((s) => lines.push(`  --space-${s.px}: ${s.px}px;`))
  t.radii.forEach((r) => lines.push(`  --radius-${r.px}: ${r.px}px;`))
  return `:root {\n${lines.join('\n')}\n}\n`
}

/* ------------------------------------------------------------------ *
 *  Style template export (from a generated / saved design system)
 * ------------------------------------------------------------------ */

/** A design system's tokens as CSS custom properties. */
export function systemToCss(system: DesignSystem): string {
  const { color, font, type, space, radius, shadow } = system.tokens
  const lines: string[] = []
  for (const [k, v] of Object.entries(color)) lines.push(`  --color-${kebab(k)}: ${v};`)
  for (const [k, v] of Object.entries(font)) lines.push(`  --font-${kebab(k)}: ${v};`)
  for (const [k, s] of Object.entries(type)) {
    lines.push(`  --text-${kebab(k)}: ${s.size};`)
    lines.push(`  --text-${kebab(k)}-weight: ${s.weight};`)
    lines.push(`  --text-${kebab(k)}-line-height: ${s.lineHeight};`)
    if (s.letterSpacing) lines.push(`  --text-${kebab(k)}-tracking: ${s.letterSpacing};`)
  }
  for (const [k, v] of Object.entries(space)) lines.push(`  --space-${kebab(k)}: ${v};`)
  for (const [k, v] of Object.entries(radius)) lines.push(`  --radius-${kebab(k)}: ${v};`)
  for (const [k, v] of Object.entries(shadow)) lines.push(`  --shadow-${kebab(k)}: ${v};`)
  return `/* ${system.name} */\n:root {\n${lines.join('\n')}\n}\n`
}

/** A design system's tokens as a Tailwind CSS v4 @theme block. */
export function systemToTailwindTheme(system: DesignSystem): string {
  const { color, font, type, space, radius, shadow } = system.tokens
  const lines: string[] = []
  for (const [k, v] of Object.entries(color)) lines.push(`  --color-${kebab(k)}: ${v};`)
  for (const [k, v] of Object.entries(font)) lines.push(`  --font-${kebab(k)}: ${v};`)
  for (const [k, s] of Object.entries(type)) {
    lines.push(`  --text-${kebab(k)}: ${s.size};`)
    lines.push(`  --text-${kebab(k)}--line-height: ${s.lineHeight};`)
    lines.push(`  --text-${kebab(k)}--font-weight: ${s.weight};`)
    if (s.letterSpacing) lines.push(`  --text-${kebab(k)}--letter-spacing: ${s.letterSpacing};`)
  }
  for (const [k, v] of Object.entries(space)) lines.push(`  --spacing-${kebab(k)}: ${v};`)
  for (const [k, v] of Object.entries(radius)) lines.push(`  --radius-${kebab(k)}: ${v};`)
  for (const [k, v] of Object.entries(shadow)) lines.push(`  --shadow-${kebab(k)}: ${v};`)
  return `/* ${system.name} — paste into your main CSS file (Tailwind CSS v4) */\n@import "tailwindcss";\n\n@theme {\n${lines.join('\n')}\n}\n`
}
