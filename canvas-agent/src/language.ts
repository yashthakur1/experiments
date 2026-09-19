import type { ComponentDef, DesignSystem, DesignTokens, StyleDecl } from './lab'

/* ================================================================== *
 *  The rest of a design language.
 *
 *  A language is more than a palette and a type scale. It also says:
 *    - how every component behaves in each STATE (hover, focus, …)
 *    - which ICONS it uses and how they are drawn
 *    - which real FONTS it loads, and how they pair
 *    - how COLOR adapts (tint ramps, a dark theme, contrast pairs)
 *    - how TEXT adapts (on light, on dark, on brand; per device)
 *    - which OVERLAYS exist (modal, drawer, tooltip, toast…) and the scrim
 *    - how IMAGES are treated (ratios, crops, filters) and what art it uses
 *
 *  Everything here can be DERIVED from the core tokens by plain code, so
 *  every language, including built-in and older saved ones, is complete.
 *  A second model pass may then replace the derived parts with the
 *  language's own choices (see mergeModelExtras). All free: Google Fonts are
 *  open-licensed, lucide icons are ISC, image art is generated here.
 *
 *  Pure module: no React, no "@/" imports, so Node tests can load it.
 * ================================================================== */

/* ------------------------------------------------------------------ *
 *  Types
 * ------------------------------------------------------------------ */

export type OverlayKind = 'modal' | 'drawer' | 'popover' | 'tooltip' | 'toast' | 'menu'
export type ArtKind = 'petals' | 'blobs' | 'waves' | 'rings' | 'grid' | 'grain' | 'stripes' | 'dots'

export const STATE_NAMES = ['hover', 'focus', 'active', 'disabled', 'loading', 'error', 'selected'] as const
export const OVERLAY_KINDS: OverlayKind[] = ['modal', 'drawer', 'popover', 'tooltip', 'toast', 'menu']
export const ART_KINDS: ArtKind[] = ['petals', 'blobs', 'waves', 'rings', 'grid', 'grain', 'stripes', 'dots']

export interface FontSpec {
  role: string // display | body | mono | accent
  family: string // a Google Fonts family from FONT_CATALOG
  weights: number[]
}

export interface IconSpec {
  glyphs: string[] // names from ICON_POOL
  stroke: number // px, 1–3
  size: number // px, default icon size
  cap: 'round' | 'square'
  container: 'none' | 'circle' | 'rounded' | 'square'
  note?: string
}

export interface SurfacePair {
  name: string
  bg: string
  text: string
  muted: string
}

export interface TextAdaptations {
  surfaces: SurfacePair[]
  scales: Array<{ device: string; factor: number }>
  rules: string[]
}

export interface ImageTreatment {
  name: string
  ratio: string // CSS aspect-ratio, e.g. "16/9"
  radius: string // token ref or length
  filter?: string
  overlay?: string // CSS gradient laid over the picture
  frame?: string // CSS border
}

export interface ImageSpec {
  art: ArtKind
  treatments: ImageTreatment[]
  direction: string // photography / illustration direction, in words
}

export interface OverlaySpec {
  scrim: string
  blur: string
  motion: string
}

export interface LanguageExtras {
  fonts: FontSpec[]
  icons: IconSpec
  /** Color adaptations: token name → value for the dark theme. */
  themes: { dark: Record<string, string> }
  textAdaptations: TextAdaptations
  overlay: OverlaySpec
  images: ImageSpec
  /** Where each part came from, for the UI: derived by code, or chosen by the model. */
  source: Record<string, 'derived' | 'model'>
}

/* ------------------------------------------------------------------ *
 *  Color math
 * ------------------------------------------------------------------ */

type RGB = [number, number, number]

export function parseColor(css: string | undefined): (RGB & { 3?: number }) | null {
  if (!css) return null
  const s = css.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s)
  return rgb ? [+rgb[1], +rgb[2], +rgb[3]] : null
}

export const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function toHsl([r, g, b]: RGB): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s, l]
}

function fromHsl(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [12, 12, 14]

/** A 9-step ramp (100 → 900) around a brand color, which sits at 500. */
export function ramp(hex: string): string[] {
  const c = parseColor(hex)
  if (!c) return []
  const steps: RGB[] = []
  for (const t of [0.86, 0.72, 0.54, 0.3]) steps.push(mix(c, WHITE, t))
  steps.push(c)
  for (const t of [0.18, 0.36, 0.55, 0.72]) steps.push(mix(c, BLACK, t))
  return steps.map(toHex)
}

/** The dark-theme counterpart of one color: surfaces go deep, ink goes light, accents lift. */
export function darkOf(hex: string): string {
  const c = parseColor(hex)
  if (!c) return hex
  const [h, s, l] = toHsl(c)
  if (s < 0.22) {
    // neutral: invert lightness into a dark surface band (light surfaces) or a light ink band (dark inks)
    const nl = l > 0.5 ? 0.09 + (1 - l) * 0.35 : 0.86 + (0.5 - l) * 0.12
    return toHex(fromHsl(h, Math.min(s, 0.18), nl))
  }
  if (l > 0.8) return toHex(fromHsl(h, Math.min(s, 0.22), 0.13 + (1 - l) * 0.4)) // pastel surface → deep tinted surface
  return toHex(fromHsl(h, Math.min(1, s * 1.05), Math.max(0.58, Math.min(0.74, l + 0.14)))) // accent lifts on dark
}

/* ------------------------------------------------------------------ *
 *  Roles: which palette color plays which part
 * ------------------------------------------------------------------ */

export interface Roles {
  surface: string
  ink: string
  accent: string
  accent2: string
  danger: string
  success: string
}

const NAME_HINTS = {
  surface: /cream|bone|paper|snow|white|surface|canvas|base|background|milk|linen|ivory|blush|mist/i,
  ink: /ink|text|charcoal|black|night|coal|onyx|midnight|graphite/i,
  danger: /red|danger|error|ember|ruby|berry|rose|crimson|scarlet|coral/i,
  success: /green|success|leaf|moss|mint|sage|jade/i,
}

/** Names first, then color math, so any palette gets a full set of roles. */
export function deriveRoles(colors: Record<string, string>): Roles {
  const entries = Object.entries(colors)
    .map(([name, value]) => ({ name, rgb: parseColor(value) }))
    .filter((e): e is { name: string; rgb: RGB } => e.rgb !== null)
  const ref = (n: string) => `$color.${n}`
  if (entries.length === 0) return { surface: '#ffffff', ink: '#111111', accent: '#3b6cf6', accent2: '#3b6cf6', danger: '#c0392b', success: '#2e7d32' }
  const byLum = [...entries].sort((a, b) => luminance(b.rgb) - luminance(a.rgb))
  const surface = entries.find((e) => NAME_HINTS.surface.test(e.name) && luminance(e.rgb) > 0.6) ?? byLum[0]
  const ink = entries.find((e) => NAME_HINTS.ink.test(e.name) && luminance(e.rgb) < 0.25) ?? byLum[byLum.length - 1]
  const sat = (e: { rgb: RGB }) => toHsl(e.rgb)[1] * (1 - Math.abs(toHsl(e.rgb)[2] - 0.55))
  const chromatic = entries.filter((e) => e !== surface && e !== ink).sort((a, b) => sat(b) - sat(a))
  const accent = chromatic[0] ?? ink
  const accent2 = chromatic[1] ?? accent
  const danger = entries.find((e) => NAME_HINTS.danger.test(e.name) && toHsl(e.rgb)[1] > 0.3)
  const success = entries.find((e) => NAME_HINTS.success.test(e.name) && toHsl(e.rgb)[1] > 0.2)
  return {
    surface: ref(surface.name),
    ink: ref(ink.name),
    accent: ref(accent.name),
    accent2: ref(accent2.name),
    danger: danger ? ref(danger.name) : '#c0392b',
    success: success ? ref(success.name) : '#2e7d32',
  }
}

/** Resolve "$color.x" or a literal to a color, using the given color map. */
export function colorOf(ref: string, colors: Record<string, string>): RGB | null {
  const m = /^\$color\.(.+)$/.exec(ref)
  return parseColor(m ? colors[m[1]] : ref)
}

/* ------------------------------------------------------------------ *
 *  1 · States
 * ------------------------------------------------------------------ */

const INTERACTIVE = /button|btn|cta|input|field|select|tab|nav|link|chip|tag|toggle|switch|checkbox|radio|menu|item|card|search/i
const STATIC_ONLY_HOVER = /card|tile|item/i

/**
 * Derived states for one component, as style overrides. They use CSS color-mix() on the
 * component's own background, so they follow the palette. Model-written states replace these.
 */
export function deriveStates(component: ComponentDef, tokens: DesignTokens): Record<string, StyleDecl> {
  if (!INTERACTIVE.test(`${component.name} ${component.role}`)) return {}
  const roles = deriveRoles(tokens.color)
  const base = component.base as Record<string, string | number>
  const bgRef = String(base.background ?? base.backgroundColor ?? roles.surface)
  const bgRgb = colorOf(bgRef, tokens.color) ?? colorOf(roles.surface, tokens.color) ?? WHITE
  const pole = luminance(bgRgb) > 0.45 ? '#000000' : '#ffffff'
  const isFlatBg = !/gradient/i.test(bgRef) && bgRef !== 'transparent' && bgRef !== 'none'
  const shift = (pct: number): StyleDecl => (isFlatBg ? { background: `color-mix(in srgb, ${bgRef} ${100 - pct}%, ${pole})` } : { filter: `brightness(${pole === '#000000' ? 1 - pct / 100 : 1 + pct / 100})` })
  const states: Record<string, StyleDecl> = {
    hover: { ...shift(8), cursor: 'pointer' },
  }
  if (STATIC_ONLY_HOVER.test(component.name) && !/button|input|field/i.test(component.name)) {
    return { hover: { boxShadow: tokens.shadow.lift ?? tokens.shadow.md ?? Object.values(tokens.shadow).slice(-1)[0] ?? '0 8px 24px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' } }
  }
  states.focus = { outline: `2px solid ${roles.accent}`, outlineOffset: '2px' }
  states.active = { ...shift(16), transform: 'translateY(1px)' }
  states.disabled = { opacity: 0.45, cursor: 'not-allowed', filter: 'saturate(0.5)' }
  states.loading = { opacity: 0.72, cursor: 'progress' }
  states.error = { border: `1px solid ${roles.danger}`, color: roles.danger }
  states.selected = isFlatBg
    ? { background: `color-mix(in srgb, ${roles.accent} 18%, ${bgRef})`, border: `1px solid ${roles.accent}` }
    : { border: `1px solid ${roles.accent}` }
  return states
}

/** Components with their derived states filled in where the model gave none. */
export function withStates(components: ComponentDef[], tokens: DesignTokens): ComponentDef[] {
  return components.map((c) => (c.states && Object.keys(c.states).length ? c : { ...c, states: deriveStates(c, tokens) }))
}

/* ------------------------------------------------------------------ *
 *  2 · Fonts (Google Fonts: open-licensed, free)
 * ------------------------------------------------------------------ */

export type FontKind = 'serif' | 'sans' | 'display' | 'rounded' | 'mono' | 'script' | 'jp-serif' | 'jp-sans' | 'jp-rounded'

export interface CatalogFont {
  family: string
  kind: FontKind
  weights: number[]
  mood: string
}

/** Families the model may choose. Weights listed are the ones Google serves. */
export const FONT_CATALOG: CatalogFont[] = [
  { family: 'Inter', kind: 'sans', weights: [300, 400, 500, 600, 700, 800], mood: 'neutral, UI-first' },
  { family: 'DM Sans', kind: 'sans', weights: [400, 500, 600, 700], mood: 'friendly geometric' },
  { family: 'Manrope', kind: 'sans', weights: [300, 400, 500, 600, 700, 800], mood: 'modern, calm' },
  { family: 'Poppins', kind: 'sans', weights: [300, 400, 500, 600, 700], mood: 'round geometric, playful' },
  { family: 'Nunito', kind: 'rounded', weights: [300, 400, 600, 700, 800], mood: 'soft rounded, warm' },
  { family: 'Quicksand', kind: 'rounded', weights: [300, 400, 500, 600, 700], mood: 'light rounded, cute' },
  { family: 'Fredoka', kind: 'rounded', weights: [300, 400, 500, 600, 700], mood: 'chubby rounded, fun' },
  { family: 'Outfit', kind: 'sans', weights: [300, 400, 500, 600, 700], mood: 'clean geometric' },
  { family: 'Sora', kind: 'sans', weights: [300, 400, 500, 600, 700], mood: 'techy, wide' },
  { family: 'Space Grotesk', kind: 'sans', weights: [300, 400, 500, 600, 700], mood: 'quirky technical' },
  { family: 'Bricolage Grotesque', kind: 'display', weights: [300, 400, 500, 600, 700, 800], mood: 'characterful, editorial' },
  { family: 'Syne', kind: 'display', weights: [400, 500, 600, 700, 800], mood: 'bold art-gallery' },
  { family: 'Lexend', kind: 'sans', weights: [300, 400, 500, 600, 700], mood: 'readable, open' },
  { family: 'Work Sans', kind: 'sans', weights: [300, 400, 500, 600, 700], mood: 'grotesque, sturdy' },
  { family: 'Raleway', kind: 'sans', weights: [300, 400, 500, 600, 700, 800], mood: 'elegant thin sans' },
  { family: 'Montserrat', kind: 'sans', weights: [300, 400, 500, 600, 700, 800], mood: 'urban geometric' },
  { family: 'Archivo', kind: 'sans', weights: [300, 400, 500, 600, 700, 800], mood: 'grotesque, sporty' },
  { family: 'Playfair Display', kind: 'serif', weights: [400, 500, 600, 700, 800], mood: 'high-contrast editorial' },
  { family: 'Fraunces', kind: 'serif', weights: [300, 400, 500, 600, 700, 800], mood: 'soft old-style, quirky' },
  { family: 'Lora', kind: 'serif', weights: [400, 500, 600, 700], mood: 'warm book serif' },
  { family: 'Merriweather', kind: 'serif', weights: [300, 400, 700, 900], mood: 'sturdy reading serif' },
  { family: 'Cormorant Garamond', kind: 'serif', weights: [300, 400, 500, 600, 700], mood: 'refined, fashion' },
  { family: 'DM Serif Display', kind: 'display', weights: [400], mood: 'chic display serif' },
  { family: 'Abril Fatface', kind: 'display', weights: [400], mood: 'fat fashion display' },
  { family: 'Libre Baskerville', kind: 'serif', weights: [400, 700], mood: 'classic literary' },
  { family: 'IBM Plex Sans', kind: 'sans', weights: [300, 400, 500, 600, 700], mood: 'engineered, honest' },
  { family: 'IBM Plex Serif', kind: 'serif', weights: [300, 400, 500, 600, 700], mood: 'engineered serif' },
  { family: 'JetBrains Mono', kind: 'mono', weights: [300, 400, 500, 600, 700], mood: 'developer mono' },
  { family: 'IBM Plex Mono', kind: 'mono', weights: [300, 400, 500, 600, 700], mood: 'technical mono' },
  { family: 'Space Mono', kind: 'mono', weights: [400, 700], mood: 'retro-tech mono' },
  { family: 'Caveat', kind: 'script', weights: [400, 500, 600, 700], mood: 'handwritten note' },
  { family: 'Noto Serif JP', kind: 'jp-serif', weights: [300, 400, 500, 600, 700], mood: 'Japanese serif (Mincho)' },
  { family: 'Noto Sans JP', kind: 'jp-sans', weights: [300, 400, 500, 700], mood: 'Japanese sans (Gothic)' },
  { family: 'Zen Maru Gothic', kind: 'jp-rounded', weights: [300, 400, 500, 700], mood: 'Japanese rounded, gentle' },
  { family: 'M PLUS Rounded 1c', kind: 'jp-rounded', weights: [300, 400, 500, 700, 800], mood: 'Japanese rounded, cute' },
  { family: 'Kiwi Maru', kind: 'jp-rounded', weights: [300, 400, 500], mood: 'Japanese soft serif-rounded' },
  { family: 'Shippori Mincho', kind: 'jp-serif', weights: [400, 500, 600, 700], mood: 'Japanese literary Mincho' },
  { family: 'Zen Kaku Gothic New', kind: 'jp-sans', weights: [300, 400, 500, 700], mood: 'Japanese modern gothic' },
]

const FALLBACK: Record<FontKind, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "Georgia, 'Times New Roman', serif",
  rounded: "'Hiragino Maru Gothic ProN', system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  script: "'Comic Sans MS', cursive",
  'jp-serif': "'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif",
  'jp-sans': "'Hiragino Kaku Gothic ProN', 'Yu Gothic', system-ui, sans-serif",
  'jp-rounded': "'Hiragino Maru Gothic ProN', 'Yu Gothic', system-ui, sans-serif",
}

export function catalogFont(family: string): CatalogFont | null {
  return FONT_CATALOG.find((f) => f.family.toLowerCase() === family.trim().toLowerCase()) ?? null
}

/** A CSS font stack for a catalog family. */
export function fontStack(family: string): string {
  const f = catalogFont(family)
  return f ? `'${f.family}', ${FALLBACK[f.kind]}` : family
}

/** The Google Fonts stylesheet for a set of fonts, or null when there is nothing to load. */
export function googleFontsHref(fonts: FontSpec[]): string | null {
  const parts: string[] = []
  const seen = new Set<string>()
  for (const spec of fonts) {
    const f = catalogFont(spec.family)
    if (!f || seen.has(f.family)) continue
    seen.add(f.family)
    const weights = [...new Set(spec.weights.filter((w) => f.weights.includes(w)))].sort((a, b) => a - b)
    const use = weights.length ? weights : f.weights.includes(400) ? [400] : [f.weights[0]]
    parts.push(`family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${use.join(';')}`)
  }
  return parts.length ? `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap` : null
}

/* ------------------------------------------------------------------ *
 *  3 · Icons (lucide: ISC, free)
 * ------------------------------------------------------------------ */

/** Icons the model may choose from. Every name must exist in lucide-react (checked by a test). */
export const ICON_POOL = [
  'Home', 'Search', 'Heart', 'Star', 'User', 'Users', 'Settings', 'Bell', 'Mail', 'Calendar', 'Clock', 'MapPin', 'Camera',
  'Image', 'ShoppingBag', 'ShoppingCart', 'CreditCard', 'ArrowRight', 'ArrowLeft', 'ArrowUpRight', 'ChevronRight', 'ChevronDown',
  'Check', 'X', 'Plus', 'Minus', 'Menu', 'Filter', 'Share2', 'Bookmark', 'Download', 'Upload', 'Play', 'Pause', 'Music', 'Video',
  'Mic', 'Globe', 'Compass', 'Sun', 'Moon', 'Cloud', 'Leaf', 'Flower', 'Flower2', 'Sprout', 'TreePine', 'Mountain', 'Waves',
  'Flame', 'Droplet', 'Sparkles', 'Zap', 'Gift', 'Coffee', 'Utensils', 'Plane', 'Train', 'Car', 'Bike', 'Ticket', 'Book',
  'BookOpen', 'Pen', 'Palette', 'Brush', 'Scissors', 'Lock', 'Key', 'Shield', 'Eye', 'Info', 'Trash2', 'Edit', 'Copy',
  'Link', 'Send', 'MessageCircle', 'Phone', 'Wifi', 'Battery', 'Package', 'Truck', 'Tag', 'Award', 'Trophy', 'Target',
  'BarChart3', 'TrendingUp', 'Activity', 'Layers', 'Grid3x3', 'Box', 'Cpu', 'Database', 'Code', 'Terminal', 'Rocket',
] as const

const ICON_DEFAULTS = ['Home', 'Search', 'Heart', 'Star', 'User', 'Settings', 'Bell', 'Mail', 'Calendar', 'MapPin', 'Camera', 'ShoppingBag', 'ArrowRight', 'Check', 'X', 'Menu']

export function isIconName(name: unknown): name is string {
  return typeof name === 'string' && (ICON_POOL as readonly string[]).includes(name)
}

/** Icon drawing follows the language's geometry: sharp corners → square caps and a firmer stroke. */
export function deriveIcons(tokens: DesignTokens): IconSpec {
  const radii = Object.values(tokens.radius).map((v) => parseFloat(v)).filter((n) => Number.isFinite(n) && n < 999)
  const maxRadius = radii.length ? Math.max(...radii) : 8
  const soft = maxRadius >= 10
  const body = tokens.type.body ?? Object.values(tokens.type)[0]
  const bodySize = body ? parseFloat(body.size) || 16 : 16
  return {
    glyphs: [...ICON_DEFAULTS],
    stroke: soft ? 1.75 : 2,
    size: bodySize >= 16 ? 20 : 18,
    cap: soft ? 'round' : 'square',
    container: soft ? 'circle' : maxRadius === 0 ? 'square' : 'rounded',
  }
}

/* ------------------------------------------------------------------ *
 *  4 · Color adaptations
 * ------------------------------------------------------------------ */

export function deriveDarkTheme(colors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(colors)) {
    const d = darkOf(value)
    if (d !== value) out[name] = d
  }
  return out
}

/** WCAG grade for a text/background pair. */
export function grade(ratio: number): 'AAA' | 'AA' | 'AA large' | 'fail' {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail'
}

/* ------------------------------------------------------------------ *
 *  5 · Text adaptations
 * ------------------------------------------------------------------ */

export function deriveTextAdaptations(tokens: DesignTokens): TextAdaptations {
  const roles = deriveRoles(tokens.color)
  const c = tokens.color
  const surface = colorOf(roles.surface, c) ?? WHITE
  const ink = colorOf(roles.ink, c) ?? BLACK
  const accent = colorOf(roles.accent, c) ?? ink
  const pick = (bg: RGB): { text: string; muted: string } => {
    const candidates: Array<{ ref: string; rgb: RGB }> = [
      { ref: roles.ink, rgb: ink },
      { ref: roles.surface, rgb: surface },
      { ref: '#111111', rgb: [17, 17, 17] },
      { ref: '#ffffff', rgb: WHITE },
    ]
    const best = candidates.sort((a, b) => contrast(b.rgb, bg) - contrast(a.rgb, bg))[0]
    const mutedRgb = mix(best.rgb, bg, 0.38)
    return { text: best.ref, muted: contrast(mutedRgb, bg) >= 4.5 ? toHex(mutedRgb) : best.ref }
  }
  const surfaces: SurfacePair[] = [
    { name: 'On surface', bg: roles.surface, ...pick(surface) },
    { name: 'On ink', bg: roles.ink, ...pick(ink) },
    { name: 'On accent', bg: roles.accent, ...pick(accent) },
    { name: 'On soft accent', bg: toHex(mix(accent, surface, 0.82)), ...pick(mix(accent, surface, 0.82)) },
  ]
  return {
    surfaces,
    scales: [
      { device: 'Desktop', factor: 1 },
      { device: 'Tablet', factor: 0.875 },
      { device: 'Mobile', factor: 0.75 },
    ],
    rules: [
      'Measure: 55–75 characters per line for reading text',
      'Body text is at least 16px on mobile, with line-height 1.5 or more',
      'Cards and lists truncate to two lines with an ellipsis',
      'Text on a color uses the pair shown above, never a guess',
      'Numbers in tables are tabular and right-aligned',
    ],
  }
}

/** A type style scaled for a device: display sizes shrink most, body barely. */
export function scaleType(size: string, factor: number): string {
  const px = parseFloat(size)
  if (!Number.isFinite(px)) return size
  const weight = px >= 28 ? 1 : px >= 18 ? 0.5 : 0.15 // large text scales fully, small text stays readable
  const f = 1 - (1 - factor) * weight
  return `${Math.round(px * f * 10) / 10}px`
}

/* ------------------------------------------------------------------ *
 *  6 · Overlays
 * ------------------------------------------------------------------ */

const OVERLAY_ROLE: Record<OverlayKind, string> = {
  modal: 'Focused dialog over a scrim',
  drawer: 'Side panel for secondary tasks',
  popover: 'Small floating panel anchored to a control',
  tooltip: 'One short hint on hover or focus',
  toast: 'Brief confirmation that clears itself',
  menu: 'List of actions from a control',
}

export function deriveOverlaySpec(tokens: DesignTokens): OverlaySpec {
  const roles = deriveRoles(tokens.color)
  const ink = colorOf(roles.ink, tokens.color) ?? BLACK
  return { scrim: `rgba(${Math.round(ink[0])}, ${Math.round(ink[1])}, ${Math.round(ink[2])}, 0.52)`, blur: '6px', motion: '180ms ease-out' }
}

/** Overlay components built from the language's own tokens. */
export function deriveOverlayComponents(tokens: DesignTokens): ComponentDef[] {
  const roles = deriveRoles(tokens.color)
  const surface = colorOf(roles.surface, tokens.color) ?? WHITE
  const card = luminance(surface) > 0.5 ? roles.surface : roles.surface
  const radius = tokens.radius.lg ?? tokens.radius.md ?? tokens.radius.soft ?? Object.values(tokens.radius).filter((v) => parseFloat(v) < 999)[0]
  const radiusRef = radius === undefined ? '12px' : `$radius.${Object.keys(tokens.radius).find((k) => tokens.radius[k] === radius)}`
  const shadow = tokens.shadow.lift ?? tokens.shadow.lg ?? tokens.shadow.md ?? Object.values(tokens.shadow).slice(-1)[0] ?? '0 16px 40px rgba(0,0,0,0.18)'
  const shadowRef = Object.keys(tokens.shadow).find((k) => tokens.shadow[k] === shadow)
  const box: StyleDecl = {
    background: card,
    color: roles.ink,
    borderRadius: radiusRef,
    boxShadow: shadowRef ? `$shadow.${shadowRef}` : shadow,
    border: `1px solid color-mix(in srgb, ${roles.ink} 12%, transparent)`,
  }
  const make = (name: string, kind: OverlayKind, base: StyleDecl, preview: string): ComponentDef => ({
    name,
    role: OVERLAY_ROLE[kind],
    description: `${OVERLAY_ROLE[kind]}. Sits above a scrim; closes with Escape.`,
    preview,
    base,
    overlay: kind,
  })
  return [
    make('Modal', 'modal', { ...box, padding: '$space.lg', display: 'flex', flexDirection: 'column', gap: '$space.md', width: '360px', maxWidth: '100%' }, 'Save your changes?'),
    make('Drawer', 'drawer', { ...box, borderRadius: '0px', padding: '$space.lg', display: 'flex', flexDirection: 'column', gap: '$space.md', width: '280px', minHeight: '180px' }, 'Filters'),
    make('Popover', 'popover', { ...box, padding: '$space.md', width: '220px' }, 'Quick actions'),
    make('Tooltip', 'tooltip', { background: roles.ink, color: roles.surface, borderRadius: '$radius.sm', padding: '$space.xs $space.sm', fontSize: '12px', boxShadow: 'none', border: 'none', width: 'fit-content' }, 'Copy link'),
    make('Toast', 'toast', { ...box, padding: '$space.sm $space.md', display: 'flex', alignItems: 'center', gap: '$space.sm', width: 'fit-content' }, 'Saved ✓'),
    make('Menu', 'menu', { ...box, padding: '$space.xs', display: 'flex', flexDirection: 'column', width: '180px' }, 'Rename · Share · Delete'),
  ]
}

/* ------------------------------------------------------------------ *
 *  7 · Images: treatments + generated art (no stock photos needed)
 * ------------------------------------------------------------------ */

export function deriveImages(tokens: DesignTokens, brief = ''): ImageSpec {
  const radii = Object.entries(tokens.radius).filter(([, v]) => parseFloat(v) < 999)
  const big = radii.length ? radii[radii.length - 1][0] : null
  const mid = radii.length ? radii[Math.floor(radii.length / 2)][0] : null
  const r = (k: string | null, fallback: string) => (k ? `$radius.${k}` : fallback)
  const soft = big !== null && parseFloat(tokens.radius[big]) >= 10
  const art: ArtKind = /flower|floral|petal|bloom|garden|sakura|blossom/i.test(brief)
    ? 'petals'
    : /wave|ocean|sea|water|dive|flow/i.test(brief)
      ? 'waves'
      : /tech|code|data|grid|dev|api|system/i.test(brief)
        ? 'grid'
        : soft
          ? 'blobs'
          : 'stripes'
  return {
    art,
    treatments: [
      { name: 'Hero', ratio: '16/9', radius: r(big, '16px'), overlay: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.28))' },
      { name: 'Card', ratio: '4/3', radius: r(mid, '10px') },
      { name: 'Portrait', ratio: '3/4', radius: r(mid, '10px'), filter: 'saturate(1.08)' },
      { name: 'Square', ratio: '1/1', radius: r(big, '12px') },
      { name: 'Avatar', ratio: '1/1', radius: '9999px', frame: '2px solid rgba(255,255,255,0.7)' },
      { name: 'Wide banner', ratio: '3/1', radius: r(mid, '10px') },
    ],
    direction: soft
      ? 'Soft light, gentle crops, generous negative space. Prefer natural color; lift shadows slightly.'
      : 'Confident crops and strong contrast. Keep subjects centered and backgrounds quiet.',
  }
}

/** Deterministic pseudo-random numbers, so the same seed always draws the same art. */
function rng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Generated art in the language's palette, as an SVG data URI. Free, offline, always on-brand. */
export function artSvg(kind: ArtKind, palette: string[], seed = 1): string {
  const colors = palette.length ? palette : ['#f7c6d9', '#fbe4ee', '#d6e6f5', '#2b2b33']
  const r = rng(seed * 7919)
  const pick = () => colors[Math.floor(r() * colors.length)]
  const W = 800
  const H = 600
  let body = ''
  switch (kind) {
    case 'petals':
      for (let i = 0; i < 26; i++) {
        const x = r() * W
        const y = r() * H
        const s = 34 + r() * 70
        const rot = r() * 360
        body += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${rot.toFixed(0)})" opacity="${(0.55 + r() * 0.4).toFixed(2)}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="${(-s * 0.55).toFixed(0)}" rx="${(s * 0.32).toFixed(0)}" ry="${(s * 0.55).toFixed(0)}" fill="${pick()}" transform="rotate(${a})"/>`).join('')}<circle r="${(s * 0.14).toFixed(0)}" fill="${pick()}"/></g>`
      }
      break
    case 'blobs':
      for (let i = 0; i < 7; i++) {
        const cx = r() * W
        const cy = r() * H
        const s = 120 + r() * 200
        const pts = Array.from({ length: 8 }, (_, k) => {
          const a = (k / 8) * Math.PI * 2
          const rad = s * (0.75 + r() * 0.5)
          return `${(cx + Math.cos(a) * rad).toFixed(0)},${(cy + Math.sin(a) * rad).toFixed(0)}`
        }).join(' ')
        body += `<polygon points="${pts}" fill="${pick()}" opacity="${(0.5 + r() * 0.4).toFixed(2)}" stroke-linejoin="round" style="filter:blur(2px)"/>`
      }
      break
    case 'waves':
      for (let i = 0; i < 9; i++) {
        const y = (i / 9) * H + 20
        const a = 18 + r() * 34
        const f = 0.006 + r() * 0.01
        const d = Array.from({ length: 41 }, (_, k) => `${k === 0 ? 'M' : 'L'}${(k * 20).toFixed(0)},${(y + Math.sin(k * 20 * f * 6 + i) * a).toFixed(1)}`).join(' ')
        body += `<path d="${d} L${W},${H} L0,${H} Z" fill="${colors[i % colors.length]}" opacity="0.55"/>`
      }
      break
    case 'rings':
      for (let i = 0; i < 9; i++) body += `<circle cx="${(W * 0.5 + (r() - 0.5) * 200).toFixed(0)}" cy="${(H * 0.5 + (r() - 0.5) * 140).toFixed(0)}" r="${60 + i * 34}" fill="none" stroke="${pick()}" stroke-width="${(6 + r() * 16).toFixed(0)}" opacity="0.7"/>`
      break
    case 'grid':
      for (let x = 0; x <= W; x += 50) body += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${colors[colors.length - 1]}" stroke-width="1" opacity="0.28"/>`
      for (let y = 0; y <= H; y += 50) body += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${colors[colors.length - 1]}" stroke-width="1" opacity="0.28"/>`
      for (let i = 0; i < 14; i++) body += `<rect x="${Math.floor(r() * 15) * 50}" y="${Math.floor(r() * 11) * 50}" width="50" height="50" fill="${pick()}" opacity="0.6"/>`
      break
    case 'grain':
      for (let i = 0; i < 900; i++) body += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="${pick()}" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`
      break
    case 'stripes':
      for (let i = 0; i < 16; i++) body += `<rect x="${(i * W) / 16}" y="0" width="${W / 16 + 1}" height="${H}" fill="${colors[i % colors.length]}" opacity="${(0.55 + (i % 3) * 0.15).toFixed(2)}"/>`
      break
    case 'dots':
      for (let y = 30; y < H; y += 46) for (let x = 30 + ((y / 46) % 2) * 23; x < W; x += 46) body += `<circle cx="${x}" cy="${y}" r="${(5 + r() * 12).toFixed(0)}" fill="${pick()}" opacity="0.75"/>`
      break
  }
  const bg = colors[0]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

/**
 * The palette colors as hex for art, lightest first. Near-black inks are left out (art in ink looks like
 * dirt on a soft palette) unless the whole palette is dark. The lightest color is skipped as the backdrop,
 * so the picture stands apart from a page that uses it as its surface.
 */
export function artPalette(colors: Record<string, string>): string[] {
  const all = Object.values(colors)
    .map((v) => ({ v, rgb: parseColor(v) }))
    .filter((e): e is { v: string; rgb: RGB } => e.rgb !== null)
    .sort((a, b) => luminance(b.rgb) - luminance(a.rgb))
  const soft = all.filter((e) => luminance(e.rgb) > 0.15)
  const use = (soft.length >= 3 ? soft : all).map((e) => toHex(e.rgb))
  return use.length >= 4 ? [...use.slice(1), use[0]] : use
}

/* ------------------------------------------------------------------ *
 *  Deriving everything, and merging what the model chose
 * ------------------------------------------------------------------ */

export function deriveFonts(tokens: DesignTokens): FontSpec[] {
  // keep whatever catalog families the stacks already name; otherwise no web font is loaded
  const out: FontSpec[] = []
  for (const [role, stack] of Object.entries(tokens.font)) {
    const first = stack.split(',')[0].replace(/['"]/g, '').trim()
    const f = catalogFont(first)
    if (f) out.push({ role, family: f.family, weights: f.weights.filter((w) => [400, 500, 600, 700].includes(w)) })
  }
  return out
}

export function deriveExtras(system: Pick<DesignSystem, 'tokens'>, brief = ''): LanguageExtras {
  const t = system.tokens
  return {
    fonts: deriveFonts(t),
    icons: deriveIcons(t),
    themes: { dark: deriveDarkTheme(t.color) },
    textAdaptations: deriveTextAdaptations(t),
    overlay: deriveOverlaySpec(t),
    images: deriveImages(t, brief),
    source: { fonts: 'derived', icons: 'derived', themes: 'derived', textAdaptations: 'derived', overlay: 'derived', images: 'derived', states: 'derived', overlays: 'derived' },
  }
}

/** Fills whatever a language is missing (built-ins, older saved styles, weak model output). Idempotent. */
export function ensureLanguage(system: DesignSystem, brief = ''): DesignSystem {
  const extras = system.extras ?? deriveExtras(system, brief)
  const hasOverlays = system.components.some((c) => c.overlay)
  const components = withStates(hasOverlays ? system.components : [...system.components, ...deriveOverlayComponents(system.tokens)], system.tokens)
  return { ...system, extras, components }
}

/** The system with its dark theme applied (colors swapped), or unchanged for light. */
export function withMode(system: DesignSystem, mode: 'light' | 'dark'): DesignSystem {
  if (mode === 'light' || !system.extras) return system
  return { ...system, tokens: { ...system.tokens, color: { ...system.tokens.color, ...system.extras.themes.dark } } }
}

/* ---------------------- validating what the model sent ---------------------- */

const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown, max = 200): string | undefined => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined)

function styleDecl(v: unknown): StyleDecl | undefined {
  const out: StyleDecl = {}
  for (const [k, val] of Object.entries(rec(v))) {
    if (/^[a-zA-Z]+$/.test(k) && (typeof val === 'string' || typeof val === 'number') && String(val).length < 300) out[k] = val
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Merges the model's second pass into a system. Everything is checked: fonts must be in the catalog,
 * icons in the pool, colors parseable. Anything invalid is ignored and the derived value stays.
 * Returns the new system and a list of what came from the model.
 */
export function mergeModelExtras(system: DesignSystem, raw: unknown): { system: DesignSystem; used: string[]; ignored: string[] } {
  const base = ensureLanguage(system)
  const extras: LanguageExtras = { ...base.extras!, source: { ...base.extras!.source } }
  let tokens = base.tokens
  let components = base.components
  const used: string[] = []
  const ignored: string[] = []
  const r = rec(raw)

  // fonts
  const fontList = Array.isArray(r.fonts) ? r.fonts : []
  const fonts: FontSpec[] = []
  for (const item of fontList) {
    const f = rec(item)
    const family = str(f.family)
    const cat = family ? catalogFont(family) : null
    if (!family || !cat) {
      if (family) ignored.push(`font "${family}" is not in the catalog`)
      continue
    }
    const role = str(f.role, 20) ?? 'body'
    const weights = (Array.isArray(f.weights) ? f.weights : []).map(Number).filter((w) => cat.weights.includes(w))
    fonts.push({ role, family: cat.family, weights: weights.length ? weights : cat.weights.filter((w) => [400, 700].includes(w)) })
  }
  if (fonts.length) {
    extras.fonts = fonts
    extras.source.fonts = 'model'
    const stacks = { ...tokens.font }
    for (const f of fonts) if (['display', 'body', 'mono', 'accent'].includes(f.role)) stacks[f.role] = fontStack(f.family)
    tokens = { ...tokens, font: stacks }
    used.push('fonts')
  }

  // icons
  const ic = rec(r.icons)
  const glyphs = (Array.isArray(ic.glyphs) ? ic.glyphs : []).filter(isIconName)
  if (glyphs.length >= 6) {
    extras.icons = {
      glyphs: [...new Set(glyphs)].slice(0, 24),
      stroke: Math.max(1, Math.min(3, Number(ic.stroke) || extras.icons.stroke)),
      size: Math.max(14, Math.min(32, Number(ic.size) || extras.icons.size)),
      cap: ic.cap === 'square' ? 'square' : ic.cap === 'round' ? 'round' : extras.icons.cap,
      container: (['none', 'circle', 'rounded', 'square'] as const).find((c) => c === ic.container) ?? extras.icons.container,
      note: str(ic.note, 240),
    }
    extras.source.icons = 'model'
    used.push('icons')
  } else if (Object.keys(ic).length) ignored.push('icons: fewer than 6 valid names')

  // color adaptations
  const dark = rec(rec(r.themes).dark)
  const validDark: Record<string, string> = {}
  for (const [name, value] of Object.entries(dark)) if (name in tokens.color && typeof value === 'string' && parseColor(value)) validDark[name] = value
  if (Object.keys(validDark).length >= Math.max(2, Math.floor(Object.keys(tokens.color).length / 3))) {
    extras.themes = { dark: { ...extras.themes.dark, ...validDark } }
    extras.source.themes = 'model'
    used.push('themes')
  }

  // text adaptations
  const ta = rec(r.textAdaptations)
  const surfaces: SurfacePair[] = []
  for (const s of Array.isArray(ta.surfaces) ? ta.surfaces : []) {
    const p = rec(s)
    const name = str(p.name, 40)
    const bg = str(p.bg, 60)
    const text = str(p.text, 60)
    if (name && bg && text && colorOf(bg, tokens.color) && colorOf(text, tokens.color)) surfaces.push({ name, bg, text, muted: str(p.muted, 60) ?? text })
  }
  const rules = (Array.isArray(ta.rules) ? ta.rules : []).map((x) => str(x, 160)).filter((x): x is string => !!x).slice(0, 8)
  if (surfaces.length >= 2 || rules.length >= 2) {
    extras.textAdaptations = {
      surfaces: surfaces.length >= 2 ? surfaces : extras.textAdaptations.surfaces,
      scales: extras.textAdaptations.scales,
      rules: rules.length >= 2 ? rules : extras.textAdaptations.rules,
    }
    extras.source.textAdaptations = 'model'
    used.push('textAdaptations')
  }

  // overlays
  const ov = rec(r.overlays)
  const scrim = str(ov.scrim, 80)
  if (scrim && parseColor(scrim)) extras.overlay = { scrim, blur: str(ov.blur, 20) ?? extras.overlay.blur, motion: str(ov.motion, 40) ?? extras.overlay.motion }
  const own: ComponentDef[] = []
  for (const item of Array.isArray(ov.components) ? ov.components : []) {
    const o = rec(item)
    const kind = OVERLAY_KINDS.find((k) => k === o.overlay || k === o.kind)
    const name = str(o.name, 40)
    const baseStyle = styleDecl(o.base)
    if (kind && name && baseStyle && !own.some((c) => c.name === name)) {
      own.push({ name, role: str(o.role, 160) ?? OVERLAY_ROLE[kind], description: str(o.description, 300) ?? OVERLAY_ROLE[kind], preview: str(o.preview, 80) ?? name, base: baseStyle, overlay: kind })
    }
  }
  if (own.length >= 2) {
    // keep a derived one for any kind the model skipped, so the set stays complete
    const kinds = new Set(own.map((c) => c.overlay))
    const filler = deriveOverlayComponents(tokens).filter((c) => !kinds.has(c.overlay))
    components = [...components.filter((c) => !c.overlay), ...own, ...filler]
    extras.source.overlays = 'model'
    used.push('overlays')
  }

  // states
  const st = rec(r.states)
  let stateCount = 0
  components = components.map((c) => {
    const given = rec(st[c.name])
    const states: Record<string, StyleDecl> = {}
    for (const [k, v] of Object.entries(given)) {
      const d = styleDecl(v)
      if (d && /^[a-z][a-zA-Z-]{1,20}$/.test(k)) states[k] = d
    }
    if (Object.keys(states).length >= 2) {
      stateCount++
      // the model's states win; derived ones fill any state it left out
      return { ...c, states: { ...deriveStates(c, tokens), ...states } }
    }
    return c
  })
  if (stateCount) {
    extras.source.states = 'model'
    used.push('states')
  }

  // images
  const im = rec(r.images)
  const art = ART_KINDS.find((a) => a === im.art)
  const treatments: ImageTreatment[] = []
  for (const item of Array.isArray(im.treatments) ? im.treatments : []) {
    const t = rec(item)
    const name = str(t.name, 40)
    const ratio = str(t.ratio, 12)
    if (name && ratio && /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(ratio)) {
      treatments.push({ name, ratio: ratio.replace(/\s+/g, ''), radius: str(t.radius, 40) ?? '12px', filter: str(t.filter, 120), overlay: str(t.overlay, 200), frame: str(t.frame, 60) })
    }
  }
  if (art || treatments.length >= 3) {
    extras.images = {
      art: art ?? extras.images.art,
      treatments: treatments.length >= 3 ? treatments : extras.images.treatments,
      direction: str(im.direction, 400) ?? extras.images.direction,
    }
    extras.source.images = 'model'
    used.push('images')
  }

  return { system: { ...base, tokens, components, extras }, used, ignored }
}

/* ------------------------------------------------------------------ *
 *  The second model pass
 * ------------------------------------------------------------------ */

export function extrasSystemPrompt(): string {
  const fonts = FONT_CATALOG.map((f) => `${f.family} (${f.kind}; ${f.mood}; weights ${f.weights.join('/')})`).join('\n- ')
  return `You are completing a design language that already has its palette, type scale, spacing, radii, shadows, components and one composed page. A real design language also defines the parts below. Choose each one FOR THIS LANGUAGE, from its philosophy and brief, and return ONE JSON object and nothing else.

{
  "fonts": [ { "role": "display", "family": "<from FONT CATALOG>", "weights": [400, 700] }, { "role": "body", "family": "<from FONT CATALOG>", "weights": [400, 600] }, { "role": "mono", ... optional } ],
  "icons": { "glyphs": [ 12–20 names from ICON POOL ], "stroke": 1.5–2.5, "size": 18–24, "cap": "round" | "square", "container": "none" | "circle" | "rounded" | "square", "note": "one sentence on how icons are drawn and used" },
  "states": { "<ComponentName>": { "hover": {…}, "focus": {…}, "active": {…}, "disabled": {…}, "loading": {…}, "error": {…}, "selected": {…} } },
  "themes": { "dark": { "<colorTokenName>": "<hex for the dark theme>" } },
  "textAdaptations": { "surfaces": [ { "name": "On dark", "bg": "$color.x", "text": "$color.y", "muted": "$color.z or hex" } ], "rules": [ 4–6 short rules for how text adapts: measure, truncation, size on mobile, emphasis on colored surfaces ] },
  "overlays": { "scrim": "rgba(...)", "blur": "6px", "motion": "180ms ease-out", "components": [ { "name": "Modal", "overlay": "modal", "role": "...", "preview": "...", "base": {…} }, … one each of: modal, drawer, popover, tooltip, toast, menu ] },
  "images": { "art": "petals" | "blobs" | "waves" | "rings" | "grid" | "grain" | "stripes" | "dots", "treatments": [ { "name": "Hero", "ratio": "16/9", "radius": "$radius.x", "filter": "optional CSS filter", "overlay": "optional CSS gradient", "frame": "optional CSS border" }, … 4–6 ], "direction": "2 sentences of photography / illustration direction" }
}

RULES:
- Style values are camelCase CSS, and may use "$" token references ("$color.ink", "$space.md", "$radius.soft", "$shadow.lift"). Use ONLY token names that exist in the language you are given.
- STATES: cover every interactive component (buttons, inputs, tabs, chips, nav items, toggles) with at least hover, focus, active, disabled; add loading, error and selected where they make sense. A state is a PARTIAL override (only what changes). Make them feel like this language: a soft language lifts and glows, a sharp one inverts.
- FONTS: pick from the FONT CATALOG only (other names are ignored). Pair a display face with a body face that share a mood with the brief. If the brief points to a culture or script (for example Japanese), choose a face that supports it.
- ICONS: pick names from the ICON POOL only. The set must suit the brief's world (a floral, Japanese brief wants Flower2, Leaf, Sprout, Sun, not Terminal).
- THEMES: give a dark-theme value for EVERY color token, keeping each color's role (a cream surface becomes a deep tinted surface, an ink becomes a light ink) and staying inside the palette's mood.
- OVERLAYS: build them from the language's own surface, radius and shadow. The tooltip is inverted. All six kinds are required.
- No commentary, no markdown fences.

FONT CATALOG:
- ${fonts}

ICON POOL: ${ICON_POOL.join(', ')}`
}

/** The language as the model sees it in the second pass (compact). */
export function extrasUserPrompt(system: DesignSystem, brief: string): string {
  return `BRIEF: ${brief || '(none given)'}

THE LANGUAGE SO FAR:
${JSON.stringify(
    {
      name: system.name,
      philosophy: system.philosophy,
      experienceNotes: system.experienceNotes,
      tokens: system.tokens,
      components: system.components.map((c) => ({ name: c.name, role: c.role, base: c.base, variants: c.variants ? Object.keys(c.variants) : [] })),
    },
    null,
    1,
  )}`
}
