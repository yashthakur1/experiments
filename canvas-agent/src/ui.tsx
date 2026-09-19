import { useEffect, useRef } from 'react'
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
