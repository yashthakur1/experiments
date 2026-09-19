/* ================================================================== *
 *  Pictures for "image" nodes.
 *
 *  An image node used to be an empty box. Now every one shows a small
 *  vector illustration that matches its subject (a cup for a coffee
 *  brief, a skyline for a city, a bag for a product), drawn from the
 *  design's own palette. It costs nothing and appears with the design.
 *  A real generated picture can replace it later (node.src).
 * ================================================================== */

import { artSvg, luminance, mix, parseColor, toHex, type ArtKind } from './language'

export type SceneKind = 'landscape' | 'skyline' | 'portrait' | 'product' | 'cup' | 'chart' | 'food' | 'device' | 'abstract'
export const SCENE_KINDS: SceneKind[] = ['landscape', 'skyline', 'portrait', 'product', 'cup', 'chart', 'food', 'device', 'abstract']

/** Words in a node's label, alt text or prompt that point at a subject. First match wins. */
const SUBJECT_WORDS: [SceneKind, RegExp][] = [
  ['cup', /coffee|espresso|latte|cafe|café|tea\b|mug|brew|barista|roast/i],
  ['portrait', /portrait|avatar|person|people|team|founder|customer|testimonial|face|headshot|user photo|profile|chef|doctor|teacher|student/i],
  ['skyline', /city|skyline|building|office|urban|architecture|real estate|property|hotel|downtown/i],
  ['landscape', /landscape|mountain|nature|forest|beach|ocean|sea|travel|trek|outdoor|hike|garden|field|farm|sunrise|sunset|scenery|lake|park/i],
  ['chart', /chart|graph|analytics|dashboard|metric|growth|stats|revenue|report|trend|data/i],
  ['device', /app\b|screen|mockup|phone|laptop|device|interface|website|software|ui\b|screenshot/i],
  ['food', /food|dish|meal|recipe|pizza|salad|bakery|dessert|restaurant|menu|plate|cake|bread/i],
  ['product', /product|bag|package|packaging|bottle|box|shoe|watch|gadget|item|merch|jar|can\b|cosmetic|skincare|perfume/i],
]

export function inferScene(...texts: (string | undefined)[]): SceneKind {
  const text = texts.filter(Boolean).join(' ')
  return SUBJECT_WORDS.find(([, re]) => re.test(text))?.[0] ?? 'abstract'
}

/** Small deterministic random generator. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) % 100000
}

/** Tailwind colors at shades 100, 300, 500, 700 and 900, for drawing pictures in the design's own colors (generated from tailwindcss/theme.css). */
const TAILWIND_SHADES: Record<string, string[]> = {
  slate: ["#f1f5f9", "#cad5e2", "#62748e", "#314158", "#0f172b"],
  gray: ["#f3f4f6", "#d1d5dc", "#6a7282", "#364153", "#101828"],
  zinc: ["#f4f4f5", "#d4d4d8", "#71717b", "#3f3f46", "#18181b"],
  stone: ["#f5f5f4", "#d6d3d1", "#79716b", "#44403b", "#1c1917"],
  red: ["#ffe2e2", "#ffa2a2", "#fb2c36", "#c10007", "#82181a"],
  orange: ["#ffedd4", "#ffb86a", "#ff6900", "#ca3500", "#7e2a0c"],
  amber: ["#fef3c6", "#ffd230", "#fe9a00", "#bb4d00", "#7b3306"],
  yellow: ["#fef9c2", "#ffdf20", "#f0b100", "#a65f00", "#733e0a"],
  lime: ["#ecfcca", "#bbf451", "#7ccf00", "#497d00", "#35530e"],
  green: ["#dcfce7", "#7bf1a8", "#00c950", "#008236", "#0d542b"],
  emerald: ["#d0fae5", "#5ee9b5", "#00bc7d", "#007a55", "#004f3b"],
  teal: ["#cbfbf1", "#46ecd5", "#00bba7", "#00786f", "#0b4f4a"],
  cyan: ["#cefafe", "#53eafd", "#00b8db", "#007595", "#104e64"],
  sky: ["#dff2fe", "#74d4ff", "#00a6f4", "#0069a8", "#024a70"],
  blue: ["#dbeafe", "#8ec5ff", "#2b7fff", "#1447e6", "#1c398e"],
  indigo: ["#e0e7ff", "#a3b3ff", "#615fff", "#432dd7", "#312c85"],
  violet: ["#ede9fe", "#c4b4ff", "#8e51ff", "#7008e7", "#4d179a"],
  purple: ["#f3e8ff", "#dab2ff", "#ad46ff", "#8200db", "#59168b"],
  fuchsia: ["#fae8ff", "#f4a8ff", "#e12afb", "#a800b7", "#721378"],
  pink: ["#fce7f3", "#fda5d5", "#f6339a", "#c6005c", "#861043"],
  rose: ["#ffe4e6", "#ffa1ad", "#ff2056", "#c70036", "#8b0836"],
}

export const FALLBACK_PALETTE = ['#fdf3e7', '#f4b183', '#7fa99b', '#e4c1f9', '#2f2a3b']

interface Roles {
  bg: string
  a: string
  b: string
  c: string
  ink: string
  paper: string
}

/** Five roles from any list of colors: the lightest is the backdrop, the darkest the ink, the rest are sorted by how colorful they are. */
export function sceneRoles(palette: string[]): Roles {
  const parsed = palette.map((p) => ({ p, rgb: parseColor(p) })).filter((e): e is { p: string; rgb: [number, number, number] } => e.rgb !== null)
  const list = parsed.length >= 3 ? parsed : FALLBACK_PALETTE.map((p) => ({ p, rgb: parseColor(p)! }))
  const byLight = [...list].sort((x, y) => luminance(y.rgb) - luminance(x.rgb))
  const sat = (rgb: [number, number, number]) => Math.max(...rgb) - Math.min(...rgb)
  const mid = byLight.slice(1, -1).sort((x, y) => sat(y.rgb) - sat(x.rgb))
  const pickMid = (i: number) => (mid[i % Math.max(mid.length, 1)] ?? byLight[0]).rgb
  const bg = byLight[0].rgb
  const ink = byLight[byLight.length - 1].rgb
  return {
    bg: toHex(bg),
    a: toHex(pickMid(0)),
    b: toHex(pickMid(1)),
    c: toHex(pickMid(2)),
    ink: toHex(mix(ink, [0, 0, 0], luminance(ink) > 0.3 ? 0.4 : 0)),
    paper: toHex(mix(bg, [255, 255, 255], 0.55)),
  }
}

const W = 800
const H = 600

const SKIN_TONES = ['#f1c9a5', '#e0ac82', '#c68863', '#a56b47', '#8d5a3b', '#f7d9c4']
const HAIR_TONES = ['#2b2118', '#4a3121', '#7a5230', '#1c1917', '#a8794a', '#5b5b5b']

/** Draws one scene as an SVG string. */
export function sceneSvg(kind: SceneKind, palette: string[], seed = 1): string {
  if (kind === 'abstract') {
    const kinds: ArtKind[] = ['blobs', 'waves', 'rings', 'dots']
    const url = artSvg(kinds[seed % kinds.length], sceneList(palette), seed)
    return decodeURIComponent(url.replace(/^url\("data:image\/svg\+xml;utf8,/, '').replace(/"\)$/, ''))
  }
  const r = rng(seed * 7919 + 13)
  const p = sceneRoles(palette)
  let body = ''
  switch (kind) {
    case 'landscape': {
      body += `<circle cx="${560 + r() * 120}" cy="${150 + r() * 40}" r="${58 + r() * 24}" fill="${p.c}" opacity=".9"/>`
      const hills = [
        { y: 330, color: p.a, o: 0.55 },
        { y: 400, color: p.b, o: 0.8 },
        { y: 470, color: p.ink, o: 0.85 },
      ]
      hills.forEach((h, i) => {
        const pts = Array.from({ length: 9 }, (_, k) => `${k * 100},${(h.y + Math.sin(k * 0.9 + i * 1.7 + seed) * 46 + (r() - 0.5) * 24).toFixed(0)}`).join(' L')
        body += `<path d="M0,${H} L${pts} L${W},${H} Z" fill="${h.color}" opacity="${h.o}"/>`
      })
      for (let i = 0; i < 4; i++) body += `<path d="M${90 + i * 60 + r() * 40},${90 + r() * 60} q10,-10 20,0 q10,-10 20,0" fill="none" stroke="${p.ink}" stroke-width="3" opacity=".5"/>`
      break
    }
    case 'skyline': {
      body += `<circle cx="${620}" cy="${140}" r="60" fill="${p.c}" opacity=".85"/>`
      let x = 20
      while (x < W - 40) {
        const w = 60 + r() * 70
        const h = 140 + r() * 300
        const color = [p.a, p.b, p.ink][Math.floor(r() * 3)]
        body += `<rect x="${x.toFixed(0)}" y="${(H - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${color}" opacity="${(0.7 + r() * 0.3).toFixed(2)}"/>`
        for (let wy = H - h + 18; wy < H - 22; wy += 30)
          for (let wx = x + 12; wx < x + w - 16; wx += 22) if (r() > 0.35) body += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="10" height="14" fill="${p.paper}" opacity=".75"/>`
        x += w + 6
      }
      break
    }
    case 'portrait': {
      // natural skin and hair tones, whatever the palette; the palette colors the clothes and the backdrop
      const skin = SKIN_TONES[seed % SKIN_TONES.length]
      const hair = HAIR_TONES[Math.floor(seed / 7) % HAIR_TONES.length]
      body += `<circle cx="400" cy="640" r="250" fill="${p.a}"/>`
      body += `<rect x="360" y="330" width="80" height="90" rx="30" fill="${skin}"/>`
      body += `<circle cx="400" cy="250" r="110" fill="${skin}"/>`
      body += `<path d="M290,240 q10,-140 110,-140 q100,0 110,140 q-40,-70 -110,-70 q-70,0 -110,70 Z" fill="${hair}"/>`
      body += `<circle cx="362" cy="262" r="8" fill="${p.ink}"/><circle cx="438" cy="262" r="8" fill="${p.ink}"/>`
      body += `<path d="M370,308 q30,22 60,0" fill="none" stroke="${p.ink}" stroke-width="6" stroke-linecap="round"/>`
      break
    }
    case 'product': {
      body += `<ellipse cx="400" cy="522" rx="190" ry="26" fill="${p.ink}" opacity=".16"/>`
      body += `<path d="M250,150 h300 l30,60 v270 q0,40 -40,40 h-280 q-40,0 -40,-40 v-270 Z" fill="${p.a}"/>`
      body += `<path d="M250,150 h300 l30,60 h-360 Z" fill="${p.ink}" opacity=".22"/>`
      body += `<rect x="250" y="120" width="300" height="34" rx="8" fill="${p.ink}" opacity=".85"/>`
      body += `<rect x="290" y="270" width="220" height="150" rx="16" fill="${p.paper}"/>`
      body += `<circle cx="400" cy="318" r="30" fill="${p.c}"/>`
      body += `<rect x="322" y="366" width="156" height="12" rx="6" fill="${p.ink}" opacity=".7"/><rect x="346" y="390" width="108" height="10" rx="5" fill="${p.ink}" opacity=".4"/>`
      break
    }
    case 'cup': {
      body += `<ellipse cx="400" cy="470" rx="250" ry="36" fill="${p.ink}" opacity=".14"/>`
      body += `<ellipse cx="400" cy="440" rx="230" ry="42" fill="${p.paper}"/>`
      body += `<path d="M230,250 h340 v90 q0,110 -170,110 q-170,0 -170,-110 Z" fill="${p.a}"/>`
      body += `<path d="M570,290 h34 q60,0 60,52 q0,52 -60,52 h-44" fill="none" stroke="${p.a}" stroke-width="26" stroke-linecap="round"/>`
      body += `<ellipse cx="400" cy="252" rx="170" ry="30" fill="${p.ink}" opacity=".85"/>`
      body += `<ellipse cx="400" cy="250" rx="140" ry="20" fill="${p.b}" opacity=".7"/>`
      for (let i = 0; i < 3; i++) body += `<path d="M${340 + i * 60},210 q-24,-34 0,-64 q24,-30 0,-64" fill="none" stroke="${p.paper}" stroke-width="10" stroke-linecap="round" opacity=".8"/>`
      for (let i = 0; i < 7; i++) body += `<ellipse cx="${(80 + r() * 640).toFixed(0)}" cy="${(500 + r() * 60).toFixed(0)}" rx="14" ry="9" transform="rotate(${(r() * 180).toFixed(0)} 400 500)" fill="${p.ink}" opacity=".55"/>`
      break
    }
    case 'chart': {
      body += `<rect x="80" y="80" width="640" height="440" rx="28" fill="${p.paper}"/>`
      for (let i = 0; i < 4; i++) body += `<line x1="120" y1="${160 + i * 90}" x2="680" y2="${160 + i * 90}" stroke="${p.ink}" opacity=".12" stroke-width="2"/>`
      const bars = 7
      let last = ''
      for (let i = 0; i < bars; i++) {
        const h = 60 + (i / bars) * 200 + r() * 70
        const x = 130 + i * 78
        body += `<rect x="${x}" y="${(480 - h).toFixed(0)}" width="46" height="${h.toFixed(0)}" rx="10" fill="${[p.a, p.b][i % 2]}"/>`
        last += `${i === 0 ? 'M' : 'L'}${x + 23},${(470 - h - 26).toFixed(0)} `
      }
      body += `<path d="${last}" fill="none" stroke="${p.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
      break
    }
    case 'food': {
      body += `<circle cx="400" cy="310" r="240" fill="${p.paper}"/><circle cx="400" cy="310" r="200" fill="${p.a}" opacity=".35"/>`
      for (let i = 0; i < 9; i++) {
        const ang = r() * Math.PI * 2
        const rad = 30 + r() * 140
        body += `<circle cx="${(400 + Math.cos(ang) * rad).toFixed(0)}" cy="${(310 + Math.sin(ang) * rad).toFixed(0)}" r="${(24 + r() * 34).toFixed(0)}" fill="${[p.a, p.b, p.c, p.ink][i % 4]}" opacity="${(0.7 + r() * 0.3).toFixed(2)}"/>`
      }
      break
    }
    case 'device': {
      body += `<rect x="150" y="90" width="500" height="340" rx="26" fill="${p.ink}"/>`
      body += `<rect x="168" y="108" width="464" height="304" rx="14" fill="${p.paper}"/>`
      body += `<rect x="168" y="108" width="464" height="46" rx="14" fill="${p.a}"/>`
      body += `<rect x="190" y="180" width="200" height="16" rx="8" fill="${p.ink}" opacity=".7"/><rect x="190" y="212" width="150" height="12" rx="6" fill="${p.ink}" opacity=".35"/>`
      body += `<rect x="190" y="250" width="180" height="140" rx="12" fill="${p.b}"/><rect x="400" y="180" width="210" height="100" rx="12" fill="${p.c}"/><rect x="400" y="292" width="210" height="98" rx="12" fill="${p.a}" opacity=".6"/>`
      body += `<path d="M100,470 h600 l-40,40 h-520 Z" fill="${p.ink}" opacity=".85"/>`
      break
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg}" stop-opacity=".82"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${body}</svg>`
}

/** A palette list in the order artSvg expects (backdrop first). */
function sceneList(palette: string[]): string[] {
  const p = sceneRoles(palette)
  return [p.bg, p.a, p.b, p.c, p.ink]
}

/** CSS value for background-image. */
export function sceneBackground(kind: SceneKind, palette: string[], seed = 1): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(sceneSvg(kind, palette, seed))}")`
}

/** The picture for a node: a real one if it has been generated, else the scene that matches its subject. */
export function imageCss(node: { id: string; label: string; art?: string; alt?: string; prompt?: string; src?: string }, palette: string[]): string {
  if (node.src) return `url("${node.src}")`
  const kind = (SCENE_KINDS as string[]).includes(node.art ?? '') ? (node.art as SceneKind) : inferScene(node.art, node.label, node.alt, node.prompt)
  return sceneBackground(kind, palette, hashSeed(node.id))
}

/** The colors a design uses, as a palette for its pictures: the most used families first. */
export function treePalette(root: { classes?: string; children?: unknown[] } | null): string[] {
  if (!root) return FALLBACK_PALETTE
  const count = new Map<string, number>()
  const re = /\b(?:bg|text|border|from|via|to)-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g
  const walk = (n: { classes?: string; children?: unknown[] }) => {
    for (const m of (n.classes ?? '').matchAll(re)) count.set(m[1], (count.get(m[1]) ?? 0) + 1)
    for (const c of n.children ?? []) walk(c as { classes?: string; children?: unknown[] })
  }
  walk(root)
  // neutrals only set the mood; keep them out of the accent slots
  const neutral = new Set(['slate', 'gray', 'zinc', 'stone'])
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)
  const accents = ranked.filter((f) => !neutral.has(f))
  const base = ranked.find((f) => neutral.has(f)) ?? 'stone'
  if (accents.length === 0) return FALLBACK_PALETTE
  const [a1, a2 = a1, a3 = a2] = accents
  const dark = /bg-(?:zinc|slate|gray|stone)-9\d\d|bg-black/.test(JSON.stringify(root.classes ?? '') + JSON.stringify((root.children as { classes?: string }[] | undefined)?.[0]?.classes ?? ''))
  return dark
    ? [TAILWIND_SHADES[base][4], TAILWIND_SHADES[a1][2], TAILWIND_SHADES[a2][1], TAILWIND_SHADES[a3][3], TAILWIND_SHADES[base][0]]
    : [TAILWIND_SHADES[a1][0], TAILWIND_SHADES[a1][2], TAILWIND_SHADES[a2][1], TAILWIND_SHADES[a3][3], TAILWIND_SHADES[base][4]]
}

/**
 * A palette for pictures from a style's color tokens. It takes the brand colors (background, primary, accent, secondary,
 * foreground) and leaves out status colors such as destructive red and success green, which look wrong in a scene.
 */
export function stylePalette(colors: Record<string, string>): string[] {
  const keys = ['background', 'primary', 'accent', 'secondary', 'muted', 'foreground']
  const seen = new Set<string>()
  const picked: string[] = []
  for (const k of keys) {
    const rgb = parseColor(colors[k])
    if (!rgb) continue
    const hex = toHex(rgb)
    if (seen.has(hex)) continue
    seen.add(hex)
    picked.push(hex)
  }
  return picked.length >= 3 ? picked : FALLBACK_PALETTE
}
