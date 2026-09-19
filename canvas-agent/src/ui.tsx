import { useEffect, useRef, type RefObject } from 'react'
import { motion } from 'framer-motion'

/* Shared UI atoms for both canvas pages. */

export function DotSpinner({ className = 'bg-amber-400' }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`size-1 rounded-full ${className}`}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

/**
 * paper.design-style agent presence: a halftone dot matrix hovering above
 * the artboard while the agent writes, pulsing in a loose left-to-right
 * wave with a few accent dots. Deterministic pseudo-randomness per dot.
 */
export function AgentActivityDots({ label, accent = 'bg-blue-500' }: { label?: string; accent?: string }) {
  const COLS = 20
  const ROWS = 3
  return (
    <div className="pointer-events-none flex items-center gap-3">
      {label && (
        <span className="max-w-[300px] truncate whitespace-nowrap font-mono text-[10px] text-zinc-500">{label}…</span>
      )}
      <div
        className="grid grid-flow-col gap-[5px]"
        style={{ gridTemplateRows: `repeat(${ROWS}, 5px)` }}
      >
        {Array.from({ length: COLS * ROWS }).map((_, i) => {
          const h = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 // stable per-dot hash
          const isAccent = h > 0.8
          const col = Math.floor(i / ROWS)
          return (
            <motion.span
              key={i}
              className={`size-[5px] rounded-full ${isAccent ? accent : 'bg-zinc-400'}`}
              initial={{ opacity: 0.12 }}
              animate={{ opacity: [0.12, 0.15 + h * 0.75, 0.12] }}
              transition={{
                duration: 1.4 + h * 0.9,
                repeat: Infinity,
                delay: col * 0.09 + h * 0.6,
                ease: 'easeInOut',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * A floating agent cursor with a name tag, like a collaborator in Figma.
 *
 * It finds the DOM node the agent is building (`[data-node-id]`), works out
 * where a designer would be pointing — the end of the text being typed, the
 * middle of a shape being drawn, the corner of a new section — and glides
 * there on a damped spring. X and Y use different stiffness so the path
 * curves instead of running in a straight line, and a slow drift keeps it
 * alive between moves. Position is written straight to the DOM in a rAF loop,
 * so a fast token stream never re-renders React.
 *
 * `containerRef` must be a `position: relative` element that wraps the artboard.
 */
export function AgentCursor({
  containerRef,
  targetId,
  active,
  name,
  color = '#d946ef',
}: {
  containerRef: RefObject<HTMLElement | null>
  targetId: string | null
  active: boolean
  name: string
  color?: string
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const moverRef = useRef<HTMLDivElement>(null)
  const targetIdRef = useRef<string | null>(targetId)

  useEffect(() => {
    targetIdRef.current = targetId
  }, [targetId])

  useEffect(() => {
    const outer = outerRef.current
    const mover = moverRef.current
    const container = containerRef.current
    if (!active || !outer || !mover || !container) return

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const STIFF_X = calm ? 220 : 34
    const STIFF_Y = calm ? 220 : 22
    const MAX_SPEED = calm ? 4000 : 950 // px/s
    const DAMPING = 0.82 // < 1: a whisper of overshoot, which reads as hand-driven

    /** Where the tip of the cursor should be, in container coordinates. */
    const readTarget = (now: number, last: { x: number; y: number } | null): { x: number; y: number } => {
      const box = container.getBoundingClientRect()
      const id = targetIdRef.current
      const el = id ? container.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`) : null

      if (!el) {
        // Nothing to build on yet: idle around the middle of the empty frame.
        const w = box.width
        return {
          x: w * 0.5 + Math.sin(now / 1900) * w * 0.14,
          y: Math.min(box.height, 480) * 0.5 + Math.cos(now / 2300) * 50,
        }
      }

      const r = el.getBoundingClientRect()
      const isBranch = el.querySelector('[data-node-id]') !== null
      const text = (el.textContent ?? '').replace(/·/g, '').trim()
      let x: number
      let y: number
      if (isBranch) {
        // a section has just opened: the designer starts at its top-left corner
        x = r.left + Math.min(36, r.width * 0.2)
        y = r.top + Math.min(28, r.height * 0.3)
      } else if (text) {
        // typing: sit just after the last line of text
        const range = document.createRange()
        range.selectNodeContents(el)
        const lines = range.getClientRects()
        const tail = lines[lines.length - 1] ?? r
        x = tail.right + 4
        y = tail.top + tail.height * 0.6
      } else {
        // drawing a shape: lean toward the lower right of it
        x = r.left + r.width * 0.62
        y = r.top + r.height * 0.62
      }
      const local = { x: x - box.left, y: y - box.top }
      // keep it on the artboard, and ignore sub-pixel layout jitter
      local.x = Math.max(8, Math.min(box.width - 8, local.x))
      local.y = Math.max(8, Math.min(box.height - 8, local.y))
      if (last && Math.abs(last.x - local.x) < 1 && Math.abs(last.y - local.y) < 1) return last
      return local
    }

    const pos = { x: 0, y: 0 }
    const vel = { x: 0, y: 0 }
    let tilt = 0
    let started = false
    let lastTarget: { x: number; y: number } | null = null
    let prev = performance.now()
    let raf = 0

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - prev) / 1000)
      prev = now
      const target = readTarget(now, lastTarget)
      lastTarget = target
      // slow drift so the cursor never looks pinned
      const tx = target.x + (calm ? 0 : Math.sin(now / 850) * 2.6)
      const ty = target.y + (calm ? 0 : Math.cos(now / 1100) * 2.6)

      if (!started) {
        started = true
        pos.x = tx - 130 // glide in from up and to the left
        pos.y = ty - 90
        outer.style.opacity = '1'
      }

      vel.x += (STIFF_X * (tx - pos.x) - 2 * DAMPING * Math.sqrt(STIFF_X) * vel.x) * dt
      vel.y += (STIFF_Y * (ty - pos.y) - 2 * DAMPING * Math.sqrt(STIFF_Y) * vel.y) * dt
      // long hops glide instead of snapping: cap the pointer speed
      const speed = Math.hypot(vel.x, vel.y)
      if (speed > MAX_SPEED) {
        vel.x *= MAX_SPEED / speed
        vel.y *= MAX_SPEED / speed
      }
      pos.x += vel.x * dt
      pos.y += vel.y * dt

      // lean into the motion, like a hand pulling the pointer along
      const goal = calm ? 0 : Math.max(-12, Math.min(12, vel.x * 0.014))
      tilt += (goal - tilt) * Math.min(1, dt * 7)

      mover.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0) rotate(${tilt.toFixed(2)}deg)`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      outer.style.opacity = '0' // fades out where it stopped
    }
  }, [active, containerRef])

  return (
    <div
      ref={outerRef}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-50"
      style={{ opacity: 0, transition: 'opacity 0.4s ease' }}
    >
      <div ref={moverRef} className="absolute top-0 left-0" style={{ transformOrigin: '0 0', willChange: 'transform' }}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="absolute"
          style={{ left: -5.5, top: -3.2, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}
        >
          <path
            d="M5.5 3.2 5.5 18.4 9.6 14.6 12.3 20.9 14.9 19.8 12.2 13.6 17.8 13.6Z"
            fill={color}
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="absolute left-3 top-4 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium leading-5 text-white"
          style={{ background: color, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          {name}
        </span>
      </div>
    </div>
  )
}

export interface AgentStep {
  id: number
  label: string
  state: 'active' | 'done' | 'error'
}

let stepSeq = 0
export const nextStepId = () => ++stepSeq

interface FeedProps {
  instruction: string | null
  steps: AgentStep[]
  doneSummary: string | null
  running: boolean
  emptyHint: string
}

export function AgentFeed({ instruction, steps, doneSummary, running, emptyHint }: FeedProps) {
  const feedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [steps, doneSummary])

  return (
    <div ref={feedRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 pb-4">
      {instruction === null ? (
        <p className="px-1 text-[11px] leading-relaxed text-zinc-600">{emptyHint}</p>
      ) : (
        <>
          <div className="ml-6 rounded-lg rounded-tr-sm border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-200">
            {instruction}
          </div>
          <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-2 font-mono text-[11px]">
                {step.state === 'active' && running ? (
                  <>
                    <span className="pt-1">
                      <DotSpinner />
                    </span>
                    <span className="text-amber-300">{step.label}…</span>
                  </>
                ) : step.state === 'error' ? (
                  <>
                    <span className="text-rose-500">✗</span>
                    <span className="text-rose-400">{step.label}</span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-500">✓</span>
                    <span className="text-zinc-500">{step.label}</span>
                  </>
                )}
              </div>
            ))}
            {doneSummary && (
              <div className="flex items-center gap-2 pt-0.5 font-mono text-[11px] font-semibold text-emerald-400">
                <span>✓</span>
                {doneSummary}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
