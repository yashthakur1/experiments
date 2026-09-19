import { useCallback, useEffect, useRef, useState } from 'react'

/* ================================================================== *
 *  Page 3 — Science: the double-slit experiment, physically exact.
 *
 *  Screen pattern uses the real Fraunhofer result in real units:
 *      I(y) = I0 · cos²(π·d·y / λL) · sinc²(π·a·y / λL)
 *  (cos² term = two-slit interference, sinc² = single-slit envelope;
 *   one slit open drops the cos² term). Fringe spacing Δy = λL/d.
 *
 *  The wave-field view between barrier and screen is a Huygens
 *  superposition of coherent sub-sources across each slit — correct
 *  wave physics, but drawn at a compressed scale (real geometry is
 *  µm slits vs. a metre of flight; nothing legible survives a literal
 *  scale). The detection screen below is exact.
 *
 *  Photon mode reproduces the famous single-particle build-up:
 *  each photon lands at a position sampled from |ψ|², and the
 *  interference pattern emerges dot by dot.
 * ================================================================== */

/* ---------- physics ---------- */

const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x)

/** Exact screen intensity at position y (metres), everything in metres. */
function intensityAt(y: number, lambda: number, d: number, a: number, L: number, twoSlits: boolean): number {
  const sinTheta = y / Math.hypot(y, L)
  const beta = (Math.PI * a * sinTheta) / lambda // single-slit envelope
  const envelope = sinc(beta) ** 2
  if (!twoSlits) return envelope
  const alpha = (Math.PI * d * sinTheta) / lambda // two-slit interference
  return Math.cos(alpha) ** 2 * envelope
}

/** Approximate visible-wavelength → RGB (Bruton's algorithm). */
function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  if (nm < 440) { r = -(nm - 440) / 60; b = 1 }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1 }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20 }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1 }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65 }
  else { r = 1 }
  let f = 1
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40
  else if (nm > 700) f = 0.3 + (0.7 * (750 - nm)) / 50
  const gamma = 0.8
  return [
    Math.round(255 * (r * f) ** gamma),
    Math.round(255 * (g * f) ** gamma),
    Math.round(255 * (b * f) ** gamma),
  ]
}

/* ---------- component ---------- */

const FIELD_W = 880
const FIELD_H = 300
const SCREEN_W = 880
const SCREEN_H = 250
const SPAN_MM = 25 // detection screen shows ±25 mm

export default function PageScience() {
  const [lightOn, setLightOn] = useState(false)
  const [mode, setMode] = useState<'wave' | 'photon'>('wave')
  const [twoSlits, setTwoSlits] = useState(true)
  const [lambdaNm, setLambdaNm] = useState(560) // wavelength, nm
  const [dUm, setDUm] = useState(60) // slit separation, µm
  const [aUm, setAUm] = useState(12) // slit width, µm
  const [Lm, setLm] = useState(1.0) // screen distance, m
  const [photonCount, setPhotonCount] = useState(0)

  const fieldRef = useRef<HTMLCanvasElement>(null)
  const screenRef = useRef<HTMLCanvasElement>(null)
  const photonRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const countRef = useRef(0)
  const cdfRef = useRef<Float64Array | null>(null)

  const [r, g, b] = wavelengthToRGB(lambdaNm)
  const beamColor = `rgb(${r},${g},${b})`
  const fringeMm = ((lambdaNm * 1e-9 * Lm) / (dUm * 1e-6)) * 1000

  /* ----- wave-field view (Huygens superposition, compressed scale) ----- */
  useEffect(() => {
    const canvas = fieldRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0b0b0f'
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)

    const barrierX = 150
    const screenX = FIELD_W - 60
    const cy = FIELD_H / 2
    // compressed display scale: preserves qualitative behaviour of every knob
    const lambdaPx = 8 + ((lambdaNm - 380) / 320) * 9 // 8..17 px
    const dPx = 26 + ((dUm - 20) / 180) * 90 // 26..116 px
    const aPx = 4 + ((aUm - 4) / 36) * 14 // 4..18 px
    const k = (2 * Math.PI) / lambdaPx

    // slit centres
    const centres = twoSlits ? [cy - dPx / 2, cy + dPx / 2] : [cy]
    // Huygens sub-sources across each slit width
    const sources: number[] = []
    for (const c of centres) {
      for (let s = 0; s < 5; s++) sources.push(c - aPx / 2 + (aPx * s) / 4)
    }

    if (lightOn) {
      // incoming plane wave (left of barrier)
      for (let x = 20; x < barrierX - 4; x += lambdaPx) {
        ctx.strokeStyle = `rgba(${r},${g},${b},0.28)`
        ctx.beginPath()
        ctx.moveTo(x, cy - 70)
        ctx.lineTo(x, cy + 70)
        ctx.stroke()
      }
      // time-averaged intensity field: |Σ e^{ikr}/√r|²
      const step = 2
      const img = ctx.createImageData(FIELD_W, FIELD_H)
      const data = img.data
      let maxI = 0
      const rows = Math.ceil(FIELD_H / step)
      const cols = Math.ceil((screenX - barrierX) / step)
      const buf = new Float64Array(rows * cols)
      for (let iy = 0; iy < rows; iy++) {
        const y = iy * step
        for (let ix = 0; ix < cols; ix++) {
          const x = barrierX + ix * step
          let re = 0, im = 0
          for (const sy of sources) {
            const dist = Math.hypot(x - barrierX, y - sy)
            if (dist < 1) continue
            const amp = 1 / Math.sqrt(dist)
            re += amp * Math.cos(k * dist)
            im += amp * Math.sin(k * dist)
          }
          const I = re * re + im * im
          buf[iy * cols + ix] = I
          if (I > maxI) maxI = I
        }
      }
      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const v = (buf[iy * cols + ix] / maxI) ** 0.55
          for (let py = 0; py < step; py++) {
            for (let px = 0; px < step; px++) {
              const X = barrierX + ix * step + px
              const Y = iy * step + py
              if (X >= screenX || Y >= FIELD_H) continue
              const o = (Y * FIELD_W + X) * 4
              data[o] = r * v
              data[o + 1] = g * v
              data[o + 2] = b * v
              data[o + 3] = 255 * Math.min(1, v * 1.3)
            }
          }
        }
      }
      ctx.putImageData(img, 0, 0)
      ctx.fillStyle = '#0b0b0f'
      ctx.fillRect(0, 0, barrierX, FIELD_H) // keep left region clean, redraw plane wave
      for (let x = 20; x < barrierX - 4; x += lambdaPx) {
        ctx.strokeStyle = `rgba(${r},${g},${b},0.28)`
        ctx.beginPath()
        ctx.moveTo(x, cy - 70)
        ctx.lineTo(x, cy + 70)
        ctx.stroke()
      }
    }

    // laser emitter
    ctx.fillStyle = '#2a2a33'
    ctx.fillRect(6, cy - 16, 16, 32)
    ctx.fillStyle = lightOn ? beamColor : '#44444d'
    ctx.fillRect(20, cy - 4, 6, 8)

    // barrier with slit gaps
    ctx.fillStyle = '#3a3a44'
    const gaps = centres.map((c) => [c - aPx / 2, c + aPx / 2])
    let cursor = 0
    for (const [g0, g1] of gaps) {
      ctx.fillRect(barrierX - 3, cursor, 6, g0 - cursor)
      cursor = g1
    }
    ctx.fillRect(barrierX - 3, cursor, 6, FIELD_H - cursor)

    // screen strip at right — exact physics, mapped from ±SPAN_MM
    for (let y = 0; y < FIELD_H; y++) {
      const ym = (((y - cy) / (FIELD_H / 2)) * SPAN_MM) / 1000
      const I = lightOn ? intensityAt(ym, lambdaNm * 1e-9, dUm * 1e-6, aUm * 1e-6, Lm, twoSlits) : 0
      ctx.fillStyle = `rgba(${r},${g},${b},${I})`
      ctx.fillRect(screenX + 6, y, 10, 1)
    }
    ctx.strokeStyle = '#3a3a44'
    ctx.strokeRect(screenX + 5.5, 0.5, 11, FIELD_H - 1)

    ctx.fillStyle = '#8b8b96'
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillText('laser', 4, cy + 34)
    ctx.fillText(twoSlits ? 'double slit' : 'single slit', barrierX - 26, 14)
    ctx.fillText('screen', screenX - 8, 14)
  }, [lightOn, twoSlits, lambdaNm, dUm, aUm, Lm, r, g, b, beamColor])

  /* ----- detection screen: exact intensity curve + glow strip ----- */
  useEffect(() => {
    const canvas = screenRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0b0b0f'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

    const stripH = 64
    const graphTop = stripH + 26
    const graphH = SCREEN_H - graphTop - 24

    // rebuild photon sampling CDF for current parameters
    const BINS = SCREEN_W
    const pdf = new Float64Array(BINS)
    let sum = 0
    for (let i = 0; i < BINS; i++) {
      const ym = (((i - BINS / 2) / (BINS / 2)) * SPAN_MM) / 1000
      pdf[i] = intensityAt(ym, lambdaNm * 1e-9, dUm * 1e-6, aUm * 1e-6, Lm, twoSlits)
      sum += pdf[i]
    }
    const cdf = new Float64Array(BINS)
    let acc = 0
    for (let i = 0; i < BINS; i++) {
      acc += pdf[i] / sum
      cdf[i] = acc
    }
    cdfRef.current = cdf

    if (lightOn) {
      // glow strip (hidden in photon mode — the photons ARE the record)
      if (mode === 'wave') {
        for (let i = 0; i < SCREEN_W; i++) {
          const I = pdf[i]
          ctx.fillStyle = `rgba(${r},${g},${b},${I})`
          ctx.fillRect(i, 6, 1, stripH)
        }
      }
      // exact intensity curve
      ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < SCREEN_W; i++) {
        const y = graphTop + graphH - pdf[i] * graphH
        if (i === 0) ctx.moveTo(i, y)
        else ctx.lineTo(i, y)
      }
      ctx.stroke()
    }
    ctx.strokeStyle = '#26262e'
    ctx.strokeRect(0.5, 5.5, SCREEN_W - 1, stripH + 1)
    ctx.strokeRect(0.5, graphTop - 0.5, SCREEN_W - 1, graphH + 1)

    // mm axis
    ctx.fillStyle = '#5b5b66'
    ctx.font = '9px ui-monospace, monospace'
    for (let mm = -20; mm <= 20; mm += 10) {
      const x = SCREEN_W / 2 + (mm / SPAN_MM) * (SCREEN_W / 2)
      ctx.fillText(`${mm}mm`, x - 10, SCREEN_H - 8)
      ctx.fillRect(x, graphTop + graphH, 1, 4)
    }
    ctx.fillText('I(y)', 6, graphTop + 12)

    // parameter change invalidates accumulated photons (different experiment)
    const pc = photonRef.current?.getContext('2d')
    if (pc) pc.clearRect(0, 0, SCREEN_W, 64)
    countRef.current = 0
    setPhotonCount(0)
  }, [lightOn, mode, twoSlits, lambdaNm, dUm, aUm, Lm, r, g, b])

  /* ----- photon-by-photon accumulation ----- */
  useEffect(() => {
    if (!lightOn || mode !== 'photon') return
    const canvas = photonRef.current
    const cdf = cdfRef.current
    if (!canvas || !cdf) return
    const ctx = canvas.getContext('2d')!
    let alive = true
    const tick = () => {
      if (!alive) return
      // ~24 photons per frame, positions sampled from |ψ|²
      for (let n = 0; n < 24; n++) {
        const u = Math.random()
        let lo = 0, hi = cdf.length - 1
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (cdf[mid] < u) lo = mid + 1
          else hi = mid
        }
        const x = lo + (Math.random() - 0.5)
        const y = 2 + Math.random() * 60
        ctx.fillStyle = `rgba(${r},${g},${b},0.85)`
        ctx.fillRect(x, y, 1.4, 1.4)
      }
      countRef.current += 24
      if (countRef.current % 240 === 0) setPhotonCount(countRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [lightOn, mode, twoSlits, lambdaNm, dUm, aUm, Lm, r, g, b])

  const resetPhotons = useCallback(() => {
    photonRef.current?.getContext('2d')?.clearRect(0, 0, SCREEN_W, 64)
    countRef.current = 0
    setPhotonCount(0)
  }, [])

  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    set: (v: number) => void,
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-600">
        {label}
        <span className="normal-case tracking-normal text-zinc-300">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        style={{ accentColor: beamColor }}
      />
    </label>
  )

  return (
    <div className="flex h-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* ============ Controls ============ */}
      <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-zinc-800/80 bg-zinc-950 thin-scroll">
        <header className="flex items-center gap-2.5 border-b border-zinc-800/80 px-5 py-4">
          <span className="relative flex size-2">
            {lightOn && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: beamColor }} />
            )}
            <span className="relative inline-flex size-2 rounded-full" style={{ background: lightOn ? beamColor : '#3f3f46' }} />
          </span>
          <div className="flex flex-col">
            <h1 className="text-[13px] font-semibold tracking-tight">Science Lab · Double-slit</h1>
            <p className="font-mono text-[10px] text-zinc-500">{lightOn ? 'coherent source on' : 'source off'}</p>
          </div>
        </header>

        <div className="flex flex-col gap-4 px-5 py-5">
          <button
            type="button"
            onClick={() => setLightOn((v) => !v)}
            className="rounded-lg px-3.5 py-2.5 text-[13px] font-semibold text-zinc-950 transition-transform active:scale-[0.99]"
            style={{ background: lightOn ? beamColor : '#3f3f46', color: lightOn ? '#0b0b0f' : '#a1a1aa' }}
          >
            {lightOn ? '■ Switch light off' : '☀ Shine the light'}
          </button>

          <div className="flex gap-2">
            {(['wave', 'photon'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg border px-2 py-1.5 font-mono text-[11px] transition-colors ${
                  mode === m ? 'border-zinc-500 bg-zinc-800 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {m === 'wave' ? 'wave view' : 'photon by photon'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setTwoSlits(v)}
                className={`flex-1 rounded-lg border px-2 py-1.5 font-mono text-[11px] transition-colors ${
                  twoSlits === v ? 'border-zinc-500 bg-zinc-800 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v ? 'two slits' : 'one slit'}
              </button>
            ))}
          </div>

          {slider('wavelength λ', lambdaNm, 380, 700, 1, ' nm', setLambdaNm)}
          {slider('slit separation d', dUm, 20, 200, 1, ' µm', setDUm)}
          {slider('slit width a', aUm, 4, 40, 1, ' µm', setAUm)}
          {slider('screen distance L', Lm, 0.5, 2, 0.05, ' m', setLm)}

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-zinc-400">
            fringe spacing Δy = λL/d = <span className="text-zinc-100">{fringeMm.toFixed(2)} mm</span>
            {mode === 'photon' && (
              <>
                <br />
                photons detected: <span className="text-zinc-100">{photonCount.toLocaleString()}</span>
              </>
            )}
          </div>

          {mode === 'photon' && (
            <button
              type="button"
              onClick={resetPhotons}
              className="self-start rounded-md px-2 py-1 font-mono text-[10px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
            >
              ✕ clear detector
            </button>
          )}

          <div className="space-y-3 border-t border-zinc-800/80 pt-4 text-[11.5px] leading-relaxed text-zinc-500">
            <p>
              <b className="text-zinc-300">The experiment.</b> Coherent light meets a barrier with two narrow slits.
              Each slit acts as a new wave source; where the waves meet in phase they brighten, out of phase they
              cancel — the striped pattern no particle theory of light could explain.
            </p>
            <p>
              <b className="text-zinc-300">The screen is exact:</b> I(y) = cos²(πdy/λL) · sinc²(πay/λL), real units.
              Close one slit and the stripes vanish, leaving only the single-slit envelope. The wave-field view is
              drawn at a compressed scale — real slits are µm apart across a metre of flight.
            </p>
            <p>
              <b className="text-zinc-300">Photon mode</b> replays the deeper mystery: photons arrive one at a time,
              each landing at a position sampled from |ψ|² — yet thousands of individual arrivals still draw the
              interference pattern. Each photon interferes with itself.
            </p>
          </div>
        </div>
      </aside>

      {/* ============ Apparatus ============ */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950 px-5">
          <span className="font-mono text-[11px] text-zinc-400">
            paper.design <span className="text-zinc-600">/</span> science-01 · young 1801
          </span>
          <span className="rounded-full border border-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
            λ {lambdaNm} nm · d {dUm} µm · a {aUm} µm · L {Lm.toFixed(2)} m
          </span>
          <span className="ml-auto truncate font-mono text-[10px] text-zinc-600">
            {twoSlits ? 'interference + diffraction' : 'diffraction only'}
          </span>
        </header>

        <div className="canvas-backdrop thin-scroll flex-1 overflow-auto bg-zinc-900">
          <div className="flex min-h-full flex-col items-center gap-6 px-8 py-10">
            <div className="w-[880px] max-w-full">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                Apparatus · top view <span className="normal-case tracking-normal">(field compressed for visibility)</span>
              </p>
              <canvas ref={fieldRef} width={FIELD_W} height={FIELD_H} className="w-full rounded-xl border border-zinc-800" />
            </div>
            <div className="relative w-[880px] max-w-full">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                Detection screen · exact physics, ±{SPAN_MM} mm
              </p>
              <canvas ref={screenRef} width={SCREEN_W} height={SCREEN_H} className="w-full rounded-xl border border-zinc-800" />
              <canvas
                ref={photonRef}
                width={SCREEN_W}
                height={64}
                className="pointer-events-none absolute left-0 w-full"
                style={{ top: 'calc(6px + 1.55rem)' }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
