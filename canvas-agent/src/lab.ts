import { callModel, generateValidated, parseModelJson, type AIConfig } from './ai'
import { ART_KINDS, googleFontsHref, extrasSystemPrompt, extrasUserPrompt, isIconName, mergeModelExtras, type ArtKind, type LanguageExtras, type OverlayKind } from './language'
import type { LibraryId } from './realui/catalog'

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
  /** Behavior per state (hover, focus, active, disabled, loading, error, selected…): partial style overrides. */
  states?: Record<string, StyleDecl>
  /** Set on overlay components (modal, drawer, popover, tooltip, toast, menu). */
  overlay?: OverlayKind
}

export interface LabNode {
  id: string
  label: string
  component?: string
  variant?: string
  element?: 'div' | 'button'
  style?: StyleDecl
  text?: string
  /** A glyph from the language's icon pool (lucide), drawn with the language's icon style. */
  icon?: string
  /** A picture: generated art in the language's palette, cropped by a named treatment. */
  image?: { art?: ArtKind; treatment?: string; seed?: number }
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
  /** Set when the REAL component library exists in this app: designs can then use its actual components. */
  library?: LibraryId
}

export interface DesignSystem {
  name: string
  philosophy: string
  experienceNotes: string[]
  tokens: DesignTokens
  components: ComponentDef[]
  page: LabNode
  meta?: SystemMeta
  /** States, icons, fonts, adaptations, overlays and images. Derived by code, optionally chosen by the model. */
  extras?: LanguageExtras
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
- "space": a named spacing rhythm with these exact names: xs, sm, md, lg, xl, xxl. Every value is a STRING WITH UNITS, e.g. {"xs":"4px","sm":"8px","md":"16px","lg":"24px","xl":"40px","xxl":"72px"} — pick a base unit and scale it.
- "radius": named radii that express the language's geometry, also strings with units, e.g. {"sharp":"0px","soft":"12px","pill":"9999px"}. If the brief says "rounded", use real radii (16px or more on cards and buttons).
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
  "icon": "<name>",                     // optional — a glyph: Home, Search, Heart, Star, User, Settings, Bell, Mail, Calendar, MapPin, Camera, ShoppingBag, ArrowRight, Check, Menu, Leaf, Flower2, Sprout, Sun, Moon, Coffee, Music, Plane, Gift, Sparkles… (the set is finalized later)
  "image": { "treatment": "Hero" | "Card" | "Portrait" | "Square" | "Avatar" | "Wide banner" },  // optional — a picture drawn by the language's own art; use it INSTEAD of empty boxes for photos
  "children": [ ... ]                   // container nodes
}

CSS RULES:
- camelCase React style properties (background, color, padding, margin, display, flexDirection, alignItems, justifyContent, gap, gridTemplateColumns, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textTransform, borderRadius, boxShadow, border, borderTop, width, maxWidth, height, minHeight, aspectRatio, opacity, overflow, textAlign, flex, flexWrap, alignSelf…). Values are plain CSS strings or numbers.
- The page root gets the frame background; sections own their padding. Page width is fixed at 1240px by the canvas — a full desktop viewport. Design for that width: multi-column layouts, asymmetric splits, wide grids (gridTemplateColumns with 3–4 tracks), generous horizontal rhythm. Cap text measure with maxWidth so long copy stays readable; place content deliberately inside the width instead of stretching everything edge to edge.

SPACING IS NOT OPTIONAL: every section has vertical and horizontal padding ("$space.xxl $space.xl" or larger); every card has padding ("$space.lg"); every button has padding ("$space.sm $space.lg"), a radius from $radius and cursor pointer; siblings are separated with gap ("$space.md" or more). A design with elements touching each other or the frame edge is a FAILED design.

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

/** Sensible steps for a name the model used but never defined. */
const DEFAULT_SPACE: Record<string, string> = { xxs: '2px', xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px', '2xl': '48px', '3xl': '64px', xxxl: '64px' }
const DEFAULT_RADIUS: Record<string, string> = { none: '0px', sharp: '0px', xs: '2px', sm: '4px', md: '8px', lg: '16px', xl: '24px', soft: '12px', round: '9999px', pill: '9999px', full: '9999px' }

const px = (v: string) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null)

/**
 * A reference to a spacing / radius / font name that was never defined must not delete the
 * property (that is how a design ends up with no padding and square corners): use the standard
 * step of that name, or the middle of the scale the model did define.
 */
function fallbackToken(tokens: DesignTokens, ref: string): string | null {
  const [group, key] = ref.slice(1).split('.')
  if (group === 'space' || group === 'radius') {
    const defaults = group === 'space' ? DEFAULT_SPACE : DEFAULT_RADIUS
    if (key in defaults) return defaults[key]
    const defined = Object.values(tokens[group]).map(px).filter((n): n is number => n !== null).sort((a, b) => a - b)
    if (group === 'radius') {
      // the largest ordinary corner, never a pill (a 9999px card becomes a blob)
      const ordinary = defined.filter((n) => n > 0 && n < 100)
      return ordinary.length ? `${ordinary[ordinary.length - 1]}px` : DEFAULT_RADIUS.lg
    }
    if (defined.length) return `${defined[Math.floor(defined.length / 2)]}px`
    return DEFAULT_SPACE.md
  }
  if (group === 'font') return tokens.font.body ?? tokens.font.display ?? Object.values(tokens.font)[0] ?? null
  return null
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
      const direct = lookupToken(tokens, ref)
      const hit = direct ?? fallbackToken(tokens, ref)
      if (direct === null) unresolved?.add(ref) // reported to the user even when a standard value is used instead
      if (hit === null) {
        failed = true
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
function coerceStringMap(v: unknown, lengths = false): Record<string, string> {
  const out: Record<string, string> = {}
  /** Small models write 16 (or "16") for a spacing or radius step: that is 16px, and bare numbers are invalid CSS in a string. */
  const unit = (s: string) => (lengths && /^-?\d+(\.\d+)?$/.test(s.trim()) ? `${s.trim()}px` : s)
  if (Array.isArray(v)) {
    for (const item of v) {
      const r = asRecord(item)
      const name = firstString(r.name, r.key, r.id)
      const val = firstString(r.value, r.hex, r.color, r.stack)
      if (name && val) out[name] = unit(val)
    }
    return out
  }
  for (const [k, val] of Object.entries(asRecord(v))) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = unit(String(val))
    else if (typeof val === 'string' && val.length < 300) out[k] = unit(val)
    else {
      const r = asRecord(val)
      const s = firstString(r.value, r.hex, r.color, r.stack)
      if (s) out[k] = unit(s)
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
    if (isIconName(n.icon)) node.icon = n.icon
    const img = asRecord(n.image)
    if (Object.keys(img).length) {
      node.image = {
        ...(ART_KINDS.includes(img.art as ArtKind) ? { art: img.art as ArtKind } : {}),
        ...(typeof img.treatment === 'string' ? { treatment: img.treatment.slice(0, 40) } : {}),
        ...(typeof img.seed === 'number' ? { seed: Math.abs(Math.round(img.seed)) % 9999 } : {}),
      }
    } else if (n.image === true) node.image = {}
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

/* ------------------------------------------------------------------ *
 *  Quality pass — the craft rules the prompt asks for, checked in code
 *  (small models ignore the prompt: pale text on pale cards, bare buttons)
 * ------------------------------------------------------------------ */

type RGBA = [number, number, number, number]

/** #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(). Anything else (names, hsl, var) is unknown. */
function parseColor(css: string): RGBA | null {
  const s = css.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s)
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4])
    return [+rgb[1], +rgb[2], +rgb[3], a]
  }
  return null
}

/** Every color found inside a CSS value (a plain color, or the stops of a gradient). */
function colorsIn(value: unknown): RGBA[] {
  if (typeof value !== 'string') return []
  const found = value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? []
  return found.map(parseColor).filter((c): c is RGBA => c !== null)
}

const over = (top: RGBA, base: RGBA): RGBA => [
  top[0] * top[3] + base[0] * (1 - top[3]),
  top[1] * top[3] + base[1] * (1 - top[3]),
  top[2] * top[3] + base[2] * (1 - top[3]),
  1,
]

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Below this, body copy is hard to read. (WCAG AA asks 4.5 for small text, 3 for large.) */
const MIN_CONTRAST = 3.5

const hexOf = ([r, g, b]: RGBA) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

/**
 * Fixes text that cannot be read and buttons that look flat. Works on the page tree only
 * (component recipes stay as designed). Returns what it changed, for the warnings list.
 */
export function repairDesign(system: DesignSystem): { contrast: number; buttons: number } {
  const palette = Object.entries(system.tokens.color)
    .map(([name, value]) => ({ name, rgb: parseColor(value) }))
    .filter((c): c is { name: string; rgb: RGBA } => c.rgb !== null && c.rgb[3] === 1)
  const black: RGBA = [17, 17, 17, 1]
  const white: RGBA = [255, 255, 255, 1]
  let contrast = 0
  let buttons = 0
  let stretched = 0

  const walk = (node: LabNode, parentBg: RGBA, parentColor: RGBA, parentStyle: Record<string, unknown> = {}) => {
    const style = nodeStyle(node, system) as Record<string, unknown>
    // background: the average of a gradient's stops, blended over what is behind it
    const stops = colorsIn(style.background ?? style.backgroundColor)
    let bg = parentBg
    if (stops.length) {
      const avg = stops.reduce<RGBA>(
        (acc, c) => [acc[0] + c[0] / stops.length, acc[1] + c[1] / stops.length, acc[2] + c[2] / stops.length, acc[3] + c[3] / stops.length],
        [0, 0, 0, 0],
      )
      bg = over(avg, parentBg)
    }
    let color = colorsIn(style.color)[0] ?? parentColor
    if (color[3] < 1) color = over(color, bg)

    if (node.text?.trim()) {
      const ratio = contrastRatio(color, bg)
      if (ratio < MIN_CONTRAST) {
        // Prefer a palette TOKEN (it follows the language into its dark theme); a literal color cannot adapt.
        const rank = (options: Array<{ ref: string; rgb: RGBA }>) => options.map((o) => ({ ...o, ratio: contrastRatio(o.rgb, bg) })).sort((a, b) => b.ratio - a.ratio)[0]
        const tokens = rank(palette.map((p) => ({ ref: `$color.${p.name}`, rgb: p.rgb })))
        const best = tokens && tokens.ratio >= 4.5 ? tokens : rank([...palette.map((p) => ({ ref: `$color.${p.name}`, rgb: p.rgb })), { ref: hexOf(black), rgb: black }, { ref: hexOf(white), rgb: white }])
        if (best && best.ratio > ratio + 1) {
          node.style = { ...node.style, color: best.ref }
          color = best.rgb
          contrast++
        }
      }
    }

    const isButton = node.element === 'button' || /button|cta/i.test(node.component ?? '')
    if (isButton && node.text?.trim() && !Object.keys(style).some((k) => k.startsWith('padding'))) {
      node.style = { ...node.style, padding: '$space.sm $space.md', cursor: 'pointer' }
      buttons++
    }
    // a button or tag inside a stretching column would run edge to edge: give it its natural width
    const isChip = /tag|badge|chip|pill/i.test(node.component ?? '')
    if (
      (isButton || isChip) &&
      parentStyle.flexDirection === 'column' &&
      (parentStyle.alignItems === undefined || parentStyle.alignItems === 'stretch') &&
      !('alignSelf' in style) &&
      !('width' in style) &&
      !('flex' in style)
    ) {
      node.style = { ...node.style, alignSelf: 'flex-start' }
      stretched++
    }

    node.children?.forEach((c) => walk(c, bg, color, style))
  }
  walk(system.page, white, black)
  return { contrast, buttons: buttons + stretched }
}

/** Adds one warning line per kind of repair. */
function noteRepairs(warnings: string[], fixed: { contrast: number; buttons: number }) {
  if (fixed.contrast) warnings.push(`fixed low-contrast text on ${fixed.contrast} node${fixed.contrast === 1 ? '' : 's'} (used the best color from the palette)`)
  if (fixed.buttons) warnings.push(`gave padding to ${fixed.buttons} bare button${fixed.buttons === 1 ? '' : 's'}`)
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
    space: coerceStringMap(pick(rawTokens, 'space', 'spacing', 'spaces'), true),
    radius: coerceStringMap(pick(rawTokens, 'radius', 'radii', 'borderRadius', 'corners'), true),
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

  noteRepairs(warnings, repairDesign(system))
  const unresolved = collectUnresolved(system)
  if (unresolved.size > 0) {
    warnings.push(`the model used names it never defined: ${[...unresolved].slice(0, 5).join(', ')}${unresolved.size > 5 ? '…' : ''} — standard values were used for spacing, radius and font`)
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
  noteRepairs(warnings, repairDesign(system))
  const unresolved = collectUnresolved(system)
  if (unresolved.size > 0) {
    warnings.push(`the model used names it never defined: ${[...unresolved].slice(0, 5).join(', ')}${unresolved.size > 5 ? '…' : ''} — standard values were used for spacing, radius and font`)
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

/**
 * The second pass: the model chooses fonts, icons, states, a dark theme, text adaptations, overlays and
 * image treatments for a finished language. Everything is validated and merged over the derived defaults,
 * so a failed or partial answer never leaves the language incomplete.
 */
export async function generateExtras(
  config: AIConfig,
  system: DesignSystem,
  brief: string,
): Promise<{ system: DesignSystem; used: string[]; ignored: string[] }> {
  const text = await callModel(config, extrasSystemPrompt(), extrasUserPrompt(system, brief))
  return mergeModelExtras(system, parseModelJson(text))
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
  const ex = system.extras
  if (ex) {
    lines.push('  /* overlay */')
    lines.push(`  --scrim: ${ex.overlay.scrim};`, `  --scrim-blur: ${ex.overlay.blur};`, `  --overlay-motion: ${ex.overlay.motion};`)
  }
  const fonts = ex ? googleFontsHref(ex.fonts) : null
  let css = `:root {\n${lines.join('\n')}\n}`
  if (ex && Object.keys(ex.themes.dark).length) {
    const dark = Object.entries(ex.themes.dark).map(([k, v]) => `  --color-${kebab(k)}: ${v};`)
    css += `\n\n/* Color adaptation: the dark theme. Set data-theme="dark" on <html>. */\n[data-theme='dark'] {\n${dark.join('\n')}\n}`
  }
  return fonts ? `@import url("${fonts}");\n\n${css}` : css
}

export function componentToCss(component: ComponentDef): string {
  const cls = kebab(component.name).replace(/^-/, '')
  const blocks = [`.${cls} {\n${declToCss(component.base)}\n}`]
  for (const [name, decl] of Object.entries(component.variants ?? {})) {
    blocks.push(`.${cls}--${kebab(name)} {\n${declToCss(decl)}\n}`)
  }
  // states: real CSS selectors for the ones that have one, a modifier class for the rest
  const selectors: Record<string, string> = {
    hover: `.${cls}:hover`,
    focus: `.${cls}:focus-visible`,
    active: `.${cls}:active`,
    disabled: `.${cls}:disabled,\n.${cls}[aria-disabled='true']`,
    loading: `.${cls}[aria-busy='true']`,
    error: `.${cls}[aria-invalid='true']`,
    selected: `.${cls}[aria-selected='true'],\n.${cls}.is-selected`,
  }
  for (const [name, decl] of Object.entries(component.states ?? {})) {
    blocks.push(`${selectors[name] ?? `.${cls}--${kebab(name)}`} {\n${declToCss(decl)}\n}`)
  }
  return blocks.join('\n\n')
}

/** Swatches used by thumbnails and cards, in token order. */
export function paletteOf(system: DesignSystem, count = 6): string[] {
  return Object.values(system.tokens.color).slice(0, count)
}
