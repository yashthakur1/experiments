import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { abortActiveCalls, componentStats, explainError, generateLayout, providerMeta, resolvedModel, type AIConfig, type CanvasNode, type ErrorReport, type ValidationResult } from './ai'
import { subscribeLog } from './log'
import { paletteOf, vocabularyStyleDirective, type SavedStyle } from './lab'
import type { CanvasSnapshot, CanvasState } from './projects'
import { countTree, diffTrees, findById, insertChild, lastNodeId, patchNode, sleep } from './tree'
import { HandoverPanel } from './HandoverPanel'
import { preloadLibrary, RealLibraryProvider, renderRealNode } from './realui/components'
import { getLibrary, type LibraryId } from './realui/catalog'
import { AgentActivityDots, AgentCursor, AgentError, AgentFeed, DotSpinner, nextStepId, type AgentStep } from './ui'

/* ================================================================== *
 *  Page 1 — Handover design (the vocabulary canvas): the model designs inside a safelisted
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
  /** The real component library this tree renders with, if any. */
  library: LibraryId | null
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

  /** The editor outline for any node (selected, hovered, or being built by the agent). */
  const ringOf = (id: string) => {
    const active = interactive && activeNodeId === id
    const hovered = interactive && hoverNodeId === id && !active
    return buildingNodeId === id
      ? 'ring-2 ring-fuchsia-400/80'
      : active
        ? 'ring-2 ring-blue-500'
        : hovered
          ? 'ring-2 ring-blue-400/50'
          : 'ring-0 ring-transparent'
  }
  const handlersOf = (id: string) => ({
    onClick: (e: React.MouseEvent) => {
      if (!interactive) return
      e.stopPropagation()
      onSelect(id)
    },
    onMouseOver: (e: React.MouseEvent) => {
      if (!interactive) return
      e.stopPropagation()
      onHover(id)
    },
    onMouseOut: (e: React.MouseEvent) => {
      if (!interactive) return
      e.stopPropagation()
      onHover(null)
    },
  })
  const ring = ringOf(node.id)

  const shared = {
    className: `relative ${node.classes} ${ring}`,
    'data-node-id': node.id,
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] as const },
    ...handlersOf(node.id),
  }

  const selectionBadge = isActive && (
    <span className="pointer-events-none absolute -top-5 left-0 z-30 flex items-center gap-1 whitespace-nowrap rounded bg-blue-500 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white shadow-lg">
      {node.label}
      <span className="normal-case opacity-70">{`<${node.type}>`}</span>
    </span>
  )

  if (node.type === 'component' && props.library) {
    return renderRealNode(node, {
      library: props.library,
      ringClass: (n) => ringOf(n.id),
      handlers: (n) => handlersOf(n.id),
      renderPlain: (child) => <CanvasRenderer key={child.id} {...props} node={child} />,
    })
  }

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

/** Suggestions once a design exists: changes to it, not new designs. */
const FOLLOWUP_PROMPTS = [
  'Add a pricing section with three plans',
  'Add an FAQ section at the bottom',
  'Make the headline bigger and add a second button',
  'Tighten the spacing and make the layout denser',
]

const FRAME_PREFIX = 'flex flex-col w-[1200px] rounded-xl overflow-hidden shadow-2xl '
const MAX_HISTORY = 5

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
  // The chain: every request made on this design, and earlier versions for undo.
  const [turns, setTurns] = useState<string[]>(initial?.turns ?? (initial?.instruction ? [initial.instruction] : []))
  const [history, setHistory] = useState<CanvasSnapshot[]>(initial?.history ?? [])
  const [mode, setMode] = useState<'edit' | 'new'>('edit')
  const [revisingNow, setRevisingNow] = useState(false)
  const preRunRef = useRef<CanvasSnapshot | null>(null)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [doneSummary, setDoneSummary] = useState<string | null>(initial?.doneSummary ?? null)
  const [buildingNodeId, setBuildingNodeId] = useState<string | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const runIdRef = useRef(0)
  const artboardRef = useRef<HTMLDivElement>(null)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [error, setError] = useState<ErrorReport | null>(null)
  const runningRef = useRef(false)

  const selectedStyle = styleId ? (styles.find((s) => s.id === styleId) ?? null) : null
  // Start loading the style's real component library now, so the first design does not wait for it.
  const styleLibrary = selectedStyle?.system.meta?.library ?? null
  useEffect(() => preloadLibrary(styleLibrary), [styleLibrary])

  const pushStatus = useCallback((label: string) => {
    setSteps((prev) => [
      ...prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)),
      { id: nextStepId(), label, state: 'active' },
    ])
  }, [])

  // live detail on the active step (elapsed, chars received…)
  const tickStatus = useCallback((note: string) => {
    setSteps((prev) => (prev.some((s) => s.state === 'active') ? prev.map((s) => (s.state === 'active' ? { ...s, note } : s)) : prev))
  }, [])

  const failStatus = useCallback((label: string) => {
    setSteps((prev) => [
      ...prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)),
      { id: nextStepId(), label, state: 'error' },
    ])
  }, [])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  // Both canvases stay mounted, so only the one that is running listens.
  useEffect(
    () =>
      subscribeLog((entry) => {
        if (!runningRef.current || !entry.ui) return
        if (entry.ui === 'tick') tickStatus(entry.msg)
        else pushStatus(`${entry.level === 'warn' ? '⚠ ' : ''}${entry.msg}`)
      }),
    [pushStatus, tickStatus],
  )

  const runPrompt = useCallback(
    async (userPrompt: string) => {
      const trimmed = userPrompt.trim()
      if (!trimmed || running) return
      if (!config.apiKey.trim()) {
        openConfig()
        return
      }
      // With a design on the canvas, a new request CHANGES it. "Start over" (mode "new") draws a fresh one.
      const revising = tree !== null && mode === 'edit'
      const before = tree
      const snapshot: CanvasSnapshot | null = tree ? { tree, instruction, doneSummary, turns } : null
      const nextTurns = revising ? [...turns, trimmed] : [trimmed]
      preRunRef.current = snapshot
      const myRun = ++runIdRef.current
      setRunning(true)
      setRevisingNow(revising)
      if (!revising) {
        setTree(null)
        setActiveNodeId(null)
      }
      setHoverNodeId(null)
      setBuildingNodeId(null)
      setDoneSummary(null)
      setInstruction(trimmed)
      setTurns(nextTurns)
      setSteps([])
      setError(null)
      setHandoverOpen(false)
      const started = performance.now()
      const model = resolvedModel(config)
      const styled = styleId ? (styles.find((s) => s.id === styleId) ?? null) : null

      const lib = getLibrary(styled?.system.meta?.library)
      const focusNode = revising && activeNodeId && activeNodeId !== 'root' && before ? findById(before, activeNodeId) : null
      pushStatus(
        `${revising ? 'Revising the design' : 'Contacting'} ${providerMeta(config.provider).label.split(' ')[0].toLowerCase()} · ${model}${
          focusNode ? ` — about “${focusNode.label}”` : ''}${
          lib ? ` — composing with the real ${lib.label} components` : styled ? ` — approximating “${styled.system.name}” with Tailwind` : ''
        }`,
      )

      const toTree = (v: ValidationResult): CanvasNode => ({
        id: 'root',
        type: 'container',
        label: v.layout.frameLabel,
        classes: `flex flex-col w-[1200px] rounded-xl overflow-hidden shadow-2xl ${lib ? `${lib.scopeClass} ` : ''}${v.layout.frameClasses}`,
        children: v.layout.sections,
        ...(lib ? { library: lib.id } : {}),
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
          // real components carry their own theme; only imitations need the token directive
          styled && !lib ? vocabularyStyleDirective(styled.system) : undefined,
          (partial) => {
            // live: render each streamed snapshot the moment it parses
            if (runIdRef.current !== myRun) return
            const t = toTree(partial)
            if (revising) {
              // the old design stays on screen; it is swapped for the new one in one step when the model is done
              tickStatus(`${countTree(t)} nodes written`)
              return
            }
            if (!streamed) {
              streamed = true
              pushStatus('Streaming design onto canvas — live')
            }
            setTree(t)
            setBuildingNodeId(lastNodeId(t))
          },
          lib?.id,
          revising && before
            ? {
                design: { frameLabel: before.label, frameClasses: before.classes.replace(FRAME_PREFIX, '').replace(lib?.scopeClass ?? '\u0000', '').trim(), sections: before.children ?? [] },
                earlier: turns,
                focus: focusNode ? { id: focusNode.id, label: focusNode.label } : null,
              }
            : null,
        )
      } catch (err) {
        if (runIdRef.current !== myRun) return
        failStatus(`${revising ? 'Change' : 'Generation'} failed — ${err instanceof Error ? err.message : String(err)}`)
        setError(explainError(config, err))
        setBuildingNodeId(null)
        setRunning(false)
        setRevisingNow(false)
        if (revising && snapshot) {
          // the design on the canvas is untouched: put the chain back as it was
          setTurns(snapshot.turns)
          setInstruction(snapshot.instruction)
          setDoneSummary(snapshot.doneSummary)
        } else {
          onPersist({ tree: null, instruction: trimmed, doneSummary: null, turns: nextTurns, history })
        }
        return
      }
      if (runIdRef.current !== myRun) return

      for (const w of result.warnings) pushStatus(`⚠ ${w}`)

      if (result.droppedClasses.length > 0) {
        pushStatus(
          `Stripped ${result.droppedClasses.length} off-vocabulary class${result.droppedClasses.length === 1 ? '' : 'es'}: ${result.droppedClasses.slice(0, 4).join(', ')}${result.droppedClasses.length > 4 ? '…' : ''}`,
        )
      }

      let finalTree: CanvasNode | null = null
      if (streamed || revising) {
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
      const stats = finalTree ? componentStats(finalTree) : { components: 0, total: 0 }
      if (lib && stats.components < 8) {
        pushStatus(`⚠ Only ${stats.components} real ${lib.label} component${stats.components === 1 ? '' : 's'} in ${stats.total} nodes — the model drew most of it as plain blocks. Try again or pick a stronger model.`)
      }
      const change = revising ? diffTrees(before, finalTree) : null
      const changeText = change ? (change.added + change.removed + change.edited === 0 ? 'No visible change (try saying it another way)' : `Changed — ${change.added} new, ${change.removed} removed, ${change.edited} edited`) : ''
      const summary = revising
        ? `${changeText} · ${total} nodes · ${model} · ${secs}s`
        : `Done — ${total} nodes${lib ? ` (${stats.components} real ${lib.label} components)` : ''} · ${model} · ${secs}s${streamed ? ' · streamed live' : ''}`
      const nextHistory = snapshot ? [...history, snapshot].slice(-MAX_HISTORY) : history
      setHistory(nextHistory)
      // a selection that no longer exists (the model removed the node) is dropped
      if (finalTree && activeNodeId && !findById(finalTree, activeNodeId)) setActiveNodeId(null)
      setDoneSummary(summary)
      setRunning(false)
      setRevisingNow(false)
      setMode('edit')
      if (revising) setPrompt('')
      setHandoverOpen(true)
      onPersist({ tree: finalTree, instruction: trimmed, doneSummary: summary, turns: nextTurns, history: nextHistory })
    },
    [config, running, openConfig, pushStatus, tickStatus, failStatus, styleId, styles, onPersist, tree, mode, turns, history, instruction, doneSummary, activeNodeId],
  )

  const stopRun = useCallback(() => {
    ++runIdRef.current // must come first: the aborted call's catch checks it
    abortActiveCalls()
    setRunning(false)
    setRevisingNow(false)
    setBuildingNodeId(null)
    failStatus('Stopped by you')
    // a stopped change leaves the design as it was
    const before = preRunRef.current
    if (before) {
      setTurns(before.turns)
      setInstruction(before.instruction)
      setDoneSummary(before.doneSummary)
    }
  }, [failStatus])

  const undo = useCallback(() => {
    const previous = history[history.length - 1]
    if (!previous || running) return
    const rest = history.slice(0, -1)
    setTree(previous.tree)
    setInstruction(previous.instruction)
    setDoneSummary(previous.doneSummary)
    setTurns(previous.turns)
    setHistory(rest)
    setActiveNodeId(null)
    setHoverNodeId(null)
    setError(null)
    setSteps([])
    onPersist({ tree: previous.tree, instruction: previous.instruction, doneSummary: previous.doneSummary, turns: previous.turns, history: rest })
  }, [history, running, onPersist])

  const clearCanvas = useCallback(() => {
    ++runIdRef.current
    setError(null)
    setHandoverOpen(false)
    setRunning(false)
    setTree(null)
    setInstruction(null)
    setSteps([])
    setDoneSummary(null)
    setBuildingNodeId(null)
    setActiveNodeId(null)
    setHoverNodeId(null)
    setTurns([])
    setHistory([])
    setMode('edit')
    onPersist({ tree: null, instruction: null, doneSummary: null, turns: [], history: [] })
  }, [onPersist])

  const activeNode = tree && activeNodeId ? findById(tree, activeNodeId) : null
  const interactive = !running && tree !== null
  const editing = tree !== null && mode === 'edit'
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
            <h1 className="text-[13px] font-semibold tracking-tight">Canvas Agent · Handover design</h1>
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
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">{editing ? 'Change this design' : 'Instruction'}</p>
            {tree !== null && !running && (
              <span role="group" aria-label="What the next request does" className="flex overflow-hidden rounded-md border border-zinc-800 font-mono text-[10px]">
                {(['edit', 'new'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`px-2 py-0.5 transition-colors ${mode === m ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {m === 'edit' ? 'change it' : 'start over'}
                  </button>
                ))}
              </span>
            )}
          </div>
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
                {selectedStyle
                  ? selectedStyle.system.meta?.library
                    ? `real ${getLibrary(selectedStyle.system.meta.library)?.label} components`
                    : 'approximated with Tailwind, not real components'
                  : 'no design system'}
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
            placeholder={
              editing
                ? activeNode
                  ? `Change “${activeNode.label}” — or anything else on the page…`
                  : 'What should change? “Add a pricing section”, “make the hero shorter”, “swap the copy to Spanish”…'
                : 'Describe the UI to generate — subject, mood, light or dark…'
            }
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
                <DotSpinner className="bg-zinc-400" /> {revisingNow ? 'changing…' : 'generating…'}
              </>
            ) : editing ? (
              <>✦ Apply change</>
            ) : (
              <>✦ Generate on canvas</>
            )}
          </button>
          {running && (
            <button
              type="button"
              onClick={stopRun}
              className="rounded-lg border border-rose-500/40 px-3.5 py-2 text-[12px] font-medium text-rose-300 transition-colors hover:bg-rose-950/40"
            >
              ■ Stop
            </button>
          )}
          {editing && activeNode && !running && (
            <p className="flex items-center gap-1.5 px-1 font-mono text-[10px] text-fuchsia-300">
              <span aria-hidden="true">◎</span>
              <span className="min-w-0 truncate">pointing at “{activeNode.label}”: the change starts there</span>
              <button type="button" onClick={() => setActiveNodeId(null)} className="shrink-0 text-zinc-500 hover:text-zinc-200" aria-label="Stop pointing at this element">✕</button>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(editing ? FOLLOWUP_PROMPTS : EXAMPLE_PROMPTS).map((p) => (
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
          {history.length > 0 && !running && (
            <button
              type="button"
              onClick={undo}
              title="Go back to the design before the last request"
              className="self-start rounded-md px-2 py-1 font-mono text-[10px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              ↶ undo last request ({history.length})
            </button>
          )}
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
            earlier={turns.slice(0, -1)}
            steps={steps}
            doneSummary={doneSummary}
            running={running}
            emptyHint="Type an instruction (or pick an example) and the model will design a layout live on the canvas — using ready-made Tailwind styles, or the real components of a selected style like shadcn/ui or Relume."
          />
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
          {tree !== null && !running && (
            <button
              type="button"
              onClick={() => setHandoverOpen((v) => !v)}
              aria-pressed={handoverOpen}
              className={`shrink-0 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                handoverOpen ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-200' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              Handover
            </button>
          )}
        </header>

        <div className="canvas-backdrop thin-scroll relative flex-1 overflow-auto bg-zinc-900" onClick={() => setActiveNodeId(null)}>
          <div className="flex min-h-full items-start px-10 pt-24 pb-16">
            <div ref={artboardRef} className={`relative mx-auto transition-opacity duration-300 ${revisingNow ? 'pointer-events-none opacity-60' : ''}`}>
              {revisingNow && (
                <span className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-fuchsia-500/50 bg-zinc-950/90 px-3 py-1 font-mono text-[11px] text-fuchsia-200 shadow-lg">
                  <DotSpinner /> applying your change…
                </span>
              )}
              <AgentCursor
                containerRef={artboardRef}
                targetId={buildingNodeId}
                active={running}
                name={providerMeta(config.provider).label.split(' ')[0]}
              />
              {error && !running && (
                <div className="mb-4">
                  <AgentError report={error} onRetry={() => runPrompt(instruction ?? prompt)} onSettings={openConfig} onDismiss={() => setError(null)} />
                </div>
              )}
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
                <div className="design-surface contents">
                <RealLibraryProvider library={tree.library ?? null}>
                <CanvasRenderer
                  node={tree}
                  library={tree.library ?? null}
                  activeNodeId={activeNodeId}
                  hoverNodeId={hoverNodeId}
                  buildingNodeId={buildingNodeId}
                  interactive={interactive}
                  onSelect={(id) => {
                    setActiveNodeId(id)
                    setHandoverOpen(true)
                  }}
                  onHover={setHoverNodeId}
                />
                </RealLibraryProvider>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ============ Handover panel ============ */}
      {handoverOpen && tree !== null && !running && (
        <HandoverPanel tree={tree} selected={activeNode} artboard={artboardRef} onClose={() => setHandoverOpen(false)} />
      )}
    </div>
  )
}
