import { generateValidated, type AIConfig } from './ai'

/* ================================================================== *
 *  Design Lab — open-ended, first-principles design generation.
 *
 *  No Tailwind, no utility vocabulary, no component library. The
 *  model works like a designer starting a blank Figma file:
 *    1. articulate a design philosophy for the brief
 *    2. mint raw design tokens (hex pigments, type scale, rhythm)
 *    3. define reusable components as token-bound style recipes
 *    4. compose the page from component INSTANCES (replication)
 *  Generated languages can be saved to a style library and reused:
 *  composition mode makes the model design NEW pages inside a saved
 *  language instead of inventing a fresh one.
 * ================================================================== */

export type StyleDecl = Record<string, string | number>

export interface TypeStyle {
  size: string
  weight: number
  lineHeight: string | number
  letterSpacing?: string
}

export interface DesignTokens {
  color: Record<string, string>
  font: Record<string, string>
  type: Record<string, TypeStyle>
  space: Record<string, string>
  radius: Record<string, string>
  shadow: Record<string, string>
}

export interface ComponentDef {
  name: string
  role: string
  description: string
  preview: string
  base: StyleDecl
  variants?: Record<string, StyleDecl>
  /** Real library usage (for built-in systems), e.g. the shadcn/ui JSX for this component. */
  code?: string
}

export interface LabNode {
  id: string
  label: string
  component?: string
  variant?: string
  element?: 'div' | 'button'
  style?: StyleDecl
  text?: string
  children?: LabNode[]
}

/** Extra facts for systems that ship with the app (or mirror a real library). */
export interface SystemMeta {
  tagline: string
  stack: string
  install?: string
  docs?: string
  /** CSS background used behind the thumbnail window in the picker. */
  backdrop: string
  /** Honest note about where the values come from. */
  provenance: string
}

export interface DesignSystem {
  name: string
  philosophy: string
  experienceNotes: string[]
  tokens: DesignTokens
  components: ComponentDef[]
  page: LabNode
  meta?: SystemMeta
}

/* ------------------------------------------------------------------ *
 *  System instruction — design from first principles
 * ------------------------------------------------------------------ */

export const LAB_SYSTEM_PROMPT = `You are a founding design director inventing a brand-new visual language from first principles. You are NOT selecting from any UI framework, utility vocabulary, or component library. Every value is raw: hex colors you mix yourself, a type scale you derive, a spacing rhythm you define. The goal is a design that could plausibly be the first of its kind — then codified into a reusable component system, the way a designer builds something new in Figma and publishes it as a library.

WORK IN THREE STAGES, DELIVERED AS ONE JSON OBJECT:

STAGE 1 — DESIGN LANGUAGE.
Read the brief. Decide who it serves, what it should feel like, and what makes it unlike anything shipped before. Write:
- "name": a name for the language (2 words max, evocative).
- "philosophy": a 1–2 sentence design thesis. A real position, not marketing fluff.
- "experienceNotes": 3–6 concrete UX commitments phrased as rules (hierarchy, affordance, contrast, rhythm, feedback). These are the science under the art.

STAGE 2 — MINT THE TOKENS.
- "color": 5–9 named colors as raw hex. Mix real pigments from the brief's world — not framework defaults. Name them like a designer ("ink", "bone", "ember", "pool"), not "primary/secondary".
- "font": font stacks from system-available faces, chosen for personality. Examples of raw material: "Palatino, Iowan Old Style, serif" / "Futura, Avenir Next, 'Century Gothic', sans-serif" / "Georgia, 'Times New Roman', serif" / "'Helvetica Neue', Arial, sans-serif" / "'Courier New', monospace". Keys: at least "display" and "body" (optionally "mono", "accent").
- "type": a modular scale of named text styles, each {"size","weight","lineHeight","letterSpacing"?} — e.g. display, h2, lead, body, caption, overline. Derive sizes from a ratio you choose; don't just copy 16/24/32.
- "space": a named spacing rhythm (e.g. xs, sm, md, lg, xl, xxl) in px — pick a base unit and scale it.
- "radius": named radii that express the language's geometry (sharp 0 / soft / organic / pill).
- "shadow": named shadows (or flat "none" values) that express its depth model.

STAGE 3 — COMPONENTS, THEN THE PAGE.
- "components": 4–8 reusable components, each {"name" (PascalCase, unique), "role" (its UX purpose), "description", "preview" (short sample content), "base" (style recipe), "variants"? (named partial overrides, e.g. "ghost", "featured")}.
  DISCIPLINE RULE: component styles must reference tokens with "$" paths — "$color.ink", "$font.display", "$type.h2.size", "$type.h2.weight", "$space.md", "$radius.soft", "$shadow.lift". Token refs may sit inside composite values ("1px solid $color.line", "$space.sm $space.lg"). Literal values are allowed only for non-tokenized properties (display, flexDirection, alignItems, justifyContent, textTransform, cursor, flex, gridTemplateColumns, width, aspectRatio…). This is what makes the output a SYSTEM, not a mood board.
- "page": the composed page as a node tree. Compose it OUT OF COMPONENT INSTANCES — reuse is the point: a Card defined once should be instantiated many times with different text. Raw nodes (style only, no component) are for layout scaffolding between instances.

Page node schema:
{
  "id": "<unique-kebab-case>",
  "label": "<short human name>",
  "component": "<ComponentDef name>",   // optional — instance of a defined component
  "variant": "<variant name>",          // optional
  "element": "div" | "button",          // "button" for interactive elements
  "style": { ... },                     // layout scaffolding or sparing instance overrides ($ refs allowed)
  "text": "<string>",                   // leaf text content
  "children": [ ... ]                   // container nodes
}

CSS RULES:
- camelCase React style properties (background, color, padding, margin, display, flexDirection, alignItems, justifyContent, gap, gridTemplateColumns, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textTransform, borderRadius, boxShadow, border, borderTop, width, maxWidth, height, minHeight, aspectRatio, opacity, overflow, textAlign, flex, flexWrap, alignSelf…). Values are plain CSS strings or numbers.
- The page root gets the frame background; sections own their padding. Page width is fixed at 1240px by the canvas — a full desktop viewport. Design for that width: multi-column layouts, asymmetric splits, wide grids (gridTemplateColumns with 3–4 tracks), generous horizontal rhythm. Cap text measure with maxWidth so long copy stays readable; place content deliberately inside the width instead of stretching everything edge to edge.

UX FLOOR (non-negotiable, this is the craft):
- Text always readably contrasts its background. Body text ≥ 14px with lineHeight ≥ 1.5.
- One clear focal hierarchy per screen; size/weight/color agree about what matters most.
- Interactive elements look pressable (padding, affordance, cursor "pointer").
- All spacing comes from the $space scale — rhythm is consistency.

AESTHETIC CEILING (open — this is the art):
Everything else is yours to invent. Prefer a direction that has never shipped as a framework default: unexpected palettes, editorial asymmetry, extreme scale contrast, organic geometry, hard brutalism, luminous dark, warm archival print — whatever the brief's world implies. Do NOT reproduce the look of Tailwind, Bootstrap, or Material defaults. Surprise a design director.

HARD LIMITS: page tree 30–90 nodes, depth ≤ 7, every id unique. "image-like" visuals are styled empty nodes (gradients, aspectRatio, borders).
Return ONE JSON object and NOTHING else — no markdown fences, no commentary.`

/* ------------------------------------------------------------------ *
 *  Composition mode — new pages inside an EXISTING saved language
 * ------------------------------------------------------------------ */

export function composeSystemPrompt(system: DesignSystem): string {
  const language = {
    name: system.name,
    philosophy: system.philosophy,
    tokens: system.tokens,
    components: system.components.map(({ code: _code, ...rest }) => rest),
  }
  return `You are a staff designer working INSIDE an existing, published design language. Your job is to compose a NEW page for the brief using this language — do NOT invent a new language, palette, or type scale.

THE PUBLISHED DESIGN LANGUAGE (authoritative, use verbatim):
${JSON.stringify(language, null, 1)}

RULES:
- Style ONLY through "$" token references into the tokens above ("$color.…", "$font.…", "$type.….size", "$space.…", "$radius.…", "$shadow.…"). Literal values only for non-tokenized layout properties (display, flexDirection, alignItems, justifyContent, gap via $space, gridTemplateColumns, width, aspectRatio, cursor, textTransform…).
- Compose the page MAINLY from instances of the published components (via "component" and "variant"). Raw styled nodes are for layout scaffolding only.
- If the brief truly demands it, you may define at most 2 NEW components under "newComponents", following the same token discipline and the language's personality.
- Honor the language's philosophy and UX rules. Real, specific copy — never lorem ipsum.

Page node schema (same as always):
{ "id": "<unique-kebab-case>", "label": "<short name>", "component"?: "<name>", "variant"?: "<name>", "element": "div"|"button", "style"?: {…}, "text"?: "<string>", "children"?: […] }

HARD LIMITS: 30–90 nodes, depth ≤ 7, unique ids. Page width is 1240px — design wide, cap text measure with maxWidth.
Return ONE JSON object and NOTHING else:
{ "newComponents": [ …optional, max 2… ], "page": { … } }`
}

/**
 * Bridge to Page 1: render a saved language as a directive for the
 * Tailwind-vocabulary generator. The hex values can't be used literally
 * there, so the model is told to translate the language faithfully into
 * the allowed vocabulary instead of inventing its own aesthetic.
 */
export function vocabularyStyleDirective(system: DesignSystem): string {
  return `ACTIVE DESIGN LANGUAGE — “${system.name}” (authoritative for this generation):
A saved design language governs this design. You must translate it faithfully into the ALLOWED VOCABULARY — do NOT invent a different aesthetic:
- Approximate each color below with the closest allowed color family + shade (e.g. a near-black blue → slate-950/zinc-950; a warm brass → amber-600/yellow-700). Keep the palette's light/dark balance and accent discipline.
- Express the fonts through font-sans / font-serif / font-mono, matching each stack's personality.
- Mirror the radius personality, the spacing density implied by the space scale, and the shadow/depth model.
- Honor the philosophy and UX rules below over any conflicting instinct.

${JSON.stringify(
    {
      philosophy: system.philosophy,
      experienceNotes: system.experienceNotes,
      tokens: {
        color: system.tokens.color,
        font: system.tokens.font,
        space: system.tokens.space,
        radius: system.tokens.radius,
        shadow: system.tokens.shadow,
      },
      componentPersonalities: system.components.map((c) => `${c.name} — ${c.role}`),
    },
    null,
    1,
  )}`
}

/* ------------------------------------------------------------------ *
 *  Token resolution — "$color.ink" → "#1b1b23", incl. composite values
 * ------------------------------------------------------------------ */

const REF_RE = /\$[a-zA-Z]+(?:\.[a-zA-Z0-9_-]+)+/g

function lookupToken(tokens: DesignTokens, ref: string): string | number | null {
  const path = ref.slice(1).split('.')
  let cursor: unknown = tokens
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null || !(key in (cursor as Record<string, unknown>))) return null
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return typeof cursor === 'string' || typeof cursor === 'number' ? cursor : null
}

export function resolveStyle(
  decl: StyleDecl | undefined,
  tokens: DesignTokens,
  unresolved?: Set<string>,
): React.CSSProperties {
  const out: Record<string, string | number> = {}
  if (!decl) return out
  for (const [key, value] of Object.entries(decl)) {
    if (!/^[a-zA-Z]+$/.test(key)) continue
    if (typeof value === 'number') {
      out[key] = value
      continue
    }
    if (typeof value !== 'string' || value.length > 400) continue
    let failed = false
    const resolved = value.replace(REF_RE, (ref) => {
      const hit = lookupToken(tokens, ref)
      if (hit === null) {
        failed = true
        unresolved?.add(ref)
        return ''
      }
      return String(hit)
    })
    if (failed) continue
    // keep generated content inside its own frame
    out[key] = key === 'position' && resolved === 'fixed' ? 'absolute' : resolved
  }
  return out as React.CSSProperties
}

/** Merged, token-resolved style for a node (component base + variant + instance overrides). */
export function nodeStyle(node: LabNode, system: DesignSystem, unresolved?: Set<string>): React.CSSProperties {
  const component = node.component ? system.components.find((c) => c.name === node.component) : undefined
  const variant = component && node.variant ? component.variants?.[node.variant] : undefined
  return {
    ...resolveStyle(component?.base, system.tokens, unresolved),
    ...resolveStyle(variant, system.tokens, unresolved),
    ...resolveStyle(node.style, system.tokens, unresolved),
  }
}

/* ------------------------------------------------------------------ *
 *  Validation core (shared by invent + compose modes)
 * ------------------------------------------------------------------ */

const MAX_NODES = 140
const MAX_DEPTH = 8

export interface LabResult {
  system: DesignSystem
  warnings: string[]
  nodeCount: number
  newComponents?: number
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}

/** First non-null value among several key aliases — models rename schema keys. */
function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] != null) return obj[k]
  }
  return undefined
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() && v.length < 300) return v
    if (typeof v === 'number') return String(v)
  }
  return undefined
}

/** Accepts {name: "value"}, {name: {value|hex: ...}}, or [{name, value|hex}] shapes. */
function coerceStringMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (Array.isArray(v)) {
    for (const item of v) {
      const r = asRecord(item)
      const name = firstString(r.name, r.key, r.id)
      const val = firstString(r.value, r.hex, r.color, r.stack)
      if (name && val) out[name] = val
    }
    return out
  }
  for (const [k, val] of Object.entries(asRecord(v))) {
    if (typeof val === 'string' && val.length < 300) out[k] = val
    else {
      const r = asRecord(val)
      const s = firstString(r.value, r.hex, r.color, r.stack)
      if (s) out[k] = s
    }
  }
  return out
}

function coerceStyle(v: unknown): StyleDecl | undefined {
  const rec = asRecord(v)
  const out: StyleDecl = {}
  for (const [k, val] of Object.entries(rec)) {
    if (/^[a-zA-Z]+$/.test(k) && (typeof val === 'string' || typeof val === 'number')) out[k] = val
  }
  return Object.keys(out).length ? out : undefined
}

/** Coerce a component list; adds accepted names to `seenNames` (skips duplicates against it). */
function coerceComponents(raw: unknown, seenNames: Set<string>, limit = 16): ComponentDef[] {
  const components: ComponentDef[] = []
  const list = Array.isArray(raw)
    ? raw
    : Object.entries(asRecord(raw)).map(([name, def]) => ({ name, ...asRecord(def) }))
  for (const c of list) {
    if (components.length >= limit) break
    const rec = asRecord(c)
    if (typeof rec.name !== 'string' || seenNames.has(rec.name)) continue
    const base = coerceStyle(pick(rec, 'base', 'style', 'styles'))
    if (!base) continue
    seenNames.add(rec.name)
    const variants: Record<string, StyleDecl> = {}
    for (const [vk, vv] of Object.entries(asRecord(rec.variants))) {
      const style = coerceStyle(vv)
      if (style) variants[vk] = style
    }
    components.push({
      name: rec.name,
      role: typeof rec.role === 'string' ? rec.role : '',
      description: typeof rec.description === 'string' ? rec.description : '',
      preview: typeof rec.preview === 'string' ? rec.preview : rec.name,
      base,
      ...(Object.keys(variants).length ? { variants } : {}),
      ...(typeof rec.code === 'string' && rec.code.length < 4000 ? { code: rec.code } : {}),
    })
  }
  return components
}

function coerceNodeTree(
  raw: unknown,
  componentNames: Set<string>,
  warnings: string[],
): { page: LabNode; count: number } | null {
  const seenIds = new Set<string>()
  let counter = 0
  let total = 0
  const coerceNode = (input: unknown, depth: number): LabNode | null => {
    if (total >= MAX_NODES || depth > MAX_DEPTH || typeof input !== 'object' || input === null) return null
    total++
    const n = asRecord(input)
    let id = typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `node-${++counter}`
    while (seenIds.has(id)) id = `${id}-${++counter}`
    seenIds.add(id)
    const node: LabNode = {
      id,
      label: typeof n.label === 'string' && n.label.trim() ? n.label.trim() : 'node',
    }
    const componentRef = firstString(n.component, n.use)
    if (componentRef && componentNames.has(componentRef)) node.component = componentRef
    else if (componentRef) warnings.push(`unknown component "${componentRef}" on ${id}`)
    if (typeof n.variant === 'string') node.variant = n.variant
    node.element = n.element === 'button' ? 'button' : 'div'
    const style = coerceStyle(pick(n, 'style', 'styles', 'css'))
    if (style) node.style = style
    const text = pick(n, 'text', 'content')
    if (typeof text === 'string') node.text = text
    const rawChildren = pick(n, 'children', 'nodes', 'items')
    if (Array.isArray(rawChildren)) {
      const children = rawChildren.map((c) => coerceNode(c, depth + 1)).filter((c): c is LabNode => c !== null)
      if (children.length) node.children = children
    }
    return node
  }
  const page = coerceNode(raw, 1)
  return page ? { page, count: total } : null
}

/** Dry-run token resolution across a whole system; returns unresolved "$" refs. */
function collectUnresolved(system: DesignSystem): Set<string> {
  const unresolved = new Set<string>()
  const walk = (n: LabNode) => {
    nodeStyle(n, system, unresolved)
    n.children?.forEach(walk)
  }
  walk(system.page)
  system.components.forEach((c) => {
    resolveStyle(c.base, system.tokens, unresolved)
    Object.values(c.variants ?? {}).forEach((v) => resolveStyle(v, system.tokens, unresolved))
  })
  return unresolved
}

export function validateDesignSystem(raw: unknown): LabResult {
  const warnings: string[] = []
  let obj = asRecord(raw)
  // some models wrap everything one level deeper
  const wrapped = pick(obj, 'designSystem', 'design_system', 'system')
  if (wrapped && !obj.tokens && !obj.page) obj = asRecord(wrapped)
  // tokens may live under an aliased key, or be flattened onto the root
  const rawTokens = asRecord(pick(obj, 'tokens', 'designTokens', 'design_tokens') ?? obj)

  const type: Record<string, TypeStyle> = {}
  for (const [k, v] of Object.entries(asRecord(pick(rawTokens, 'type', 'typeScale', 'typography', 'textStyles')))) {
    const t = asRecord(v)
    const size = firstString(t.size, t.fontSize)
    if (size) {
      const sizeCss = /^[0-9.]+$/.test(size) ? `${size}px` : size
      const weight = typeof t.weight === 'number' ? t.weight : typeof t.fontWeight === 'number' ? t.fontWeight : 400
      type[k] = {
        size: sizeCss,
        weight,
        lineHeight: typeof t.lineHeight === 'string' || typeof t.lineHeight === 'number' ? t.lineHeight : 1.5,
        ...(typeof t.letterSpacing === 'string' ? { letterSpacing: t.letterSpacing } : {}),
      }
    }
  }

  const tokens: DesignTokens = {
    color: coerceStringMap(pick(rawTokens, 'color', 'colors', 'palette')),
    font: coerceStringMap(pick(rawTokens, 'font', 'fonts', 'fontFamilies', 'fontFamily')),
    type,
    space: coerceStringMap(pick(rawTokens, 'space', 'spacing', 'spaces')),
    radius: coerceStringMap(pick(rawTokens, 'radius', 'radii', 'borderRadius', 'corners')),
    shadow: coerceStringMap(pick(rawTokens, 'shadow', 'shadows', 'elevation', 'depth')),
  }
  if (Object.keys(tokens.color).length === 0) {
    throw new Error(
      `design system has no color tokens (top-level keys: ${Object.keys(obj).join(', ') || 'none'}; token keys: ${Object.keys(rawTokens).join(', ') || 'none'})`,
    )
  }

  const seenNames = new Set<string>()
  const components = coerceComponents(pick(obj, 'components', 'componentLibrary', 'library'), seenNames)
  if (components.length === 0) warnings.push('model defined no reusable components')

  const tree = coerceNodeTree(pick(obj, 'page', 'layout', 'composition', 'root', 'tree'), seenNames, warnings)
  if (!tree) throw new Error(`response has no valid "page" tree (top-level keys: ${Object.keys(obj).join(', ')})`)

  const system: DesignSystem = {
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Untitled Language',
    philosophy: typeof obj.philosophy === 'string' ? obj.philosophy : '',
    experienceNotes: Array.isArray(obj.experienceNotes)
      ? obj.experienceNotes.filter((x): x is string => typeof x === 'string').slice(0, 8)
      : [],
    tokens,
    components,
    page: tree.page,
  }

  const unresolved = collectUnresolved(system)
  if (unresolved.size > 0) {
    warnings.push(`unresolved token refs dropped: ${[...unresolved].slice(0, 5).join(', ')}${unresolved.size > 5 ? '…' : ''}`)
  }
  return { system, warnings, nodeCount: tree.count }
}

/** Compose mode: validate a {newComponents?, page} response against a saved base language. */
export function validateComposition(raw: unknown, base: DesignSystem): LabResult {
  const warnings: string[] = []
  let obj = asRecord(raw)
  const wrapped = pick(obj, 'designSystem', 'design_system', 'system', 'result')
  if (wrapped && !obj.page && !obj.layout) obj = asRecord(wrapped)

  const seenNames = new Set(base.components.map((c) => c.name))
  const extras = coerceComponents(pick(obj, 'newComponents', 'new_components', 'components'), seenNames, 2)

  const tree = coerceNodeTree(pick(obj, 'page', 'layout', 'composition', 'root', 'tree'), seenNames, warnings)
  if (!tree) throw new Error(`response has no valid "page" tree (top-level keys: ${Object.keys(obj).join(', ') || 'none'})`)

  const system: DesignSystem = {
    ...base,
    components: [...base.components, ...extras],
    page: tree.page,
  }
  const unresolved = collectUnresolved(system)
  if (unresolved.size > 0) {
    warnings.push(`unresolved token refs dropped: ${[...unresolved].slice(0, 5).join(', ')}${unresolved.size > 5 ? '…' : ''}`)
  }
  return { system, warnings, nodeCount: tree.count, newComponents: extras.length }
}

/* ------------------------------------------------------------------ *
 *  Generation entry points
 * ------------------------------------------------------------------ */

export async function generateDesignSystem(
  config: AIConfig,
  userPrompt: string,
  onRepair?: (message: string) => void,
  onPartial?: (partial: LabResult) => void,
): Promise<LabResult> {
  return generateValidated(config, LAB_SYSTEM_PROMPT, userPrompt, validateDesignSystem, onRepair, onPartial)
}

export async function generateWithStyle(
  config: AIConfig,
  userPrompt: string,
  base: DesignSystem,
  onRepair?: (message: string) => void,
  onPartial?: (partial: LabResult) => void,
): Promise<LabResult> {
  return generateValidated(
    config,
    composeSystemPrompt(base),
    userPrompt,
    (raw) => validateComposition(raw, base),
    onRepair,
    onPartial,
  )
}

/* ------------------------------------------------------------------ *
 *  Style library — saved design languages (localStorage)
 * ------------------------------------------------------------------ */

export interface SavedStyle {
  id: string
  savedAt: string // ISO date
  system: DesignSystem
  /** Ships with the app: never stored in localStorage, cannot be deleted. */
  builtin?: boolean
}

const LIBRARY_KEY = 'canvas-agent-style-library'

export function loadStyleLibrary(): SavedStyle[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((s) => s && typeof s.id === 'string' && s.system)
    }
  } catch {
    /* corrupted library falls through to empty */
  }
  return []
}

export function saveStyleLibrary(styles: SavedStyle[]) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(styles))
}

/**
 * Parse an imported styles file. Accepts a SavedStyle[], a single SavedStyle,
 * or a bare DesignSystem — every system is re-run through the validator so a
 * hand-edited or foreign file can't break the renderer.
 */
export function parseImportedStyles(text: string): SavedStyle[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('file is not valid JSON')
  }
  const items = Array.isArray(raw) ? raw : [raw]
  const out: SavedStyle[] = []
  const errors: string[] = []
  for (const item of items) {
    const rec = asRecord(item)
    try {
      const { system } = validateDesignSystem(rec.system ?? rec)
      out.push({
        id: typeof rec.id === 'string' ? rec.id : crypto.randomUUID(),
        savedAt: typeof rec.savedAt === 'string' ? rec.savedAt : new Date().toISOString(),
        system,
      })
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }
  if (out.length === 0) throw new Error(errors[0] ?? 'no styles found in file')
  return out
}


/* ------------------------------------------------------------------ *
 *  Code export — any design system (built-in or generated) becomes
 *  real CSS: tokens as custom properties, components as class recipes.
 * ------------------------------------------------------------------ */

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/** "$type.h2.size" → "var(--type-h2-size)"; other text is left alone. */
function refsToVars(value: string): string {
  return value.replace(REF_RE, (ref) => `var(--${kebab(ref.slice(1).replace(/\./g, '-'))})`)
}

function declToCss(decl: StyleDecl | undefined, indent = '  '): string {
  if (!decl) return ''
  return Object.entries(decl)
    .filter(([key]) => /^[a-zA-Z]+$/.test(key))
    .map(([key, value]) => `${indent}${kebab(key)}: ${typeof value === 'string' ? refsToVars(value) : value};`)
    .join('\n')
}

export function tokensToCss(system: DesignSystem): string {
  const lines: string[] = []
  const group = (title: string, prefix: string, map: Record<string, string>) => {
    if (Object.keys(map).length === 0) return
    lines.push(`  /* ${title} */`)
    for (const [k, v] of Object.entries(map)) lines.push(`  --${prefix}-${kebab(k)}: ${v};`)
  }
  group('color', 'color', system.tokens.color)
  group('font', 'font', system.tokens.font)
  lines.push('  /* type */')
  for (const [k, t] of Object.entries(system.tokens.type)) {
    lines.push(`  --type-${kebab(k)}-size: ${t.size};`)
    lines.push(`  --type-${kebab(k)}-weight: ${t.weight};`)
    lines.push(`  --type-${kebab(k)}-line-height: ${t.lineHeight};`)
    lines.push(`  --type-${kebab(k)}-letter-spacing: ${t.letterSpacing ?? 'normal'};`)
  }
  group('space', 'space', system.tokens.space)
  group('radius', 'radius', system.tokens.radius)
  group('shadow', 'shadow', system.tokens.shadow)
  return `:root {\n${lines.join('\n')}\n}`
}

export function componentToCss(component: ComponentDef): string {
  const cls = kebab(component.name).replace(/^-/, '')
  const blocks = [`.${cls} {\n${declToCss(component.base)}\n}`]
  for (const [name, decl] of Object.entries(component.variants ?? {})) {
    blocks.push(`.${cls}--${kebab(name)} {\n${declToCss(decl)}\n}`)
  }
  return blocks.join('\n\n')
}

/** Swatches used by thumbnails and cards, in token order. */
export function paletteOf(system: DesignSystem, count = 6): string[] {
  return Object.values(system.tokens.color).slice(0, count)
}
