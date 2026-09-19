import Anthropic from '@anthropic-ai/sdk'

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
  type: 'container' | 'text' | 'image' | 'button' | 'grid'
  label: string
  classes: string // Tailwind CSS strings
  children?: CanvasNode[]
  content?: string
}

export interface GeneratedLayout {
  frameLabel: string
  frameClasses: string
  sections: CanvasNode[]
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
    note: 'Zen sends no CORS headers, so requests go through the local dev server (/zen-proxy). Run the app with npm run dev or npm run preview. Zen free models only work inside OpenCode.',
    models: [
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
      { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
      { id: 'grok-4.6', label: 'Grok 4.6' },
      { id: 'kimi-k3', label: 'Kimi K3' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { id: 'glm-5.3', label: 'GLM 5.3' },
      { id: 'minimax-m3', label: 'MiniMax M3' },
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

export interface ProviderProfile {
  apiKey: string
  /** '' means "use the provider's default model". */
  model: string
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
  const profiles = { ...config.profiles, [config.provider]: { apiKey: config.apiKey, model: config.model } }
  const saved = profiles[next]
  return { provider: next, model: saved?.model ?? '', apiKey: saved?.apiKey ?? '', profiles }
}

/** Fold the active provider's key + model back into `profiles` (call before saving). */
export function commitProfile(config: AIConfig): AIConfig {
  return { ...config, profiles: { ...config.profiles, [config.provider]: { apiKey: config.apiKey, model: config.model } } }
}

export function loadConfig(): AIConfig {
  const fresh: AIConfig = { provider: DEFAULT_PROVIDER, model: '', apiKey: '', profiles: {} }
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw)
    const profiles: AIConfig['profiles'] = {}
    for (const p of PROVIDERS) {
      const entry = saved?.profiles?.[p.id]
      if (entry) profiles[p.id] = { apiKey: String(entry.apiKey ?? ''), model: String(entry.model ?? '') }
    }
    // Pre-profiles format: one flat provider/model/apiKey. 'openzen' pointed at a
    // made-up endpoint, so it is dropped rather than migrated.
    if (!saved?.profiles && PROVIDERS.some((p) => p.id === saved?.provider)) {
      profiles[saved.provider as ProviderId] = { apiKey: String(saved.apiKey ?? ''), model: String(saved.model ?? '') }
    }
    const provider: ProviderId = PROVIDERS.some((p) => p.id === saved?.provider) ? saved.provider : DEFAULT_PROVIDER
    const active = profiles[provider]
    return { provider, model: active?.model ?? '', apiKey: active?.apiKey ?? '', profiles }
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
  "sections": [ CanvasNode, ... ]
}
"sections" is 2–5 top-level page sections, stacked vertically inside the frame.

CanvasNode schema:
{
  "id": "<unique-kebab-case-string>",
  "type": "container" | "grid" | "text" | "button" | "image",
  "label": "<short human name, e.g. 'Hero', 'Stat card'>",
  "classes": "<space-separated Tailwind utilities from the ALLOWED VOCABULARY only>",
  "children": [CanvasNode, ...],   // ONLY on container/grid
  "content": "<string>"            // ONLY on text/button
}

CANVAS: the page frame is a 1200px-wide desktop viewport. Design for that width — generous horizontal layouts, multi-column heroes (asymmetric splits, side-by-side content + visual), 3–4 column grids, wide stat strips. Cap long text runs with max-w-xl/2xl/3xl so line length stays readable; center or offset content blocks deliberately inside the width rather than letting everything stretch edge to edge.

HARD RULES:
- 25–60 nodes total. Maximum nesting depth 5. Every id unique.
- "image" nodes are decorative visual blocks (icons, avatars, photo stand-ins, chart bars) built purely from size/gradient/rounded classes. They have no children, no content, no src.
- Give each section its own horizontal padding (px-8..px-14) and vertical padding; sections own their background color.
- Use ONLY classes from the ALLOWED VOCABULARY. Never use: arbitrary values (w-[500px]), responsive prefixes (sm:, md:, lg:), state variants (hover:, focus:), or any utility not listed. Unknown classes are stripped and your design degrades.
- Opacity modifiers exist only as {bg,text,border,ring}-{white,black}/{5,10,20,30,40,50,60,70,80,90}.
- Write real, specific copy for the subject — never lorem ipsum, never placeholder text like "Title here".

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
- Use image nodes generously for visual rhythm: gradient avatars, icon chips, chart bars (a row of flex items-end bars with varying h-), photo stand-ins with aspect-video and a gradient.`

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
  /^(?:overflow-hidden|overflow-auto|relative|mx-auto|ml-auto|mr-auto|mt-auto|mb-auto|object-cover|aspect-square|aspect-video|backdrop-blur)$/,
]

export function isAllowedClass(token: string): boolean {
  return ALLOWED_CLASS_PATTERNS.some((re) => re.test(token))
}

function sanitizeClasses(value: unknown, dropped: Set<string>): string {
  if (typeof value !== 'string') return ''
  const kept: string[] = []
  for (const token of value.split(/\s+/).filter(Boolean)) {
    if (isAllowedClass(token)) kept.push(token)
    else dropped.add(token)
  }
  return kept.join(' ')
}

/* ------------------------------------------------------------------ *
 *  Response parsing + AST validation
 * ------------------------------------------------------------------ */

const NODE_TYPES = new Set(['container', 'grid', 'text', 'button', 'image'])
const MAX_NODES = 90
const MAX_DEPTH = 6

export interface ValidationResult {
  layout: GeneratedLayout
  droppedClasses: string[]
  nodeCount: number
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('model returned no JSON object')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export function validateLayout(raw: unknown): ValidationResult {
  const dropped = new Set<string>()
  const seenIds = new Set<string>()
  let counter = 0
  let total = 0

  const obj = (raw ?? {}) as Record<string, unknown>
  const sectionsSource = [obj.sections, obj.children, obj.blocks].find((v) => Array.isArray(v) && v.length > 0)
  const rawSections = (sectionsSource as unknown[] | undefined) ?? null
  if (!rawSections) {
    throw new Error(`response has no "sections" array (top-level keys: ${Object.keys(obj).join(', ') || 'none'})`)
  }

  const coerce = (input: unknown, depth: number): CanvasNode | null => {
    if (total >= MAX_NODES || depth > MAX_DEPTH || typeof input !== 'object' || input === null) return null
    total++
    const n = input as Record<string, unknown>
    let id = typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `node-${++counter}`
    while (seenIds.has(id)) id = `${id}-${++counter}`
    seenIds.add(id)
    const type = NODE_TYPES.has(n.type as string) ? (n.type as CanvasNode['type']) : 'container'
    const node: CanvasNode = {
      id,
      type,
      label: typeof n.label === 'string' && n.label.trim() ? n.label.trim() : type,
      classes: sanitizeClasses(n.classes, dropped),
    }
    if ((type === 'text' || type === 'button') && typeof n.content === 'string') node.content = n.content
    if ((type === 'container' || type === 'grid') && Array.isArray(n.children)) {
      node.children = n.children.map((c) => coerce(c, depth + 1)).filter((c): c is CanvasNode => c !== null)
    }
    return node
  }

  const sections = rawSections.map((s) => coerce(s, 1)).filter((s): s is CanvasNode => s !== null)
  if (sections.length === 0) throw new Error('no valid sections survived validation')

  return {
    layout: {
      frameLabel: typeof obj.frameLabel === 'string' && obj.frameLabel.trim() ? obj.frameLabel.trim() : 'Frame · generated',
      frameClasses: sanitizeClasses(obj.frameClasses, dropped) || 'bg-white',
      sections,
    },
    droppedClasses: [...dropped],
    nodeCount: total,
  }
}

/* ------------------------------------------------------------------ *
 *  Provider adapters — all called directly from the browser with the
 *  user's own key. Keys are typed by the user in the config panel,
 *  stored in localStorage, and sent only to the selected provider.
 * ------------------------------------------------------------------ */

/** Where Zen is reachable from the browser — see the /zen-proxy entry in vite.config.ts. */
const ZEN_BASE = '/zen-proxy/v1'

async function callClaude(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onText?: (fullText: string) => void,
  viaZen = false,
): Promise<string> {
  // The SDK appends /v1/messages itself and needs an absolute base URL. Zen's
  // /messages route takes the same x-api-key header as Anthropic.
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(viaZen ? { baseURL: `${window.location.origin}/zen-proxy` } : {}),
    dangerouslyAllowBrowser: true,
  })
  const stream = client.messages.stream({
    model: resolvedModel(config),
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  if (onText) stream.on('text', (_delta, snapshot) => onText(snapshot))
  const response = await stream.finalMessage()
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined this request (stop_reason: refusal)')
  }
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  if (!text) throw new Error('Claude returned no text content')
  return text
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
  onText?: (fullText: string) => void,
): Promise<string> {
  const reasoningHeavy = config.provider === 'openai' || config.provider === 'zen'
  let useMaxCompletionTokens = config.provider === 'openai'
  let useJsonFormat = true
  let lastError = ''
  // Reasoning models (o-series / gpt-5 family) burn completion tokens on hidden
  // reasoning BEFORE emitting text — give OpenAI a much larger budget so the
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
    if (useStream) body.stream = true

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
    })

    if (res.ok && useStream && res.body) {
      // SSE stream: accumulate deltas and surface the growing text live
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''
      let finishReason = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const chunk = JSON.parse(payload)
            const choice = chunk.choices?.[0]
            const delta: string | undefined = choice?.delta?.content
            if (delta) {
              acc += delta
              onText!(acc)
            }
            if (choice?.finish_reason) finishReason = choice.finish_reason
          } catch {
            /* ignore malformed keep-alive lines */
          }
        }
      }
      if (acc) return acc
      if (finishReason === 'length' && tokenBudget < 65536) {
        tokenBudget *= 2 // reasoning consumed the whole budget before any output — retry bigger
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
      continue
    }
    if (res.status === 400) {
      if (!useMaxCompletionTokens && /max_completion_tokens/.test(lastError)) {
        useMaxCompletionTokens = true // endpoint wants the newer parameter
        continue
      }
      if (useMaxCompletionTokens && /max_completion_tokens/.test(lastError) && /unsupported|not supported|unknown/i.test(lastError)) {
        useMaxCompletionTokens = false // endpoint only knows the legacy parameter
        continue
      }
      if (useJsonFormat && /response_format/.test(lastError)) {
        useJsonFormat = false // model doesn't support JSON mode
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
  onText?: (fullText: string) => void,
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
  })
  if (!res.ok) throw new Error(`${viaZen ? 'Zen (Gemini)' : 'Gemini'} API error ${res.status}: ${(await res.text()).slice(0, 200)}`)

  if (onText && res.body) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let acc = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()!
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        try {
          const chunk = JSON.parse(trimmed.slice(5).trim())
          const parts: Array<{ text?: string }> = chunk.candidates?.[0]?.content?.parts ?? []
          const delta = parts.map((p) => p.text ?? '').join('')
          if (delta) {
            acc += delta
            onText(acc)
          }
        } catch {
          /* ignore malformed lines */
        }
      }
    }
    if (!acc) throw new Error('Gemini returned no streamed content')
    return acc
  }

  const data = await res.json()
  const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((p) => p.text ?? '').join('')
  if (!text) throw new Error('Gemini returned no text content')
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
  onText?: (fullText: string) => void,
): Promise<string> {
  let useJsonFormat = true
  let useStream = !!onText
  let lastError = ''

  for (let attempt = 0; attempt < 4; attempt++) {
    const body: Record<string, unknown> = {
      model: resolvedModel(config),
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 32768,
    }
    if (useJsonFormat) body.text = { format: { type: 'json_object' } }
    if (useStream) body.stream = true

    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
    })

    if (res.ok && useStream && res.body) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''
      let incomplete = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          try {
            const event = JSON.parse(trimmed.slice(5).trim())
            if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
              acc += event.delta
              onText!(acc)
            } else if (event.type === 'response.incomplete') {
              incomplete = event.response?.incomplete_details?.reason ?? 'unknown'
            } else if (event.type === 'response.failed' || event.type === 'error') {
              throw new Error(event.response?.error?.message ?? event.message ?? 'stream failed')
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue // malformed keep-alive line
            throw err
          }
        }
      }
      if (acc) return acc
      throw new Error(`zen returned no streamed content (${incomplete ? `incomplete: ${incomplete}` : 'empty response'})`)
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
      throw new Error(`zen returned no message content (status: ${data.status ?? 'unknown'})`)
    }

    lastError = await res.text()
    if (res.status === 400 && useStream && /\bstream\b/i.test(lastError)) {
      useStream = false
      continue
    }
    if (res.status === 400 && useJsonFormat && /text\.format|json_object|response_format/i.test(lastError)) {
      useJsonFormat = false
      continue
    }
    break
  }
  throw new Error(`zen API error: ${lastError.slice(0, 200)}`)
}

/** Zen fronts several vendors; the model family decides which wire format to speak. */
function callZen(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onText?: (fullText: string) => void,
): Promise<string> {
  const model = resolvedModel(config)
  if (model.startsWith('claude-')) return callClaude(config, systemPrompt, userPrompt, onText, true)
  if (model.startsWith('gemini-')) return callGemini(config, systemPrompt, userPrompt, onText, true)
  if (/^(gpt-|grok-|muse-)/.test(model)) return callResponses(config, systemPrompt, userPrompt, ZEN_BASE, onText)
  return callOpenAICompatible(config, systemPrompt, userPrompt, ZEN_BASE, onText)
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
  switch (config.provider) {
    case 'claude':
      return callClaude(config, systemPrompt, userPrompt, onText)
    case 'openai':
      return callOpenAICompatible(config, systemPrompt, userPrompt, 'https://api.openai.com/v1', onText)
    case 'groq':
      return callOpenAICompatible(config, systemPrompt, userPrompt, 'https://api.groq.com/openai/v1', onText)
    case 'zen':
      return callZen(config, systemPrompt, userPrompt, onText)
    case 'gemini':
      return callGemini(config, systemPrompt, userPrompt, onText)
  }
}

/**
 * Best-effort completion of a truncated JSON document: closes open strings,
 * removes dangling separators, and balances brackets so the prefix the model
 * has emitted so far can be parsed and rendered mid-stream.
 */
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
  if (inString) fixed += '"'
  fixed = fixed.replace(/\s+$/, '')
  if (fixed.endsWith(':')) fixed += 'null'
  else if (fixed.endsWith(',')) fixed = fixed.slice(0, -1)
  for (let i = stack.length - 1; i >= 0; i--) fixed += stack[i] === '{' ? '}' : ']'
  try {
    return JSON.parse(fixed)
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
  validate: (raw: unknown) => T,
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
          onPartial(validate(raw))
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
      onRepair?.(`Output failed validation (${msg.slice(0, 90)}) — asking the model to repair it (attempt ${attempt + 2}/3)`)
      text = await callModel(
        config,
        systemPrompt,
        `Your previous response failed validation.\n\nVALIDATION ERROR:\n${msg}\n\nYOUR PREVIOUS OUTPUT:\n${text.slice(0, 14000)}\n\nFix it: return the SAME design corrected to match the exact schema and key names from the system instructions. Output ONLY the corrected JSON object — no commentary, no markdown fences.`,
      )
    }
  }
}

export async function generateLayout(
  config: AIConfig,
  userPrompt: string,
  onRepair?: (message: string) => void,
  styleDirective?: string,
  onPartial?: (partial: ValidationResult) => void,
): Promise<ValidationResult> {
  const systemPrompt = styleDirective ? `${SYSTEM_PROMPT}\n\n${styleDirective}` : SYSTEM_PROMPT
  return generateValidated(config, systemPrompt, userPrompt, validateLayout, onRepair, onPartial)
}
