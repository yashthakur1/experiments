import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { generateLayout, providerMeta, resolvedModel, type AIConfig, type CanvasNode, type ValidationResult } from './ai'
import { paletteOf, vocabularyStyleDirective, type SavedStyle } from './lab'
import type { CanvasState } from './projects'
import { countTree, findById, insertChild, lastNodeId, patchNode, sleep } from './tree'
import { AgentActivityDots, AgentCursor, AgentFeed, DotSpinner, nextStepId, type AgentStep } from './ui'

/* ================================================================== *
 *  Page 1 — Vocabulary canvas: the model designs inside a safelisted
 *  Tailwind vocabulary; output is validated, sanitized, and streamed
 *  onto the artboard node by node.
 * ================================================================== */

type WriteOp =
  | { kind: 'status'; label: string; pause: number }
  | { kind: 'add'; parentId: string | null; node: CanvasNode; pause: number }
  | { kind: 'text'; id: string; partial: string; pause: number }

function compileOps(frame: CanvasNode, sections: CanvasNode[]): WriteOp[] {
  const ops: WriteOp[] = []
  ops.push({ kind: 'add', parentId: null, node: { ...frame, children: [] }, pause: 350 })

  const emit = (node: CanvasNode, parentId: string) => {
    const isBranch = node.type === 'container' || node.type === 'grid'
    const streamText = node.type === 'text' && !!node.content
    ops.push({
      kind: 'add',
      parentId,
      node: { ...node, children: node.children ? [] : undefined, content: streamText ? '' : node.content },
      pause: isBranch ? 180 : 90,
    })
    if (streamText) {
      const words = node.content!.split(' ')
      for (let i = 2; i < words.length; i += 3) {
        ops.push({ kind: 'text', id: node.id, partial: words.slice(0, i + 1).join(' '), pause: 35 })
      }
      ops.push({ kind: 'text', id: node.id, partial: node.content!, pause: 45 })
    }
    node.children?.forEach((c) => emit(c, node.id))
  }

  for (const section of sections) {
    ops.push({ kind: 'status', label: `Rendering ${section.label}`, pause: 220 })
    emit(section, frame.id)
  }
  return ops
}

/* ------------------------------------------------------------------ *
 *  Recursive canvas renderer
 * ------------------------------------------------------------------ */

interface RendererProps {
  node: CanvasNode
  activeNodeId: string | null
  hoverNodeId: string | null
  buildingNodeId: string | null
  interactive: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

function CanvasRenderer(props: RendererProps) {
  const { node, activeNodeId, hoverNodeId, buildingNodeId, interactive, onSelect, onHover } = props
  const isActive = interactive && activeNodeId === node.id
  const isHovered = interactive && hoverNodeId === node.id && !isActive
  const isBuilding = buildingNodeId === node.id

  const ring = isBuilding
    ? 'ring-2 ring-fuchsia-400/80'
    : isActive
      ? 'ring-2 ring-blue-500'
      : isHovered
        ? 'ring-2 ring-blue-400/50'
        : 'ring-0 ring-transparent'

  const shared = {
    className: `relative ${node.classes} ${ring}`,
    'data-node-id': node.id,
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] as const },
    onClick: (e: React.MouseEvent) => {
      if (!interactive) return
      e.stopPropagation()
      onSelect(node.id)
    },
    onMouseOver: (e: React.MouseEvent) => {
      if (!interactive) return
      e.stopPropagation()
      onHover(node.id)
    },
    onMouseOut: (e: React.MouseEvent) => {
      if (!interactive) return
      e.stopPropagation()
      onHover(null)
    },
  }

  const selectionBadge = isActive && (
    <span className="pointer-events-none absolute -top-5 left-0 z-30 flex items-center gap-1 whitespace-nowrap rounded bg-blue-500 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white shadow-lg">
      {node.label}
      <span className="normal-case opacity-70">{`<${node.type}>`}</span>
    </span>
  )

  const children = node.children?.map((child) => <CanvasRenderer key={child.id} {...props} node={child} />)

  switch (node.type) {
    case 'button':
      return (
        <motion.button type="button" {...shared}>
          {node.content}
          {selectionBadge}
        </motion.button>
      )
    case 'text':
      return (
        <motion.div {...shared}>
          {node.content}
          {node.content === '' && <span className="opacity-0">·</span>}
          {selectionBadge}
        </motion.div>
      )
    case 'image':
      return (
        <motion.div {...shared} aria-label={node.label} role="img">
          {selectionBadge}
        </motion.div>
      )
    case 'container':
    case 'grid':
      return (
        <motion.div {...shared}>
          {children}
          {selectionBadge}
        </motion.div>
      )
  }
}

/* ------------------------------------------------------------------ *
 *  Page component
 * ------------------------------------------------------------------ */

const EXAMPLE_PROMPTS = [
  'A dark analytics dashboard for a crypto exchange',
  'A warm landing page for an artisan coffee roaster',
  'A pricing page for a developer API product',
]

interface PageProps {
  config: AIConfig
  openConfig: () => void
  /** Every design system: built-in and saved. */
  styles: SavedStyle[]
  styleId: string | null
  openDesign: () => void
  initial: CanvasState | null
  onPersist: (state: CanvasState) => void
}

export default function PageCanvas({ config, openConfig, styles, styleId, openDesign, initial, onPersist }: PageProps) {
  const [tree, setTree] = useState<CanvasNode | null>(initial?.tree ?? null)
  const [running, setRunning] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [instruction, setInstruction] = useState<string | null>(initial?.instruction ?? null)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [doneSummary, setDoneSummary] = useState<string | null>(initial?.doneSummary ?? null)
  const [buildingNodeId, setBuildingNodeId] = useState<string | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const runIdRef = useRef(0)
  const artboardRef = useRef<HTMLDivElement>(null)

  const selectedStyle = styleId ? (styles.find((s) => s.id === styleId) ?? null) : null

  const pushStatus = useCallback((label: string) => {
    setSteps((prev) => [
      ...prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)),
      { id: nextStepId(), label, state: 'active' },
    ])
  }, [])

  const failStatus = useCallback((label: string) => {
    setSteps((prev) => [
      ...prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)),
      { id: nextStepId(), label, state: 'error' },
    ])
  }, [])

  const runPrompt = useCallback(
    async (userPrompt: string) => {
      const trimmed = userPrompt.trim()
      if (!trimmed || running) return
      if (!config.apiKey.trim()) {
        openConfig()
        return
      }
      const myRun = ++runIdRef.current
      setRunning(true)
      setTree(null)
      setActiveNodeId(null)
      setHoverNodeId(null)
      setBuildingNodeId(null)
      setDoneSummary(null)
      setInstruction(trimmed)
      setSteps([])
      const started = performance.now()
      const model = resolvedModel(config)
      const styled = styleId ? (styles.find((s) => s.id === styleId) ?? null) : null

      pushStatus(
        `Contacting ${providerMeta(config.provider).label.split(' ')[0].toLowerCase()} · ${model}${styled ? ` — styled by “${styled.system.name}”` : ''}`,
      )

      const toTree = (v: ValidationResult): CanvasNode => ({
        id: 'root',
        type: 'container',
        label: v.layout.frameLabel,
        classes: `flex flex-col w-[1200px] rounded-xl overflow-hidden shadow-2xl ${v.layout.frameClasses}`,
        children: v.layout.sections,
      })

      let streamed = false
      let result
      try {
        result = await generateLayout(
          config,
          trimmed,
          (msg) => {
            if (runIdRef.current === myRun) pushStatus(msg)
          },
          styled ? vocabularyStyleDirective(styled.system) : undefined,
          (partial) => {
            // live: render each streamed snapshot the moment it parses
            if (runIdRef.current !== myRun) return
            if (!streamed) {
              streamed = true
              pushStatus('Streaming design onto canvas — live')
            }
            const t = toTree(partial)
            setTree(t)
            setBuildingNodeId(lastNodeId(t))
          },
        )
      } catch (err) {
        if (runIdRef.current !== myRun) return
        failStatus(`Generation failed — ${err instanceof Error ? err.message : String(err)}`)
        setRunning(false)
        onPersist({ tree: null, instruction: trimmed, doneSummary: null })
        return
      }
      if (runIdRef.current !== myRun) return

      if (result.droppedClasses.length > 0) {
        pushStatus(
          `Stripped ${result.droppedClasses.length} off-vocabulary class${result.droppedClasses.length === 1 ? '' : 'es'}: ${result.droppedClasses.slice(0, 4).join(', ')}${result.droppedClasses.length > 4 ? '…' : ''}`,
        )
      }

      let finalTree: CanvasNode | null = null
      if (streamed) {
        // canvas already reflects the stream — commit the fully validated tree
        finalTree = toTree(result)
        setTree(finalTree)
      } else {
        // provider didn't stream (or JSON arrived whole) — play back the build
        const frame: CanvasNode = { ...toTree(result), children: [] }
        for (const op of compileOps(frame, result.layout.sections)) {
          if (runIdRef.current !== myRun) return
          switch (op.kind) {
            case 'status':
              pushStatus(op.label)
              break
            case 'add':
              setTree((prev) => {
                finalTree = op.parentId === null || prev === null ? op.node : insertChild(prev, op.parentId, op.node)
                return finalTree
              })
              setBuildingNodeId(op.node.id)
              break
            case 'text':
              setTree((prev) => {
                finalTree = prev === null ? prev : patchNode(prev, op.id, { content: op.partial })
                return finalTree
              })
              break
          }
          await sleep(op.pause)
        }
      }

      if (runIdRef.current !== myRun) return
      const secs = ((performance.now() - started) / 1000).toFixed(1)
      const total = finalTree ? countTree(finalTree) : 0
      setBuildingNodeId(null)
      setSteps((prev) => prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' } : s)))
      const summary = `Done — ${total} nodes · ${model} · ${secs}s${streamed ? ' · streamed live' : ''}`
      setDoneSummary(summary)
      setRunning(false)
      onPersist({ tree: finalTree, instruction: trimmed, doneSummary: summary })
    },
    [config, running, openConfig, pushStatus, failStatus, styleId, styles, onPersist],
  )

  const clearCanvas = useCallback(() => {
    ++runIdRef.current
    setRunning(false)
    setTree(null)
    setInstruction(null)
    setSteps([])
    setDoneSummary(null)
    setBuildingNodeId(null)
    setActiveNodeId(null)
    setHoverNodeId(null)
    onPersist({ tree: null, instruction: null, doneSummary: null })
  }, [onPersist])

  const activeNode = tree && activeNodeId ? findById(tree, activeNodeId) : null
  const interactive = !running && tree !== null
  const meta = providerMeta(config.provider)

  return (
    <div className="flex h-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* ============ Agent panel ============ */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950">
        <header className="flex items-center gap-2.5 border-b border-zinc-800/80 px-5 py-4">
          <span className="relative flex size-2">
            {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />}
            <span className={`relative inline-flex size-2 rounded-full ${running ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="text-[13px] font-semibold tracking-tight">Canvas Agent · Vocabulary</h1>
            <p className="truncate font-mono text-[10px] text-zinc-500">
              {running ? 'generating…' : config.apiKey ? `${meta.label.split(' ')[0].toLowerCase()} · ${resolvedModel(config) || 'no model'}` : 'no provider configured'}
            </p>
          </div>
          <button
            type="button"
            onClick={openConfig}
            title="Configure provider"
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            ⚙
          </button>
        </header>

        {/* Prompt input */}
        <div className="flex flex-col gap-2 px-4 py-4">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Instruction</p>
          <button
            type="button"
            disabled={running}
            onClick={openDesign}
            className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left transition-colors hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
          >
            <span className="flex h-3 w-14 shrink-0 overflow-hidden rounded-full bg-zinc-800">
              {selectedStyle &&
                paletteOf(selectedStyle.system, 6).map((hex, i) => <span key={i} className="flex-1" style={{ background: hex }} />)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] font-medium text-zinc-200">{selectedStyle ? selectedStyle.system.name : 'Free design'}</span>
              <span className="truncate font-mono text-[9.5px] text-zinc-500">
                {selectedStyle ? 'translated into the Tailwind vocabulary' : 'no design system'}
              </span>
            </span>
            <span className="font-mono text-[10px] text-zinc-500">change ▾</span>
          </button>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runPrompt(prompt)
            }}
            rows={3}
            placeholder="Describe the UI to generate — subject, mood, light or dark…"
            className="thin-scroll resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-fuchsia-500/60"
          />
          <button
            type="button"
            disabled={running || !prompt.trim()}
            onClick={() => runPrompt(prompt)}
            className={`flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 ${
              running || !prompt.trim()
                ? 'cursor-not-allowed bg-zinc-900 text-zinc-600'
                : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 active:scale-[0.99]'
            }`}
          >
            {running ? (
              <>
                <DotSpinner className="bg-zinc-400" /> generating…
              </>
            ) : (
              <>✦ Generate on canvas</>
            )}
          </button>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={running}
                onClick={() => setPrompt(p)}
                className="rounded-full border border-zinc-800 px-2.5 py-1 text-left text-[10.5px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
          {tree !== null && !running && (
            <button
              type="button"
              onClick={clearCanvas}
              className="self-start rounded-md px-2 py-1 font-mono text-[10px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
            >
              ✕ clear canvas
            </button>
          )}
        </div>

        {/* Agent activity feed */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-800/80">
          <p className="px-5 pt-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Agent activity</p>
          <AgentFeed
            instruction={instruction}
            steps={steps}
            doneSummary={doneSummary}
            running={running}
            emptyHint="Type an instruction (or pick an example) and the model will design a layout live on the canvas — constrained to the Tailwind vocabulary."
          />
        </div>

        {/* Selection inspector */}
        <div className="flex h-52 shrink-0 flex-col border-t border-zinc-800/80">
          <p className="px-5 pt-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Selection · AST slice</p>
          <div className="thin-scroll mx-4 mb-3 min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-800/80 bg-zinc-900/50">
            {activeNode ? (
              <pre className="p-3 font-mono text-[10.5px] leading-relaxed text-sky-300/90">{JSON.stringify(activeNode, null, 2)}</pre>
            ) : (
              <p className="p-3 text-[11px] leading-relaxed text-zinc-600">
                {tree === null
                  ? 'The canvas is empty — nothing to inspect yet.'
                  : running
                    ? 'Selection unlocks when the agent finishes writing.'
                    : 'Click any node on the canvas to inspect its raw JSON slice.'}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* ============ Canvas viewport ============ */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950 px-5">
          <span className="font-mono text-[11px] text-zinc-400">
            paper.design <span className="text-zinc-600">/</span> canvas-01
          </span>
          <span className="rounded-full border border-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
            {tree ? `${countTree(tree)} nodes` : 'empty'}
          </span>
          {running && (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] text-amber-400">
              <DotSpinner />
              agent writing
            </span>
          )}
          <span className="ml-auto truncate font-mono text-[10px] text-zinc-600">
            {activeNode ? activeNode.label : instruction ?? 'no instruction yet'}
          </span>
        </header>

        <div className="canvas-backdrop thin-scroll relative flex-1 overflow-auto bg-zinc-900" onClick={() => setActiveNodeId(null)}>
          <div className="flex min-h-full items-start justify-center px-10 pt-24 pb-16">
            <div ref={artboardRef} className="relative">
              <AgentCursor
                containerRef={artboardRef}
                targetId={buildingNodeId}
                active={running}
                name={providerMeta(config.provider).label.split(' ')[0]}
              />
              {running && (
                <div className="absolute -top-11 right-0 z-30">
                  <AgentActivityDots accent="bg-fuchsia-500" label={steps.find((s) => s.state === 'active')?.label} />
                </div>
              )}
              {tree === null ? (
                <div className="flex h-[480px] w-[1200px] max-w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-700/70">
                  {running ? (
                    <>
                      <DotSpinner className="bg-fuchsia-400" />
                      <p className="font-mono text-[11px] text-zinc-500">model is designing…</p>
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-[11px] text-zinc-500">frame-01 · empty</p>
                      <p className="max-w-[260px] text-center text-[11px] leading-relaxed text-zinc-600">
                        Send an instruction — the model designs it and the agent renders it here live.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <CanvasRenderer
                  node={tree}
                  activeNodeId={activeNodeId}
                  hoverNodeId={hoverNodeId}
                  buildingNodeId={buildingNodeId}
                  interactive={interactive}
                  onSelect={setActiveNodeId}
                  onHover={setHoverNodeId}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
