import Anthropic from '@anthropic-ai/sdk'
import { log, tick } from './log'
import { catalogFont, FONT_CATALOG, isIconName } from './language'
import { ICON_POOL } from './iconNames'
import { getLibrary, libraryPrompt, type LibraryId, type PropRecord, type PropValue } from './realui/catalog'

/* ================================================================== *
 *  AI layer — schema, strict system instruction, class sanitizer,
 *  and provider adapters (Gemini / OpenCode Zen / Claude / OpenAI / Groq).
 *
 *  Every provider receives the same system instruction and must emit
 *  one JSON object matching GeneratedLayout. Classes are constrained
 *  to a vocabulary that is pre-compiled by Tailwind via the
 *  @source inline() safelist in index.css — the sanitizer below is
 *  the runtime mirror of that safelist.
 * ================================================================== */

export interface CanvasNode {
  id: string
  /** 'component' is a REAL library component (see realui/catalog.ts). */
  type: 'container' | 'text' | 'image' | 'icon' | 'button' | 'grid' | 'component'
  label: string
  classes: string // Tailwind CSS strings
  children?: CanvasNode[]
  content?: string
  /** type 'component' only: the catalog name, e.g. "Button". */
  component?: string
  /** type 'component' only: props from the catalog. */
  props?: Record<string, PropValue>
  /** Root node only: which real library the whole tree renders with. */
  library?: LibraryId
  /** Root node only: the fonts the design uses (families from FONT_CATALOG). */
  fonts?: DesignFonts
  /** type 'icon' only: a name from ICON_POOL. */
  icon?: string
  /** type 'image' only: the subject (a SceneKind such as "cup" or "portrait"), a description, and alt text. */
  art?: string
  prompt?: string
  alt?: string
  /** type 'image' only: a generated picture (data URL). It replaces the drawn scene. */
  src?: string
}

export interface DesignFonts {
  heading: string
  body: string
}

export interface GeneratedLayout {
  frameLabel: string
  frameClasses: string
  sections: CanvasNode[]
  library?: LibraryId
  fonts?: DesignFonts
}

/* ------------------------------------------------------------------ *
 *  Provider registry + config (persisted in localStorage)
 * ------------------------------------------------------------------ */

export type ProviderId = 'gemini' | 'zen' | 'claude' | 'openai' | 'groq'

export interface ModelOption {
  id: string
  label: string
}

export interface ProviderMeta {
  id: ProviderId
  label: string
  keyHint: string
  note?: string
  /** Curated, newest first. The first entry is the default model. */
  models: ModelOption[]
}

/**
 * Order matters: Gemini is the default provider, OpenCode Zen is the second
 * default. Model ids come from each provider's own docs / live model list.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    label: 'Gemini (Google)',
    keyHint: 'AIza…',
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
    ],
  },
  {
    id: 'zen',
    label: 'OpenCode Zen',
    keyHint: 'Zen API key',
    note: 'Zen is pay-as-you-go: you are billed per token. Prices shown are $ per million tokens, input / output. Zen sends no CORS headers, so requests go through the local dev server (/zen-proxy): run npm run dev or npm run preview. Zen free models only work inside OpenCode.',
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 · $1 / $5 · fast, no thinking' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 · $2 / $10' },
      { id: 'claude-opus-5', label: 'Claude Opus 5 · $5 / $25' },
      { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra · $2 / $12' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash · $1.50 / $7.50' },
      { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro · $2 / $12' },
      { id: 'grok-4.6', label: 'Grok 4.6' },
      { id: 'kimi-k3', label: 'Kimi K3 · $3 / $15' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro · $1.74 / $3.48' },
      { id: 'glm-5.3', label: 'GLM 5.3 · $1.40 / $4.40' },
      { id: 'minimax-m3', label: 'MiniMax M3 · $0.30 / $1.20' },
    ],
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    keyHint: 'sk-ant-…',
    models: [
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyHint: 'sk-…',
    models: [
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    keyHint: 'gsk_…',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (preview)' },
    ],
  },
]

export const DEFAULT_PROVIDER: ProviderId = PROVIDERS[0].id

export type Effort = 'low' | 'medium' | 'high'

export const EFFORTS: Array<{ id: Effort; label: string; hint: string }> = [
  { id: 'low', label: 'Low — fastest', hint: 'The model barely thinks before it writes the layout. Best for most pages.' },
  { id: 'medium', label: 'Medium', hint: 'Some planning first. Usually 10–40 seconds slower.' },
  { id: 'high', label: 'High — slowest', hint: 'Deep reasoning first. Can take minutes on large prompts.' },
]

/** Layout generation is mostly writing, not puzzle solving: think little by default. */
export const DEFAULT_EFFORT: Effort = 'low'

/** Providers whose models spend time thinking before they answer. */
export const providerHasEffort = (id: ProviderId) => id === 'claude' || id === 'openai' || id === 'zen'

export interface ProviderProfile {
  apiKey: string
  /** '' means "use the provider's default model". */
  model: string
  effort?: Effort
}

/**
 * `provider`, `model` and `apiKey` describe the ACTIVE provider — every call
 * site reads those. `profiles` remembers the key + model of each provider, so
 * switching providers never leaks one provider's key into another.
 */
export interface AIConfig {
  provider: ProviderId
  model: string
  apiKey: string
  /** How much the model may think before answering (see EFFORTS). */
  effort: Effort
  profiles: Partial<Record<ProviderId, ProviderProfile>>
}

const CONFIG_KEY = 'canvas-agent-ai-config'

export function providerMeta(id: ProviderId): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}

export function defaultModel(id: ProviderId): string {
  return providerMeta(id).models[0].id
}

/** Point the config at another provider, restoring that provider's saved key + model. */
export function switchProvider(config: AIConfig, next: ProviderId): AIConfig {
  const profiles = { ...config.profiles, [config.provider]: { apiKey: config.apiKey, model: config.model, effort: config.effort } }
  const saved = profiles[next]
  return { provider: next, model: saved?.model ?? '', apiKey: saved?.apiKey ?? '', effort: saved?.effort ?? DEFAULT_EFFORT, profiles }
}

/** Fold the active provider's key + model back into `profiles` (call before saving). */
export function commitProfile(config: AIConfig): AIConfig {
  return { ...config, profiles: { ...config.profiles, [config.provider]: { apiKey: config.apiKey, model: config.model, effort: config.effort } } }
}

export function loadConfig(): AIConfig {
  const fresh: AIConfig = { provider: DEFAULT_PROVIDER, model: '', apiKey: '', effort: DEFAULT_EFFORT, profiles: {} }
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw)
    const profiles: AIConfig['profiles'] = {}
    for (const p of PROVIDERS) {
      const entry = saved?.profiles?.[p.id]
      if (entry) profiles[p.id] = { apiKey: String(entry.apiKey ?? ''), model: String(entry.model ?? ''), effort: EFFORTS.some((e) => e.id === entry.effort) ? entry.effort : DEFAULT_EFFORT }
    }
    // Pre-profiles format: one flat provider/model/apiKey. 'openzen' pointed at a
    // made-up endpoint, so it is dropped rather than migrated.
    if (!saved?.profiles && PROVIDERS.some((p) => p.id === saved?.provider)) {
      profiles[saved.provider as ProviderId] = { apiKey: String(saved.apiKey ?? ''), model: String(saved.model ?? '') }
    }
    const provider: ProviderId = PROVIDERS.some((p) => p.id === saved?.provider) ? saved.provider : DEFAULT_PROVIDER
    const active = profiles[provider]
    return { provider, model: active?.model ?? '', apiKey: active?.apiKey ?? '', effort: active?.effort ?? DEFAULT_EFFORT, profiles }
  } catch {
    return fresh // corrupted config falls through to defaults
  }
}

export function saveConfig(config: AIConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(commitProfile(config)))
}

export function resolvedModel(config: AIConfig): string {
  return config.model.trim() || defaultModel(config.provider)
}

/* ------------------------------------------------------------------ *
 *  The strict system instruction (shared by every model)
 * ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `You are a UI generation engine for a live design canvas. You translate a request into a canvas layout expressed as JSON.

OUTPUT CONTRACT — follow exactly:
Return ONE JSON object and NOTHING else. No markdown fences, no commentary, no trailing text.
Shape:
{
  "frameLabel": "Frame · <short-slug>",
  "frameClasses": "<Tailwind classes for the page frame: background color (+ optional default text color)>",
  "fonts": { "heading": "<family from FONT LIST>", "body": "<family from FONT LIST>" },
  "sections": [ CanvasNode, ... ]
}
"sections" is 2–5 top-level page sections, stacked vertically inside the frame.

CanvasNode schema:
{
  "id": "<unique-kebab-case-string>",
  "type": "container" | "grid" | "text" | "button" | "image" | "icon",
  "label": "<short human name, e.g. 'Hero', 'Stat card'>",
  "classes": "<space-separated Tailwind utilities from the ALLOWED VOCABULARY only>",
  "children": [CanvasNode, ...],   // ONLY on container/grid
  "content": "<string>",           // ONLY on text/button
  "icon": "<name from ICON LIST>", // ONLY on icon nodes
  "art": "<landscape|skyline|portrait|product|cup|chart|food|device|abstract>", // ONLY on image nodes: what the picture shows
  "alt": "<short alt text>", "prompt": "<one sentence describing the picture>"   // ONLY on image nodes
}

CANVAS: the page frame is a 1200px-wide desktop viewport. Design for that width — generous horizontal layouts, multi-column heroes (asymmetric splits, side-by-side content + visual), 3–4 column grids, wide stat strips. Cap long text runs with max-w-xl/2xl/3xl so line length stays readable; center or offset content blocks deliberately inside the width rather than letting everything stretch edge to edge.

HARD RULES:
- 25–60 nodes total. Maximum nesting depth 5. Every id unique.
- "image" nodes are PICTURES: photos, product shots, illustrations, avatars, chart pictures. Give each size classes (w-… h-… rounded-…) plus "art", "alt" and "prompt"; the app draws a matching illustration into it. An image node WITHOUT art/alt/prompt is only a plain decorative block (a bar, a gradient chip). Image nodes have no children and no content.
- "icon" nodes are single symbols (see ICONS, IMAGES AND FONTS). They have no children and no content.
- Give each section its own horizontal padding (px-8..px-14) and vertical padding; sections own their background color.
- Use ONLY classes from the ALLOWED VOCABULARY. Never use: arbitrary values (w-[500px]), responsive prefixes (sm:, md:, lg:), state variants (hover:, focus:), or any utility not listed. Unknown classes are stripped and your design degrades.
- Opacity modifiers exist only as {bg,text,border,ring}-{white,black}/{5,10,20,30,40,50,60,70,80,90}.
- Write real, specific copy for the subject — never lorem ipsum, never placeholder text like "Title here".

ICONS, IMAGES AND FONTS — every design uses all three:
- ICONS: use "icon" nodes. Put one before every feature, benefit, step, stat, contact line and list item, and beside key nav or section titles. Size with classes (size-5, size-6, size-8), color with a text color class. The name must come from ICON LIST and should fit the meaning (Truck for shipping, Leaf for organic). A row of features WITHOUT icons is wrong. Use 6–20 icons per design.
- IMAGES: use "image" nodes for every hero picture, product shot, card photo, gallery item, team member and testimonial avatar (size-12 rounded-full, art "portrait"). Never leave picture space empty and never draw a picture with plain containers. Use 3–10 images per design. "art" says what it shows; "prompt" describes it in one sentence so a real picture can be made from it later.
- FONTS: always set "fonts": pick a heading and a body family that fit the tone (artisan or warm → a serif heading with a friendly sans body; technical → a grotesk or mono; playful → a rounded; Japanese themes → a JP family). Use only families from FONT LIST.
ICON LIST: ${ICON_POOL.join(', ')}
FONT LIST: ${FONT_CATALOG.map((f) => `${f.family} (${f.mood})`).join('; ')}

ALLOWED VOCABULARY:
- Display/layout: flex, inline-flex, grid, block, inline-block, hidden, flex-row, flex-col, flex-wrap, flex-1, grow, shrink-0, items-{start,center,end,stretch,baseline}, justify-{start,center,end,between,around,evenly}, self-{auto,start,center,end,stretch}, grid-cols-{1..6}, col-span-{1..6}, row-span-{1..6}, relative, overflow-hidden, mx-auto, ml-auto, mr-auto, mt-auto, aspect-square, aspect-video
- Spacing (scale 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24): p-, px-, py-, pt-, pb-, pl-, pr-, gap-, gap-x-, gap-y-; margins m-, mx-, my-, mt-, mb-, ml-, mr- (scale 0,1,2,3,4,5,6,8,10,12,16,auto)
- Sizing: w-{full,fit,auto,1/2,1/3,2/3,1/4,3/4,1/5,2/5,3/5,4/5}, w/h/size-{1..12,14,16,20,24,28,32,36,40,44,48,52,56,60,64,72,80,96}, h-{full,auto}, min-h-{16,24,32,40,48,64}, max-w-{3xs,2xs,xs,sm,md,lg,xl,2xl,3xl,4xl,full}
- Typography: text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}, font-{light,normal,medium,semibold,bold,extrabold,black}, font-{sans,serif,mono}, tracking-{tighter,tight,normal,wide,wider,widest}, leading-{none,tight,snug,normal,relaxed,loose}, text-{left,center,right}, uppercase, italic, underline, line-through, truncate, whitespace-nowrap, text-balance
- Color (families: slate, gray, zinc, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose; shades 50, 100..900, 950): bg-{family}-{shade}, text-…, border-…, ring-…, from-…, via-…, to-…; plus bg/text/border-{white,black,transparent}; gradients via bg-gradient-to-{t,tr,r,br,b,bl,l,tl} with from-/via-/to-
- Borders & effects: border, border-0, border-2, border-4, border-{t,b,l,r,x,y}, divide-{x,y}, rounded, rounded-{none,sm,md,lg,xl,2xl,3xl,full}, rounded-{t,b,l,r}-{sm,md,lg,xl,2xl,full}, shadow, shadow-{sm,md,lg,xl,2xl,inner,none}, opacity-{0..100 in steps}, backdrop-blur

DESIGN DIRECTION — this is where you show range:
- Commit to ONE distinct aesthetic per request and push it hard. Choose deliberately: a neutral family (zinc/stone/slate/gray), 1–2 accent families, light or dark mode, a radius personality (sharp rounded-none vs pill rounded-full vs soft rounded-2xl), and a density (airy py-16/py-20 vs compact py-6/py-8).
- Derive the palette from the subject: a legal firm is not the same palette as a skate brand. Avoid defaulting to the same blue-on-white every time.
- Vary structure between requests: asymmetric two-column heroes, centered editorial heroes, stat strips, 2–4 column card grids, split banners, testimonial rows, data tables built from rows of containers. Do not emit the same hero/features/CTA template unless the request asks for it.
- Dark designs: near-black background (bg-zinc-950, bg-slate-950...), light text, accents via saturated color + border-{white}/10 hairlines. Light designs: white/stone-50 background, near-black text, one confident accent.
- Buttons must look pressable: horizontal padding, rounded, contrasting background or border.
- Use image nodes (with art/alt/prompt) generously for visual rhythm: gradient avatars, icon chips, chart bars (a row of flex items-end bars with varying h-), photo stand-ins with aspect-video and a gradient.`

/* ------------------------------------------------------------------ *
 *  Class sanitizer — runtime mirror of the @source inline() safelist
 * ------------------------------------------------------------------ */

const COLOR = '(?:slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
const SHADE = '(?:50|[1-9]00|950)'
const SPACE = '(?:0|0\\.5|1|1\\.5|2|2\\.5|3|3\\.5|4|5|6|7|8|9|10|11|12|14|16|20|24)'
const SIZE = '(?:[1-9]|1[0-2]|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96)'

const ALLOWED_CLASS_PATTERNS: RegExp[] = [
  new RegExp(`^(?:bg|text|border|from|via|to|ring)-${COLOR}-${SHADE}$`),
  /^(?:bg|text|border)-(?:white|black|transparent)$/,
  /^(?:bg|text|border|ring)-(?:white|black)\/(?:5|10|20|30|40|50|60|70|80|90)$/,
  /^bg-gradient-to-(?:t|tr|r|br|b|bl|l|tl)$/,
  new RegExp(`^(?:p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y)-${SPACE}$`),
  /^(?:m|mx|my|mt|mb|ml|mr)-(?:0|1|2|3|4|5|6|8|10|12|16|auto)$/,
  /^space-(?:x|y)-(?:1|2|3|4|6|8)$/,
  /^w-(?:full|fit|auto|1\/2|1\/3|2\/3|1\/4|3\/4|1\/5|2\/5|3\/5|4\/5)$/,
  new RegExp(`^(?:w|h|size)-${SIZE}$`),
  /^h-(?:full|auto)$/,
  /^min-h-(?:16|24|32|40|48|64)$/,
  /^max-w-(?:3xs|2xs|xs|sm|md|lg|xl|2xl|3xl|4xl|full)$/,
  /^text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/,
  /^font-(?:thin|light|normal|medium|semibold|bold|extrabold|black|sans|serif|mono)$/,
  /^tracking-(?:tighter|tight|normal|wide|wider|widest)$/,
  /^leading-(?:none|tight|snug|normal|relaxed|loose)$/,
  /^text-(?:left|center|right)$/,
  /^(?:uppercase|lowercase|capitalize|italic|underline|line-through|truncate|whitespace-nowrap|text-balance)$/,
  /^(?:flex|inline-flex|grid|block|inline-block|hidden)$/,
  /^flex-(?:row|col|wrap|1|auto|none)$/,
  /^items-(?:start|center|end|stretch|baseline)$/,
  /^justify-(?:start|center|end|between|around|evenly)$/,
  /^self-(?:auto|start|center|end|stretch)$/,
  /^(?:grow|shrink|shrink-0)$/,
  /^grid-cols-[1-6]$/,
  /^(?:col|row)-span-[1-6]$/,
  /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/,
  /^rounded-(?:t|b|l|r)-(?:sm|md|lg|xl|2xl|full)$/,
  /^border(?:-(?:0|2|4))?$/,
  /^border-(?:t|b|l|r|x|y)$/,
  /^divide-(?:x|y)$/,
  /^shadow(?:-(?:sm|md|lg|xl|2xl|inner|none))?$/,
  /^opacity-(?:0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)$/,
  // shadcn/ui semantic colors (defined by the .shadcn-scope theme)
  /^(?:bg|text|border)-(?:background|foreground|card|card-foreground|muted|muted-foreground|primary|primary-foreground|secondary|secondary-foreground|accent|accent-foreground|destructive|border|input)$/,
  /^(?:bg|text|border)-(?:background|foreground|card|muted|muted-foreground|primary|secondary|accent|destructive|border)\/(?:10|20|30|40|50|60|70|80|90)$/,
  // HeroUI colors (defined by the .heroui-scope theme)
  /^(?:bg|text|border)-(?:background|foreground|surface|surface-foreground|surface-secondary|surface-tertiary|overlay|muted|default|default-foreground|accent|accent-foreground|success|success-foreground|warning|warning-foreground|danger|danger-foreground|border|separator|field)$/,
  /^(?:bg|text|border)-(?:surface|accent|default|success|warning|danger|muted|border)\/(?:10|20|30|40|50|60|70|80|90)$/,
  // Relume role colors (defined by the .relume-scope theme)
  /^bg-background-(?:primary|secondary|tertiary|alternative|success|error)$/,
  /^text-text-(?:primary|secondary|alternative|success|error)$/,
  /^border-border-(?:primary|secondary|tertiary|alternative|success|error)$/,
  /^(?:text-md|text-8xl|text-9xl|text-10xl|max-w-xxs|max-w-xxl|px-\[5%\]|shadow-(?:xxsmall|xsmall|small|medium|large))$/,
  /^(?:py|pt|pb)-(?:28|32)$/, // Relume section rhythm (112px, 128px)
  /^(?:overflow-hidden|overflow-auto|relative|mx-auto|ml-auto|mr-auto|mt-auto|mb-auto|object-cover|aspect-square|aspect-video|backdrop-blur)$/,
]

export function isAllowedClass(token: string): boolean {
  return ALLOWED_CLASS_PATTERNS.some((re) => re.test(token))
}

/** Palette colors and gradients. A real library's theme owns color, so these are removed there. */
const PALETTE_COLOR = new RegExp(`^(?:bg|text|border|from|via|to|ring)-${COLOR}-${SHADE}(?:/\\d+)?$`)
const PALETTE_BASIC = /^(?:(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?|bg-gradient-to-(?:t|tr|r|br|b|bl|l|tl))$/
export const isPaletteColor = (token: string) => PALETTE_COLOR.test(token) || PALETTE_BASIC.test(token)

function sanitizeClasses(value: unknown, dropped: Set<string>, themeStripped?: Set<string>): string {
  if (typeof value !== 'string') return ''
  const kept: string[] = []
  for (const token of value.split(/\s+/).filter(Boolean)) {
    if (themeStripped && isPaletteColor(token)) themeStripped.add(token)
    else if (isAllowedClass(token)) kept.push(token)
    else dropped.add(token)
  }
  return kept.join(' ')
}

/** How much of a design is made of real library components (icons do not count). */
export function componentStats(root: CanvasNode): { components: number; total: number } {
  let components = 0
  let total = 0
  const walk = (n: CanvasNode) => {
    total++
    if (n.type === 'component' && n.component !== 'Icon') components++
    n.children?.forEach(walk)
  }
  walk(root)
  return { components, total }
}

/* ------------------------------------------------------------------ *
 *  Response parsing + AST validation
 * ------------------------------------------------------------------ */

const NODE_TYPES = new Set(['container', 'grid', 'text', 'button', 'image', 'icon', 'component'])
const MAX_NODES = 90
const MAX_DEPTH = 6
/** Real components nest deeper by design: Tabs › TabsContent › Table › TableBody › TableRow › TableCell. */
const MAX_DEPTH_REAL = 10
const MAX_RECORDS = 30

export interface ValidationResult {
  layout: GeneratedLayout
  droppedClasses: string[]
  nodeCount: number
  /** Real-component repairs (unknown component, wrong nesting…). */
  warnings: string[]
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('model returned no JSON object')
  return JSON.parse(cleaned.slice(start, end + 1))
}

/** The font pairing, if both families are in the catalog. One family given fills both roles. */
export function cleanFonts(raw: unknown): DesignFonts | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const pick = (v: unknown) => (typeof v === 'string' ? catalogFont(v)?.family : undefined)
  const heading = pick(o.heading) ?? pick(o.body)
  const body = pick(o.body) ?? pick(o.heading)
  return heading && body ? { heading, body } : null
}

export function validateLayout(raw: unknown, libraryId?: LibraryId | null, opts: { partial?: boolean } = {}): ValidationResult {
  const lib = getLibrary(libraryId)
  const dropped = new Set<string>()
  const warnings = new Set<string>()
  const themeStripped = new Set<string>() // palette classes removed in real-library mode
  const seenIds = new Set<string>()
  let counter = 0
  let total = 0

  const obj = (raw ?? {}) as Record<string, unknown>
  const sectionsSource = [obj.sections, obj.children, obj.blocks].find((v) => Array.isArray(v) && v.length > 0)
  const rawSections = (sectionsSource as unknown[] | undefined) ?? null
  if (!rawSections) {
    throw new Error(`response has no "sections" array (top-level keys: ${Object.keys(obj).join(', ') || 'none'})`)
  }

  /** A list of flat rows: plain values only, capped. Every row gets a `key` (React and Ant Design need one). */
  const cleanRecords = (value: unknown): PropRecord[] | null => {
    if (!Array.isArray(value)) return null
    const list: PropRecord[] = []
    for (const row of value.slice(0, MAX_RECORDS)) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) continue
      const clean: PropRecord = {}
      for (const [k, v] of Object.entries(row as Record<string, unknown>).slice(0, 12)) {
        if (typeof v === 'string') clean[k] = v.slice(0, 400)
        else if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v
        else if (typeof v === 'boolean') clean[k] = v
      }
      if (Object.keys(clean).length === 0) continue
      if (clean.key === undefined) clean.key = String(list.length + 1)
      list.push(clean)
    }
    return list
  }

  /** Keeps only props the catalog lists, with values of the right kind. */
  const cleanProps = (specProps: NonNullable<import('./realui/catalog').ComponentSpec['props']>, given: unknown) => {
    const out: Record<string, PropValue> = {}
    if (typeof given !== 'object' || given === null) return out
    for (const [key, value] of Object.entries(given as Record<string, unknown>)) {
      const spec = specProps[key]
      if (!spec) {
        warnings.add(`Dropped unknown prop “${key}”`)
        continue
      }
      if (spec.kind === 'enum') {
        if (typeof value === 'string' && spec.values!.includes(value)) out[key] = value
        else warnings.add(`Dropped invalid value for “${key}”`)
      } else if (spec.kind === 'string') {
        if (typeof value === 'string' || typeof value === 'number') out[key] = String(value)
      } else if (spec.kind === 'number') {
        const n = Number(value)
        if (Number.isFinite(n)) out[key] = n
      } else if (spec.kind === 'boolean') {
        out[key] = value === true || value === 'true'
      } else if (spec.kind === 'records') {
        const list = cleanRecords(value)
        if (list) out[key] = list
      }
    }
    return out
  }

  const coerce = (input: unknown, depth: number, ancestors: string[]): CanvasNode | null => {
    if (total >= MAX_NODES || depth > (lib ? MAX_DEPTH_REAL : MAX_DEPTH) || typeof input !== 'object' || input === null) return null
    const n = input as Record<string, unknown>
    // Mid-stream the node's id / type / component may still be half-written ("Table" on its way to "TableRow"): wait for the whole word.
    if (opts.partial && (n.__incomplete === true || !NODE_TYPES.has(n.type as string))) return null
    total++
    let id = typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `node-${++counter}`
    while (seenIds.has(id)) id = `${id}-${++counter}`
    seenIds.add(id)
    let type = NODE_TYPES.has(n.type as string) ? (n.type as CanvasNode['type']) : 'container'
    const label = typeof n.label === 'string' && n.label.trim() ? n.label.trim() : type
    const classes = sanitizeClasses(n.classes, dropped, lib ? themeStripped : undefined)
    const kidsOf = (list: unknown, nextAncestors: string[]) =>
      (Array.isArray(list) ? list : []).map((c) => coerce(c, depth + 1, nextAncestors)).filter((c): c is CanvasNode => c !== null)

    // Real components: only inside a real-library design.
    let componentName = typeof n.component === 'string' ? n.component : undefined
    if (lib && type === 'button') {
      type = 'component' // the model was told not to; a plain button becomes the library's Button
      componentName = 'Button'
    }
    if (type === 'component') {
      const spec = lib?.components.find((c) => c.name === componentName)
      const missingParent = spec?.requires && !spec.requires.some((r) => ancestors.includes(r))
      // Mid-stream, a half-written name ("Tab" on its way to "TabsList") is not a mistake yet: leave the node out until the name is whole.
      if (opts.partial && lib && !spec) {
        total--
        return null
      }
      if (!lib || !spec || missingParent) {
        if (lib) {
          warnings.add(
            !spec ? `Unknown component “${componentName ?? '?'}” replaced by a plain block` : `<${spec.name}> must be inside <${spec.requires!.join('> or <')}> — replaced by a plain block`,
          )
        }
        // fall back to a plain block so the design still renders
        if (typeof n.content === 'string' && !Array.isArray(n.children)) {
          return { id, type: 'text', label, classes, content: n.content }
        }
        return { id, type: 'container', label, classes, children: kidsOf(n.children, ancestors) }
      }
      const node: CanvasNode = { id, type: 'component', component: spec.name, label, classes }
      const props = cleanProps(spec.props ?? {}, n.props)
      if (spec.autoId && !props.id) props.id = id // React Aria collections need an id
      if (Object.keys(props).length) node.props = props
      if ((spec.takes === 'text' || spec.takes === 'both') && typeof n.content === 'string') node.content = n.content
      if (spec.takes === 'children' || spec.takes === 'both') node.children = kidsOf(n.children, [...ancestors, spec.name])
      return node
    }

    const node: CanvasNode = { id, type, label, classes }
    if (type === 'icon') {
      const asked = [n.icon, n.name, n.content].find((v) => typeof v === 'string') as string | undefined
      node.icon = isIconName(asked) ? asked : 'Circle'
      if (asked && !isIconName(asked)) warnings.add(`Unknown icon “${asked}” replaced by a circle`)
      return node
    }
    if (type === 'image') {
      const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
      const art = text(n.art, 40)?.toLowerCase()
      const prompt = text(n.prompt, 300)
      const alt = text(n.alt, 160)
      if (art) node.art = art
      if (prompt) node.prompt = prompt
      if (alt) node.alt = alt
      return node
    }
    if ((type === 'text' || type === 'button') && typeof n.content === 'string') node.content = n.content
    if ((type === 'container' || type === 'grid') && Array.isArray(n.children)) node.children = kidsOf(n.children, ancestors)
    return node
  }

  const sections = rawSections.map((s) => coerce(s, 1, [])).filter((s): s is CanvasNode => s !== null)
  if (sections.length === 0) throw new Error('no valid sections survived validation')
  if (lib && themeStripped.size) {
    warnings.add(`Removed ${themeStripped.size} palette color classes (${[...themeStripped].slice(0, 3).join(', ')}…): the ${lib.label} theme owns color`)
  }

  return {
    layout: {
      frameLabel: typeof obj.frameLabel === 'string' && obj.frameLabel.trim() ? obj.frameLabel.trim() : 'Frame · generated',
      // a real library's theme owns the page background and text color
      frameClasses: lib ? lib.frameClasses : sanitizeClasses(obj.frameClasses, dropped) || 'bg-white',
      sections,
      ...(lib ? { library: lib.id } : {}),
      ...(cleanFonts(obj.fonts) ? { fonts: cleanFonts(obj.fonts)! } : {}),
    },
    droppedClasses: [...dropped],
    nodeCount: total,
    warnings: [...warnings],
  }
}

/* ------------------------------------------------------------------ *
 *  Provider adapters — all called directly from the browser with the
 *  user's own key. Keys are typed by the user in the config panel,
 *  stored in localStorage, and sent only to the selected provider.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Call watchdog — one per model request. It gives the request a
 *  timeout at every stage, reports progress to the console, the dev
 *  terminal and the feed, and turns a silent stall into a visible error.
 * ------------------------------------------------------------------ */

type CallPhase = 'connecting' | 'thinking' | 'writing'

interface CallWatch {
  readonly signal: AbortSignal
  /** Response headers arrived (any status). */
  connected(status: number): void
  /** Bytes or events arrived; `phase` says what the model is doing. */
  touch(phase?: CallPhase): void
  /** Total characters of output text received so far. */
  text(chars: number): void
  finish(chars: number): void
  /** Stops the watch and returns the error to throw (a timeout gets a clear message). */
  fail(err: unknown): Error
  cancel(): void
}

const CONNECT_TIMEOUT_MS = 60_000
const CONNECT_TIMEOUT_NO_STREAM_MS = 240_000 // a non-streamed reply sends nothing until it is done
const IDLE_TIMEOUT_MS = 120_000
const TOTAL_TIMEOUT_MS = 8 * 60_000

const activeCalls = new Set<CallWatch>()

/** Stops every request in flight (the Stop button). */
export function abortActiveCalls() {
  activeCalls.forEach((call) => call.cancel())
}

function watchCall(config: AIConfig, streaming: boolean): CallWatch {
  const scope = `${config.provider} · ${resolvedModel(config)}`
  const ctrl = new AbortController()
  const t0 = performance.now()
  const connectLimit = streaming ? CONNECT_TIMEOUT_MS : CONNECT_TIMEOUT_NO_STREAM_MS
  let lastActivity = t0
  let isConnected = false
  let phase: CallPhase = 'connecting'
  let chars = 0
  let loggedChars = 0
  let nextBeat = 5
  let abortReason: string | null = null
  const elapsed = () => (performance.now() - t0) / 1000

  const describe = () => {
    const secs = Math.floor(elapsed())
    if (phase === 'writing') return `receiving output · ${chars.toLocaleString()} chars · ${secs}s`
    if (phase === 'thinking') {
      return secs >= 30
        ? `model is thinking · ${secs}s — taking long. Stop, then lower “Thinking effort” in settings (⚙)`
        : `model is thinking · ${secs}s`
    }
    return isConnected ? `connected, waiting for the first token · ${secs}s` : `waiting for the provider · ${secs}s`
  }

  const abort = (reason: string) => {
    if (ctrl.signal.aborted) return
    abortReason = reason
    log('error', scope, `giving up — ${reason}`)
    ctrl.abort()
  }

  const timer = setInterval(() => {
    const now = performance.now()
    tick(scope, describe())
    if (elapsed() >= nextBeat) {
      nextBeat += 5
      log('info', scope, `still working — ${describe()}`)
    }
    if (!isConnected && now - t0 > connectLimit) abort(`no response from the provider after ${Math.round(connectLimit / 1000)}s`)
    else if (isConnected && now - lastActivity > IDLE_TIMEOUT_MS) abort(`no data from the provider for ${IDLE_TIMEOUT_MS / 1000}s`)
    else if (now - t0 > TOTAL_TIMEOUT_MS) abort(`the request ran longer than ${TOTAL_TIMEOUT_MS / 60_000} minutes`)
  }, 1000)

  const watch: CallWatch = {
    signal: ctrl.signal,
    connected(status) {
      isConnected = true
      lastActivity = performance.now()
      log(status >= 400 ? 'warn' : 'info', scope, `HTTP ${status} after ${elapsed().toFixed(1)}s`)
    },
    touch(next) {
      lastActivity = performance.now()
      if (next && next !== phase) {
        phase = next
        log('info', scope, next === 'thinking' ? `model is thinking (${elapsed().toFixed(1)}s in)` : `first output after ${elapsed().toFixed(1)}s`)
      }
    },
    text(n) {
      chars = n
      watch.touch('writing')
      if (n - loggedChars >= 1000) {
        loggedChars = n
        log('info', scope, `receiving output — ${n.toLocaleString()} chars`)
      }
    },
    finish(n) {
      clearInterval(timer)
      activeCalls.delete(watch)
      log('info', scope, `finished in ${elapsed().toFixed(1)}s · ${n.toLocaleString()} chars`)
    },
    fail(err) {
      clearInterval(timer)
      activeCalls.delete(watch)
      const error = abortReason
        ? new Error(`timed out — ${abortReason}`)
        : err instanceof Error
          ? err
          : new Error(String(err))
      log('error', scope, `failed after ${elapsed().toFixed(1)}s — ${error.message.slice(0, 300)}`)
      return error
    },
    cancel() {
      if (!ctrl.signal.aborted) {
        clearInterval(timer)
        activeCalls.delete(watch)
        log('warn', scope, 'cancelled by the user')
        ctrl.abort()
      }
    },
  }
  activeCalls.add(watch)
  log('info', scope, `request sent${streaming ? ' (streaming)' : ''}`)
  return watch
}

/** A recoverable hiccup: logged, and shown in the feed. */
function hiccup(config: AIConfig, msg: string) {
  log('warn', `${config.provider} · ${resolvedModel(config)}`, msg, 'step')
}

export interface ErrorReport {
  title: string
  detail: string
  hint: string
}

/** Turns a raw failure into something a person can act on. */
export function explainError(config: AIConfig, err: unknown): ErrorReport {
  const detail = (err instanceof Error ? err.message : String(err)).trim()
  const label = providerMeta(config.provider).label
  const model = resolvedModel(config)
  const rules: Array<[RegExp, string, string]> = [
    [/timed out/i, 'The provider stopped responding', `The request was cancelled by the watchdog. Try again, pick a faster model, or check ${label}'s status page.`],
    [/\b401\b|invalid api key|missing api key|unauthori[sz]ed|incorrect api key/i, 'The API key was rejected', `Open settings and check the ${label} key.`],
    [/free tier|\b403\b|forbidden|permission/i, 'Access denied', `${label} refused this request. The key may lack access to ${model}, or the model may be free-tier only inside its own app.`],
    [/\b404\b|not[ _-]found|unknown model|does not exist|no such model/i, 'Model not found', `${label} does not know "${model}". Pick another model in settings.`],
    [/\b429\b|rate.?limit|quota|insufficient|billing|credit|overloaded|\b529\b/i, 'Rate-limited, out of credit, or overloaded', `Wait a moment and retry, or switch model or provider in settings.`],
    [/\b5\d\d\b|bad gateway|unavailable/i, 'The provider had a server error', 'This is on the provider side. Retry in a moment.'],
    [/failed to fetch|networkerror|load failed|network request failed/i, 'Could not reach the provider', config.provider === 'zen' ? 'OpenCode Zen is reached through the dev server proxy. Run the app with npm run dev or npm run preview (not a static build), and check that the server is still running.' : `Check your connection and any browser extension that blocks requests to ${label}.`],
    [/validation|sections|json|schema|no text|no message|no streamed/i, 'The model answer could not be used', 'The model returned something that is not the expected layout. Retry, or pick a stronger model in settings.'],
  ]
  for (const [pattern, title, hint] of rules) if (pattern.test(detail)) return { title, detail, hint }
  return { title: 'Generation failed', detail, hint: 'Open the browser console (or the dev-server terminal) and look for [canvas-agent] lines.' }
}

/** Claude models that accept `output_config.effort` (per the Anthropic effort docs). */
const claudeSupportsEffort = (model: string) => /^claude-(fable-5|mythos|opus-(5|4[-.][5-8])|sonnet-(5|4[-.]6))/.test(model)

/** Where Zen is reachable from the browser — see the /zen-proxy entry in vite.config.ts. */
const ZEN_BASE = '/zen-proxy/v1'

async function callClaude(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onText: ((fullText: string) => void) | undefined,
  w: CallWatch,
  viaZen = false,
  useEffort = true,
): Promise<string> {
  // The SDK appends /v1/messages itself and needs an absolute base URL. Zen's
  // /messages route takes the same x-api-key header as Anthropic.
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(viaZen ? { baseURL: `${window.location.origin}/zen-proxy` } : {}),
    maxRetries: 1,
    dangerouslyAllowBrowser: true,
  })
  const MAX_TOKENS = 16000 // also the most one call can bill: thinking and answer share this cap
  const stream = client.messages.stream(
    {
      model: resolvedModel(config),
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      // Layout JSON is mostly writing, so cap the thinking. Models without effort (Haiku, older Sonnet) reject the field.
      ...(useEffort && claudeSupportsEffort(resolvedModel(config)) ? { output_config: { effort: config.effort } } : {}),
    },
    { signal: w.signal },
  )
  stream.on('streamEvent', (event) => {
    if (event.type === 'message_start') w.connected(200)
    else w.touch()
    if (event.type === 'content_block_start') w.touch(event.content_block.type === 'text' ? 'writing' : 'thinking')
  })
  if (onText) stream.on('text', (_delta, snapshot) => onText(snapshot))
  let response
  try {
    response = await stream.finalMessage()
  } catch (err) {
    if (useEffort && err instanceof Anthropic.APIError && err.status === 400 && /effort|output_config/i.test(err.message)) {
      hiccup(config, 'endpoint rejected the effort setting — retrying without it')
      return callClaude(config, systemPrompt, userPrompt, onText, w, viaZen, false)
    }
    throw err
  }
  // Thinking tokens are billed as output tokens, so show them separately.
  const usage = response.usage as { input_tokens: number; output_tokens: number; output_tokens_details?: { thinking_tokens?: number } }
  log(
    'info',
    `${config.provider} · ${resolvedModel(config)}`,
    `stop_reason=${response.stop_reason} · input_tokens=${usage.input_tokens} · output_tokens=${usage.output_tokens}${usage.output_tokens_details?.thinking_tokens != null ? ` (thinking ${usage.output_tokens_details.thinking_tokens})` : ''}`,
  )
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined this request (stop_reason: refusal)')
  }
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  if (!text) {
    throw new Error(
      `Claude returned no text content (stop_reason: ${response.stop_reason}${response.stop_reason === 'max_tokens' ? ` — thinking used the whole ${MAX_TOKENS}-token budget` : ''})`,
    )
  }
  if (response.stop_reason === 'max_tokens') throw new Error(`Claude ran out of tokens (${MAX_TOKENS}) mid-answer, so the JSON is cut off`)
  return text
}

/** Reads a server-sent-event body line by line; `onData` gets each `data:` payload. */
async function readSse(body: ReadableStream<Uint8Array>, w: CallWatch, onData: (payload: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    w.touch()
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:')) onData(trimmed.slice(5).trim())
    }
  }
}

/**
 * OpenAI, Groq, and Zen's chat models all speak the /chat/completions dialect, but
 * differ on parameter support: newer OpenAI models reject `max_tokens`
 * (requiring `max_completion_tokens`), and some models reject
 * `response_format`. Start from the provider's most likely shape and
 * adapt on 400s that name the offending parameter.
 */
async function callOpenAICompatible(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  baseUrl: string,
  onText: ((fullText: string) => void) | undefined,
  w: CallWatch,
): Promise<string> {
  const reasoningHeavy = config.provider === 'openai' || config.provider === 'zen'
  let useMaxCompletionTokens = config.provider === 'openai'
  let useJsonFormat = true
  let useReasoningEffort = config.provider === 'openai' || config.provider === 'zen'
  let lastError = ''
  // Reasoning models (o-series / gpt-5 family) burn completion tokens on hidden
  // reasoning BEFORE emitting text — give them a much larger budget so the
  // JSON survives the thinking phase.
  let tokenBudget = reasoningHeavy ? 32768 : 8192

  let useStream = !!onText

  for (let attempt = 0; attempt < 6; attempt++) {
    const body: Record<string, unknown> = {
      model: resolvedModel(config),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      [useMaxCompletionTokens ? 'max_completion_tokens' : 'max_tokens']: tokenBudget,
    }
    if (useJsonFormat) body.response_format = { type: 'json_object' }
    if (useReasoningEffort) body.reasoning_effort = config.effort
    if (useStream) body.stream = true

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: w.signal,
    })
    w.connected(res.status)

    if (res.ok && useStream && res.body) {
      // SSE stream: accumulate deltas and surface the growing text live
      let acc = ''
      let finishReason = ''
      await readSse(res.body, w, (payload) => {
        if (payload === '[DONE]') return
        try {
          const chunk = JSON.parse(payload)
          const choice = chunk.choices?.[0]
          const delta: string | undefined = choice?.delta?.content
          if (choice?.delta?.reasoning_content || choice?.delta?.reasoning) w.touch('thinking')
          if (delta) {
            acc += delta
            w.text(acc.length)
            onText!(acc)
          }
          if (choice?.finish_reason) finishReason = choice.finish_reason
        } catch {
          /* ignore malformed keep-alive lines */
        }
      })
      if (acc) return acc
      if (finishReason === 'length' && tokenBudget < 65536) {
        tokenBudget *= 2 // reasoning consumed the whole budget before any output — retry bigger
        hiccup(config, `reasoning used the whole token budget — retrying with ${tokenBudget}`)
        continue
      }
      throw new Error(
        finishReason === 'length'
          ? `${config.provider} spent the entire ${tokenBudget}-token budget on internal reasoning before emitting JSON — try a non-reasoning or "-mini" model for this task`
          : `${config.provider} returned no streamed content (finish_reason: ${finishReason || 'unknown'})`,
      )
    }

    if (res.ok) {
      const data = await res.json()
      const choice = data.choices?.[0]
      const text: string | undefined = choice?.message?.content
      if (text) return text
      const refusal: string | undefined = choice?.message?.refusal
      if (refusal) throw new Error(`${config.provider} refused: ${refusal.slice(0, 150)}`)
      if (choice?.finish_reason === 'length' && tokenBudget < 65536) {
        tokenBudget *= 2 // reasoning consumed the whole budget before any output — retry bigger
        hiccup(config, `reasoning used the whole token budget — retrying with ${tokenBudget}`)
        continue
      }
      if (choice?.finish_reason === 'length') {
        throw new Error(
          `${config.provider} spent the entire ${tokenBudget}-token budget on internal reasoning before emitting JSON — try a non-reasoning or "-mini" model for this task`,
        )
      }
      throw new Error(`${config.provider} returned no message content (finish_reason: ${choice?.finish_reason ?? 'unknown'})`)
    }

    lastError = await res.text()
    if (res.status === 400 && useStream && /\bstream\b/i.test(lastError)) {
      useStream = false // endpoint doesn't support streaming — fall back silently
      hiccup(config, 'endpoint rejected streaming — retrying without it')
      continue
    }
    if (res.status === 400) {
      if (!useMaxCompletionTokens && /max_completion_tokens/.test(lastError)) {
        useMaxCompletionTokens = true // endpoint wants the newer parameter
        hiccup(config, 'endpoint wants max_completion_tokens — retrying')
        continue
      }
      if (useMaxCompletionTokens && /max_completion_tokens/.test(lastError) && /unsupported|not supported|unknown/i.test(lastError)) {
        useMaxCompletionTokens = false // endpoint only knows the legacy parameter
        hiccup(config, 'endpoint only knows max_tokens — retrying')
        continue
      }
      if (useReasoningEffort && /reasoning_effort|reasoning/i.test(lastError)) {
        useReasoningEffort = false // not a reasoning model
        hiccup(config, 'model has no reasoning effort — retrying without it')
        continue
      }
      if (useJsonFormat && /response_format/.test(lastError)) {
        useJsonFormat = false // model doesn't support JSON mode
        hiccup(config, 'model has no JSON mode — retrying without it')
        continue
      }
    }
    throw new Error(`${config.provider} API error ${res.status}: ${lastError.slice(0, 200)}`)
  }
  throw new Error(`${config.provider} API error: ${lastError.slice(0, 200)}`)
}

async function callGemini(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onText: ((fullText: string) => void) | undefined,
  w: CallWatch,
  viaZen = false,
): Promise<string> {
  const model = resolvedModel(config)
  const endpoint = onText ? `${model}:streamGenerateContent?alt=sse` : `${model}:generateContent`
  const base = viaZen ? `${ZEN_BASE}/models` : 'https://generativelanguage.googleapis.com/v1beta/models'
  const res = await fetch(`${base}/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': config.apiKey,
      ...(viaZen ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 16384 },
    }),
    signal: w.signal,
  })
  w.connected(res.status)
  if (!res.ok) throw new Error(`${viaZen ? 'Zen (Gemini)' : 'Gemini'} API error ${res.status}: ${(await res.text()).slice(0, 200)}`)

  if (onText && res.body) {
    let acc = ''
    let finishReason = ''
    await readSse(res.body, w, (payload) => {
      try {
        const chunk = JSON.parse(payload)
        const candidate = chunk.candidates?.[0]
        const parts: Array<{ text?: string }> = candidate?.content?.parts ?? []
        const delta = parts.map((p) => p.text ?? '').join('')
        if (candidate?.finishReason) finishReason = candidate.finishReason
        if (delta) {
          acc += delta
          w.text(acc.length)
          onText(acc)
        }
      } catch {
        /* ignore malformed lines */
      }
    })
    if (!acc) throw new Error(`Gemini returned no streamed content (finishReason: ${finishReason || 'unknown'})`)
    if (finishReason && finishReason !== 'STOP') log('warn', `${config.provider} · ${model}`, `finishReason=${finishReason}`)
    return acc
  }

  const data = await res.json()
  const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((p) => p.text ?? '').join('')
  if (!text) throw new Error(`Gemini returned no text content (finishReason: ${data.candidates?.[0]?.finishReason ?? 'unknown'})`)
  return text
}

/**
 * OpenAI Responses API — the wire format Zen uses for GPT, Grok and Muse models.
 * Reasoning tokens count against max_output_tokens, so the budget is generous.
 */
async function callResponses(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  baseUrl: string,
  onText: ((fullText: string) => void) | undefined,
  w: CallWatch,
): Promise<string> {
  let useJsonFormat = true
  let useReasoningEffort = true
  let useStream = !!onText
  let lastError = ''

  for (let attempt = 0; attempt < 5; attempt++) {
    const body: Record<string, unknown> = {
      model: resolvedModel(config),
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 32768,
    }
    if (useJsonFormat) body.text = { format: { type: 'json_object' } }
    if (useReasoningEffort) body.reasoning = { effort: config.effort }
    if (useStream) body.stream = true

    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: w.signal,
    })
    w.connected(res.status)

    if (res.ok && useStream && res.body) {
      let acc = ''
      let incomplete = ''
      await readSse(res.body, w, (payload) => {
        let event
        try {
          event = JSON.parse(payload)
        } catch {
          return // malformed keep-alive line
        }
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          acc += event.delta
          w.text(acc.length)
          onText!(acc)
        } else if (typeof event.type === 'string' && event.type.startsWith('response.reasoning')) {
          w.touch('thinking')
        } else if (event.type === 'response.incomplete') {
          incomplete = event.response?.incomplete_details?.reason ?? 'unknown'
        } else if (event.type === 'response.failed' || event.type === 'error') {
          throw new Error(event.response?.error?.message ?? event.message ?? 'stream failed')
        }
      })
      if (acc) return acc
      throw new Error(`${config.provider} returned no streamed content (${incomplete ? `incomplete: ${incomplete}` : 'empty response'})`)
    }

    if (res.ok) {
      const data = await res.json()
      const text = (data.output ?? [])
        .filter((item: { type?: string }) => item.type === 'message')
        .flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
        .filter((part: { type?: string }) => part.type === 'output_text')
        .map((part: { text?: string }) => part.text ?? '')
        .join('')
      if (text) return text
      throw new Error(`${config.provider} returned no message content (status: ${data.status ?? 'unknown'})`)
    }

    lastError = await res.text()
    if (res.status === 400 && useStream && /\bstream\b/i.test(lastError)) {
      useStream = false
      hiccup(config, 'endpoint rejected streaming — retrying without it')
      continue
    }
    if (res.status === 400 && useReasoningEffort && /reasoning/i.test(lastError)) {
      useReasoningEffort = false
      hiccup(config, 'model has no reasoning effort — retrying without it')
      continue
    }
    if (res.status === 400 && useJsonFormat && /text\.format|json_object|response_format/i.test(lastError)) {
      useJsonFormat = false
      hiccup(config, 'model has no JSON mode — retrying without it')
      continue
    }
    throw new Error(`${config.provider} API error ${res.status}: ${lastError.slice(0, 200)}`)
  }
  throw new Error(`${config.provider} API error: ${lastError.slice(0, 200)}`)
}

/** Zen fronts several vendors; the model family decides which wire format to speak. */
function callZen(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onText: ((fullText: string) => void) | undefined,
  w: CallWatch,
): Promise<string> {
  const model = resolvedModel(config)
  if (model.startsWith('claude-')) return callClaude(config, systemPrompt, userPrompt, onText, w, true)
  if (model.startsWith('gemini-')) return callGemini(config, systemPrompt, userPrompt, onText, w, true)
  if (/^(gpt-|grok-|muse-)/.test(model)) return callResponses(config, systemPrompt, userPrompt, ZEN_BASE, onText, w)
  return callOpenAICompatible(config, systemPrompt, userPrompt, ZEN_BASE, onText, w)
}

/**
 * Send any (systemPrompt, userPrompt) pair through the configured provider.
 * When `onText` is passed, the response is streamed and `onText` receives the
 * accumulated text after every chunk; the full text is still returned.
 */
export async function callModel(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onText?: (fullText: string) => void,
): Promise<string> {
  if (!config.apiKey.trim()) throw new Error('no API key configured — open settings')
  const w = watchCall(config, !!onText)
  try {
    let text: string
    switch (config.provider) {
      case 'claude':
        text = await callClaude(config, systemPrompt, userPrompt, onText, w)
        break
      case 'openai':
        text = await callOpenAICompatible(config, systemPrompt, userPrompt, 'https://api.openai.com/v1', onText, w)
        break
      case 'groq':
        text = await callOpenAICompatible(config, systemPrompt, userPrompt, 'https://api.groq.com/openai/v1', onText, w)
        break
      case 'zen':
        text = await callZen(config, systemPrompt, userPrompt, onText, w)
        break
      case 'gemini':
        text = await callGemini(config, systemPrompt, userPrompt, onText, w)
        break
    }
    w.finish(text.length)
    return text
  } catch (err) {
    throw w.fail(err)
  }
}

/**
 * Best-effort completion of a truncated JSON document: closes open strings,
 * removes dangling separators, and balances brackets so the prefix the model
 * has emitted so far can be parsed and rendered mid-stream.
 */
/** Marks a string the stream cut off in the middle (private-use character, never in real text). */
const CUT = '\uE000'
/** Keys whose value must be whole before a node can be trusted ("Table" is a real name, but the model may be writing "TableRow"). */
const IDENTITY_KEYS = new Set(['id', 'type', 'component'])

/**
 * After parsing a completed-partial document: remove the cut marker from every string,
 * and flag each object whose id / type / component was cut off with `__incomplete`.
 */
function settleCuts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(settleCuts)
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string' && v.endsWith(CUT)) {
        out[key] = v.slice(0, -1)
        if (IDENTITY_KEYS.has(key)) out.__incomplete = true
      } else out[key] = settleCuts(v)
    }
    return out
  }
  return value
}

export function completePartialJson(text: string): unknown | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  const s = text.slice(start)
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') stack.pop()
  }
  let fixed = s
  if (inString) fixed += `${CUT}"`
  fixed = fixed.replace(/\s+$/, '')
  if (fixed.endsWith(':')) fixed += 'null'
  else if (fixed.endsWith(',')) fixed = fixed.slice(0, -1)
  for (let i = stack.length - 1; i >= 0; i--) fixed += stack[i] === '{' ? '}' : ']'
  try {
    return settleCuts(JSON.parse(fixed))
  } catch {
    return null // a partial literal is mid-flight; the next chunk will parse
  }
}

export function parseModelJson(text: string): unknown {
  return extractJson(text)
}

/**
 * Self-healing generation: call the model, and if its output fails parsing
 * or validation for ANY reason, send the broken output + the exact error
 * back to the model and ask it to repair itself. Handles wrong key names,
 * truncated JSON, invented schemas — generically, for every provider.
 */
export async function generateValidated<T>(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  /** `partial` is true for a mid-stream snapshot: the text is cut off, so names and values may be half-written. */
  validate: (raw: unknown, partial?: boolean) => T,
  onRepair?: (message: string) => void,
  onPartial?: (partial: T) => void,
): Promise<T> {
  // Live streaming: as text arrives, complete the partial JSON, validate it,
  // and hand renderable snapshots to the caller (throttled).
  let lastParse = 0
  const handleText = onPartial
    ? (fullText: string) => {
        const now = performance.now()
        if (now - lastParse < 150) return
        lastParse = now
        const raw = completePartialJson(fullText)
        if (raw === null) return
        try {
          onPartial(validate(raw, true))
        } catch {
          /* prefix not yet renderable — wait for more chunks */
        }
      }
    : undefined
  let text = await callModel(config, systemPrompt, userPrompt, handleText)
  if (onPartial) {
    // final flush so the last streamed state matches the full text
    const raw = completePartialJson(text)
    if (raw !== null) {
      try {
        onPartial(validate(raw))
      } catch {
        /* full validation below decides */
      }
    }
  }
  for (let attempt = 0; ; attempt++) {
    try {
      return validate(parseModelJson(text))
    } catch (err) {
      if (attempt >= 2) throw err
      const msg = err instanceof Error ? err.message : String(err)
      log('warn', 'validate', `${msg.slice(0, 200)} — output was ${text.length} chars, starts: ${JSON.stringify(text.slice(0, 120))}`)
      onRepair?.(`Output failed validation (${msg.slice(0, 90)}) — asking the model to repair it (attempt ${attempt + 2}/3)`)
      text = await callModel(
        config,
        systemPrompt,
        `Your previous response failed validation.\n\nVALIDATION ERROR:\n${msg}\n\nYOUR PREVIOUS OUTPUT:\n${text.slice(0, 14000)}\n\nFix it: return the SAME design corrected to match the exact schema and key names from the system instructions. Output ONLY the corrected JSON object — no commentary, no markdown fences.`,
      )
    }
  }
}

/** What the model needs to change an existing design instead of drawing a new one. */
export interface RevisionContext {
  design: { frameLabel: string; frameClasses: string; sections: CanvasNode[]; fonts?: DesignFonts }
  /** Earlier requests on this design, oldest first. */
  earlier: string[]
  /** The node the user has selected: the change is most likely about it. */
  focus?: { id: string; label: string } | null
}

/** A node as compact JSON for the model: empty fields left out. */
function compactNode(n: CanvasNode): Record<string, unknown> {
  const out: Record<string, unknown> = { id: n.id, type: n.type }
  if (n.component) out.component = n.component
  out.label = n.label
  if (n.icon) out.icon = n.icon
  if (n.art) out.art = n.art
  if (n.alt) out.alt = n.alt
  if (n.prompt) out.prompt = n.prompt
  if (n.props && Object.keys(n.props).length) out.props = n.props
  if (n.classes) out.classes = n.classes
  if (n.content) out.content = n.content
  if (n.children?.length) out.children = n.children.map(compactNode)
  return out
}

const REVISION_PROMPT = `REVISION MODE
The user already has a design on the canvas. You get its CURRENT DESIGN as JSON and a CHANGE REQUEST. Return the COMPLETE updated design in the same output shape (frameLabel, frameClasses, sections). Not a diff, not only the new part.
- Make the requested change and nothing else. Keep every other node exactly as it is: same id, type, label, classes, props, content and order.
- Keep the ids of the nodes you keep. Give new nodes new unique ids.
- "Add X" means add it (append, or insert where it belongs). It does not mean redesign. "Remove X" means remove it. "Change X" means edit only X.
- Keep the same visual language: the same colors, fonts, spacing rhythm and, in real-component mode, the same library.
- The section count (2–5) and node count (25–60) limits do not apply. The design may grow up to about 90 nodes in total.
- Images and icons: "add images and icons" means follow the ICONS, IMAGES AND FONTS rules for the whole design: an icon node before every feature, benefit, stat, step and list item, and an image node (with art, alt, prompt) for the hero, each card, each product and each person that lacks one. Keep the nodes that already exist. Keep "fonts" as they are unless asked to change them.
- If the user points at a node (POINTED AT), the request is about that node and what is inside it, unless the text clearly says otherwise.`

function revisionUserPrompt(request: string, rev: RevisionContext): string {
  const design = JSON.stringify({ frameLabel: rev.design.frameLabel, frameClasses: rev.design.frameClasses, ...(rev.design.fonts ? { fonts: rev.design.fonts } : {}), sections: rev.design.sections.map(compactNode) })
  return [
    `CURRENT DESIGN:\n${design}`,
    rev.earlier.length ? `EARLIER REQUESTS (oldest first):\n${rev.earlier.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : '',
    rev.focus ? `POINTED AT: ${rev.focus.id} (${rev.focus.label})` : '',
    `CHANGE REQUEST: ${request}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function generateLayout(
  config: AIConfig,
  userPrompt: string,
  onRepair?: (message: string) => void,
  styleDirective?: string,
  onPartial?: (partial: ValidationResult) => void,
  /** Compose from the REAL components of this library (shadcn, Relume…). */
  libraryId?: LibraryId | null,
  /** Change the design that is already on the canvas, instead of drawing a new one. */
  revision?: RevisionContext | null,
): Promise<ValidationResult> {
  const lib = getLibrary(libraryId)
  const systemPrompt = [SYSTEM_PROMPT, lib ? libraryPrompt(lib) : '', styleDirective ?? '', revision ? REVISION_PROMPT : ''].filter(Boolean).join('\n\n')
  const prompt = revision ? revisionUserPrompt(userPrompt, revision) : userPrompt
  return generateValidated(config, systemPrompt, prompt, (raw, partial) => validateLayout(raw, lib?.id, { partial }), onRepair, onPartial)
}
