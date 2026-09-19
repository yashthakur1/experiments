import { useEffect, useState, type CSSProperties } from 'react'
import * as Lucide from 'lucide-react'
import type { ComponentDef, DesignSystem } from './lab'
import { nodeStyle, resolveStyle } from './lab'
import {
  ART_KINDS,
  artPalette,
  artSvg,
  colorOf,
  contrast,
  googleFontsHref,
  grade,
  ramp,
  scaleType,
  type ArtKind,
  type FontSpec,
  type IconSpec,
  type ImageTreatment,
} from './language'

/* ================================================================== *
 *  The sheet sections for the rest of a design language:
 *  color adaptations, fonts, text adaptations, component states,
 *  icons, overlays and images. Inline styles, like the rest of the
 *  guideline sheet, so it looks the same on any app theme.
 * ================================================================== */

const MONO = { fontSize: 10, opacity: 0.55 } as const
const hairline = '1px solid rgba(128,128,128,0.25)'

/* ------------------------------ web fonts ------------------------------ */

const loaded = new Set<string>()

/** Loads a language's Google Fonts once. The stylesheet is open-licensed and free; offline it simply fails and the fallback stack shows. */
export function useGoogleFonts(fonts: FontSpec[] | undefined): Record<string, 'loading' | 'ready' | 'fallback'> {
  const [status, setStatus] = useState<Record<string, 'loading' | 'ready' | 'fallback'>>({})
  const key = (fonts ?? []).map((f) => `${f.family}:${f.weights.join(',')}`).join('|')
  useEffect(() => {
    const list = fonts ?? []
    const href = googleFontsHref(list)
    if (!href) return
    if (!loaded.has(href)) {
      loaded.add(href)
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
    let cancelled = false
    setStatus(Object.fromEntries(list.map((f) => [f.family, 'loading' as const])))
    list.forEach((f) => {
      const done = (ok: boolean) => !cancelled && setStatus((s) => ({ ...s, [f.family]: ok ? 'ready' : 'fallback' }))
      const timer = window.setTimeout(() => done(document.fonts.check(`16px "${f.family}"`)), 5000)
      document.fonts
        .load(`16px "${f.family}"`)
        .then((faces) => {
          window.clearTimeout(timer)
          done(faces.length > 0)
        })
        .catch(() => done(false))
    })
    return () => {
      cancelled = true
    }
    // key covers fonts by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return status
}

/* ------------------------------- glyphs & art ------------------------------- */

/** One lucide glyph, drawn with the language's icon rules. */
export function LangIcon({ name, spec, size, color, style }: { name: string; spec: IconSpec; size?: number; color?: string; style?: CSSProperties }) {
  const Glyph = (Lucide as unknown as Record<string, React.ComponentType<Record<string, unknown>>>)[name] ?? Lucide.Circle
  const px = size ?? spec.size
  const glyph = <Glyph size={px} strokeWidth={spec.stroke} strokeLinecap={spec.cap === 'round' ? 'round' : 'butt'} strokeLinejoin={spec.cap === 'round' ? 'round' : 'miter'} color={color ?? 'currentColor'} />
  if (spec.container === 'none') return <span style={{ display: 'inline-flex', ...style }}>{glyph}</span>
  const pad = Math.round(px * 0.55)
  const radius = spec.container === 'circle' ? '9999px' : spec.container === 'rounded' ? `${Math.round(px * 0.35)}px` : '0px'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: pad, borderRadius: radius, background: 'rgba(128,128,128,0.14)', ...style }}>
      {glyph}
    </span>
  )
}

/** The CSS for a picture node: generated art, cropped by a named treatment. */
export function imageStyle(system: DesignSystem, image: { art?: ArtKind; treatment?: string; seed?: number }): CSSProperties {
  const images = system.extras?.images
  const treatment = images?.treatments.find((t) => t.name.toLowerCase() === (image.treatment ?? '').toLowerCase()) ?? images?.treatments[1]
  const art = artSvg(image.art ?? images?.art ?? 'blobs', artPalette(system.tokens.color), image.seed ?? 1)
  return treatmentStyle(system, treatment, art)
}

function treatmentStyle(system: DesignSystem, t: ImageTreatment | undefined, art: string): CSSProperties {
  const resolved = resolveStyle({ borderRadius: t?.radius ?? '12px' }, system.tokens)
  return {
    aspectRatio: t?.ratio ?? '4/3',
    ...resolved,
    backgroundImage: t?.overlay ? `${t.overlay}, ${art}` : art,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    ...(t?.filter ? { filter: t.filter } : {}),
    ...(t?.frame ? { border: t.frame } : {}),
    overflow: 'hidden',
  }
}

/* ------------------------------- small pieces ------------------------------- */

function Sub({ title, note, source }: { title: string; note?: string; source?: 'derived' | 'model' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 12px' }}>
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 700 }}>{title}</span>
      {source && (
        <span className="font-mono" title={source === 'model' ? 'Chosen by the model for this language' : 'Derived by code from the tokens'} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 9999, border: hairline, opacity: 0.7 }}>
          {source === 'model' ? 'model-chosen' : 'derived'}
        </span>
      )}
      {note && <span className="font-mono" style={{ ...MONO, opacity: 0.45 }}>{note}</span>}
    </div>
  )
}

const px = (n: number) => `${n}px`

/* --------------------------- color adaptations --------------------------- */

export function ColorAdaptations({ system }: { system: DesignSystem }) {
  const extras = system.extras
  if (!extras) return null
  const light = system.tokens.color
  const dark = { ...light, ...extras.themes.dark }
  const names = Object.keys(light)
  const keyPairs = [
    ['ink', 'surface'],
    ['surface', 'ink'],
    ['accent', 'surface'],
    ['surface', 'accent'],
  ] as const
  const roleRef = (system.extras && (system.extras.textAdaptations.surfaces[0]?.bg && system.extras.textAdaptations.surfaces)) || []
  const surfaceRef = roleRef[0]?.bg ?? '#ffffff'
  const inkRef = roleRef[1]?.bg ?? '#000000'
  const accentRef = roleRef[2]?.bg ?? '#3b6cf6'
  const refOf = { surface: surfaceRef, ink: inkRef, accent: accentRef }
  const rows = (palette: Record<string, string>) =>
    keyPairs.map(([fg, bg]) => {
      const f = colorOf(refOf[fg], palette)
      const b = colorOf(refOf[bg], palette)
      const ratio = f && b ? contrast(f, b) : 0
      return { label: `${fg} on ${bg}`, ratio, grade: grade(ratio) }
    })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <Sub title="Tint ramps" note="9 steps per color, the brand color sits at 500" source="derived" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {names.map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-mono" style={{ ...MONO, width: 74 }}>{n}</span>
              <div style={{ display: 'flex', flex: 1, maxWidth: 560, borderRadius: 8, overflow: 'hidden', border: hairline }}>
                {ramp(light[n]).map((c, i) => (
                  <div key={i} title={`${n} ${(i + 1) * 100} · ${c}`} style={{ flex: 1, height: 26, background: c }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Sub title="Light and dark" note="every color token, side by side" source={system.extras?.source.themes} />
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {([['Light', light], ['Dark', dark]] as const).map(([label, palette]) => (
            <div key={label} style={{ flex: '1 1 300px', maxWidth: 420, borderRadius: 12, border: hairline, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {names.map((n) => (
                  <div key={n} title={`${n} · ${palette[n]}`} style={{ flex: '1 0 25%', height: 46, background: palette[n] }} />
                ))}
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="font-mono" style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</span>
                {rows(palette).map((r) => (
                  <span key={r.label} className="font-mono" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                    <span>{r.label}</span>
                    <span style={{ color: r.grade === 'fail' ? '#d33' : undefined }}>{r.ratio.toFixed(1)}:1 · {r.grade}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- fonts ---------------------------------- */

export function FontSpecimens({ system }: { system: DesignSystem }) {
  const fonts = system.extras?.fonts ?? []
  const status = useGoogleFonts(fonts)
  const stacks = system.tokens.font
  const roles = Object.entries(stacks)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Sub title="Font families" note="loaded from Google Fonts (open license)" source={system.extras?.source.fonts} />
      {fonts.length === 0 && <p className="font-mono" style={MONO}>This language uses system fonts only (no web font loaded).</p>}
      {roles.map(([role, stack]) => {
        const spec = fonts.find((f) => f.role === role)
        const st = spec ? status[spec.family] : undefined
        return (
          <div key={role} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 18, borderBottom: hairline }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="font-mono" style={{ fontSize: 11, fontWeight: 700 }}>{role}</span>
              <span className="font-mono" style={MONO}>{stack}</span>
              {st && <span className="font-mono" style={{ fontSize: 9, opacity: 0.6 }}>{st === 'ready' ? '● loaded' : st === 'loading' ? '○ loading…' : '◌ offline, using the fallback'}</span>}
            </div>
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: stack, fontSize: 76, lineHeight: 1, fontWeight: 600 }}>Aa</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: stack, fontSize: 22, lineHeight: 1.3 }}>The quick brown fox jumps over the lazy dog</span>
                <span style={{ fontFamily: stack, fontSize: 15, opacity: 0.75, letterSpacing: '0.02em' }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ · abcdefghijklmnopqrstuvwxyz · 0123456789</span>
                <span style={{ fontFamily: stack, fontSize: 15, opacity: 0.75 }}>春の花 · さくら · ひらがな · カタカナ</span>
              </div>
            </div>
            {spec && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {spec.weights.map((w) => (
                  <span key={w} style={{ fontFamily: stack, fontWeight: w, fontSize: 17 }}>
                    {w} <span className="font-mono" style={{ ...MONO, fontWeight: 400 }}>{spec.family}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {fonts.length >= 2 && (
        <div style={{ borderRadius: 12, border: hairline, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="font-mono" style={MONO}>pairing</span>
          <span style={{ fontFamily: stacks.display ?? stacks.body, fontSize: 32, lineHeight: 1.15, fontWeight: 700 }}>{system.name} speaks in two voices</span>
          <span style={{ fontFamily: stacks.body, fontSize: 16, lineHeight: 1.6, maxWidth: 560, opacity: 0.85 }}>{system.philosophy || 'A headline face carries the mood; a quiet body face carries the reading.'}</span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------ text adaptations ------------------------------ */

export function TextAdaptationsSection({ system }: { system: DesignSystem }) {
  const ta = system.extras?.textAdaptations
  if (!ta) return null
  const t = system.tokens
  const display = t.type.display ?? t.type.h1 ?? Object.values(t.type)[0]
  const body = t.type.body ?? Object.values(t.type).slice(-1)[0]
  const c = t.color
  const font = (k: 'display' | 'body') => t.font[k] ?? t.font.body
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Sub title="Text on surfaces" note="the pair to use on each background, with its contrast" source={system.extras?.source.textAdaptations} />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {ta.surfaces.map((s) => {
            const bg = colorOf(s.bg, c)
            const tx = colorOf(s.text, c)
            const ratio = bg && tx ? contrast(tx, bg) : 0
            const r = resolveStyle({ background: s.bg, color: s.text }, t)
            const muted = resolveStyle({ color: s.muted }, t).color
            return (
              <div key={s.name} style={{ ...r, flex: '1 1 210px', maxWidth: 270, borderRadius: 12, padding: '16px 18px', border: hairline, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="font-mono" style={{ fontSize: 9.5, opacity: 0.75 }}>{s.name} · {ratio.toFixed(1)}:1 {grade(ratio)}</span>
                <span style={{ fontFamily: font('display'), fontSize: '30px', fontWeight: display?.weight ?? 700, lineHeight: 1.1 }}>Headline</span>
                <span style={{ fontFamily: font('body'), fontSize: body?.size ?? '16px', lineHeight: body?.lineHeight ?? 1.5 }}>Body copy on this surface stays readable.</span>
                <span style={{ fontFamily: font('body'), fontSize: '13px', color: muted }}>Muted supporting line</span>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <Sub title="Across devices" note="large text shrinks, small text stays readable" source="derived" />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {ta.scales.map((sc) => (
            <div key={sc.device} style={{ flex: '1 1 200px', maxWidth: 300, borderRadius: 12, border: hairline, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
              <span className="font-mono" style={{ fontSize: 9.5, opacity: 0.6 }}>{sc.device} · ×{sc.factor}</span>
              {Object.entries(t.type).slice(0, 4).map(([k, ts]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, overflow: 'hidden' }}>
                  <span style={{ fontFamily: k === 'display' || k.startsWith('h') ? font('display') : font('body'), fontSize: scaleType(ts.size, sc.factor), fontWeight: ts.weight, lineHeight: ts.lineHeight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {k === 'body' ? 'Body text' : k === 'small' || k === 'caption' ? 'Small text' : 'Bloom'}
                  </span>
                  <span className="font-mono" style={{ fontSize: 9, opacity: 0.5, flexShrink: 0 }}>{k} {scaleType(ts.size, sc.factor)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div>
        <Sub title="Text rules" source={system.extras?.source.textAdaptations} />
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: 0, padding: 0, listStyle: 'none' }}>
          {ta.rules.map((r, i) => (
            <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.8 }}>◆ {r}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* -------------------------------- states -------------------------------- */

/** Every state of one component, side by side. */
export function StatesRow({ component, system }: { component: ComponentDef; system: DesignSystem }) {
  const states = component.states ?? {}
  const names = Object.keys(states)
  if (names.length === 0) return null
  const base = resolveStyle(component.base, system.tokens)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', paddingTop: 6, borderTop: '1px dashed rgba(128,128,128,0.25)' }}>
      <span className="font-mono" style={{ ...MONO, width: '100%', opacity: 0.4 }}>states</span>
      {names.map((n) => (
        <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ ...base, ...resolveStyle(states[n], system.tokens), position: 'relative', ...(n === 'loading' ? { paddingRight: 34 } : {}) }}>
            {component.preview}
            {n === 'loading' && (
              <span style={{ position: 'absolute', right: 10, top: '50%', width: 13, height: 13, marginTop: -7, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.9s linear infinite' }} />
            )}
          </div>
          <span className="font-mono" style={{ fontSize: 9, opacity: 0.45 }}>{n}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------- icons ---------------------------------- */

export function IconsSection({ system }: { system: DesignSystem }) {
  const spec = system.extras?.icons
  if (!spec) return null
  const roles = system.extras!.textAdaptations.surfaces
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Sub title="Icon set" note={`${spec.glyphs.length} glyphs · stroke ${spec.stroke}px · ${spec.cap} caps · ${spec.container} container · ${spec.size}px`} source={system.extras?.source.icons} />
      {spec.note && <p style={{ fontSize: 12.5, opacity: 0.75, maxWidth: 560, lineHeight: 1.5, margin: 0 }}>{spec.note}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {spec.glyphs.map((g) => (
          <div key={g} style={{ width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 4px', borderRadius: 10, border: hairline }}>
            <LangIcon name={g} spec={{ ...spec, container: 'none' }} size={spec.size + 6} />
            <span className="font-mono" style={{ fontSize: 9, opacity: 0.55 }}>{g}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <span className="font-mono" style={MONO}>sizes</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginTop: 8 }}>
            {[16, 20, 24, 32, 40].map((s) => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <LangIcon name={spec.glyphs[0]} spec={{ ...spec, container: 'none' }} size={s} />
                <span className="font-mono" style={{ fontSize: 9, opacity: 0.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <span className="font-mono" style={MONO}>in a container</span>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {spec.glyphs.slice(0, 4).map((g) => (
              <LangIcon key={g} name={g} spec={spec} size={spec.size} />
            ))}
          </div>
        </div>
        <div>
          <span className="font-mono" style={MONO}>on each surface</span>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {roles.map((s) => {
              const r = resolveStyle({ background: s.bg, color: s.text }, system.tokens)
              return (
                <span key={s.name} style={{ ...r, display: 'inline-flex', padding: 12, borderRadius: 10, border: hairline }} title={s.name}>
                  <LangIcon name={spec.glyphs[2] ?? spec.glyphs[0]} spec={{ ...spec, container: 'none' }} />
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- overlays -------------------------------- */

export function OverlaysSection({ system }: { system: DesignSystem }) {
  const overlay = system.extras?.overlay
  const comps = system.components.filter((c) => c.overlay)
  if (!overlay || comps.length === 0) return null
  const page = resolveStyle(nodeStyle(system.page, system) as never, system.tokens)
  const stageBg = (page.background as string) ?? '#ffffff'
  const find = (k: string) => comps.find((c) => c.overlay === k)
  const inkPair = system.extras?.textAdaptations.surfaces[1]
  const render = (c: ComponentDef | undefined, extra?: CSSProperties) =>
    c ? (
      <div style={{ ...resolveStyle(c.base, system.tokens), ...extra }}>
        {c.overlay !== 'menu' && <span>{c.preview}</span>}
        {c.overlay === 'modal' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: hairline }}>Cancel</span>
            <span style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, ...resolveStyle({ background: inkPair?.bg ?? '#111', color: inkPair?.text ?? '#fff' }, system.tokens) }}>Save</span>
          </div>
        )}
        {c.overlay === 'menu' && ['Rename', 'Share', 'Delete'].map((x) => <span key={x} style={{ fontSize: 12.5, padding: '6px 8px', borderRadius: 6 }}>{x}</span>)}
      </div>
    ) : null
  const backdrop: CSSProperties = { position: 'absolute', inset: 0, background: overlay.scrim, backdropFilter: `blur(${overlay.blur})` }
  const fake = (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ height: 14, width: '55%', borderRadius: 4, background: 'currentColor', opacity: 0.18 }} />
      <div style={{ height: 9, width: '80%', borderRadius: 4, background: 'currentColor', opacity: 0.12 }} />
      <div style={{ height: 9, width: '70%', borderRadius: 4, background: 'currentColor', opacity: 0.12 }} />
      <div style={{ height: 60, width: '100%', borderRadius: 8, background: 'currentColor', opacity: 0.1 }} />
    </div>
  )
  const stage = (label: string, children: React.ReactNode, minH = 240) => (
    <div style={{ flex: '1 1 320px', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ position: 'relative', minHeight: minH, borderRadius: 12, border: hairline, overflow: 'hidden', background: stageBg as string, color: (page.color as string) ?? 'inherit' }}>{fake}{children}</div>
      <span className="font-mono" style={MONO}>{label}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Sub title="Overlay layer" note={`scrim ${overlay.scrim} · blur ${overlay.blur} · motion ${overlay.motion}`} source={system.extras?.source.overlays} />
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {stage('modal + scrim', <><div style={backdrop} /><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{render(find('modal'), { width: '78%', maxWidth: 300 })}</div></>)}
        {stage('drawer', <><div style={backdrop} /><div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, display: 'flex' }}>{render(find('drawer'), { height: '100%', width: 170, minHeight: 240 })}</div></>)}
        {stage('toast', <div style={{ position: 'absolute', right: 12, bottom: 12 }}>{render(find('toast'))}</div>)}
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="font-mono" style={MONO}>tooltip</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            {render(find('tooltip'))}
            <span style={{ fontSize: 12.5, padding: '6px 12px', borderRadius: 8, border: hairline }}>Hover me</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="font-mono" style={MONO}>popover</span>
          {render(find('popover'))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="font-mono" style={MONO}>menu</span>
          {render(find('menu'))}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- images --------------------------------- */

export function ImagesSection({ system }: { system: DesignSystem }) {
  const images = system.extras?.images
  if (!images) return null
  const palette = artPalette(system.tokens.color)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <Sub title="Image treatments" note="ratio, corner, filter and overlay for each use" source={system.extras?.source.images} />
        <p style={{ fontSize: 12.5, lineHeight: 1.55, opacity: 0.8, maxWidth: 580, margin: '0 0 14px' }}>{images.direction}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
          {images.treatments.map((t, i) => {
            const wide = parseFloat(t.ratio.split('/')[0]) / parseFloat(t.ratio.split('/')[1])
            const width = wide > 2 ? 300 : wide > 1.4 ? 220 : wide < 0.9 ? 120 : 150
            return (
              <div key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, width }}>
                <div style={{ border: hairline, ...treatmentStyle(system, t, artSvg(images.art, palette, i + 2)), width: '100%' }} />
                <span className="font-mono" style={{ fontSize: 10, fontWeight: 700 }}>{t.name}</span>
                <span className="font-mono" style={{ ...MONO, lineHeight: 1.4 }}>
                  {t.ratio} · radius {resolveStyle({ borderRadius: t.radius }, system.tokens).borderRadius as string}
                  {t.filter ? ` · ${t.filter}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <Sub title="Generated art" note="drawn in the palette; the language's own art is highlighted" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {ART_KINDS.map((k) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 110 }}>
              <div style={{ aspectRatio: '4/3', borderRadius: 10, backgroundImage: artSvg(k, palette, 7), backgroundSize: 'cover', border: k === images.art ? '2px solid currentColor' : hairline }} />
              <span className="font-mono" style={{ fontSize: 9, opacity: k === images.art ? 0.9 : 0.5, fontWeight: k === images.art ? 700 : 400 }}>{k}{k === images.art ? ' ★' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { px }
