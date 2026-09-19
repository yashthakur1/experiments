import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { abortActiveCalls, explainError, providerMeta, resolvedModel, type AIConfig, type ErrorReport } from './ai'
import { copyText, downloadText, systemToCss, systemToTailwindTheme } from './handover'
import { subscribeLog } from './log'
import {
  componentToCss,
  generateDesignSystem,
  generateExtras,
  generateWithStyle,
  nodeStyle,
  paletteOf,
  repairDesign,
  parseImportedStyles,
  resolveStyle,
  tokensToCss,
  type DesignSystem,
  type LabNode,
  type SavedStyle,
  type TypeStyle,
} from './lab'
import { ColorAdaptations, FontSpecimens, IconsSection, ImagesSection, LangIcon, OverlaysSection, StatesRow, TextAdaptationsSection, imageStyle, useGoogleFonts } from './LanguageSheet'
import { ensureLanguage, withMode } from './language'
import type { LabState } from './projects'
import { countTree, findById, insertChild, lastNodeId, patchNode, sleep } from './tree'
import { AgentActivityDots, AgentCursor, AgentError, AgentFeed, DotSpinner, nextStepId, type AgentStep } from './ui'

/* ================================================================== *
 *  Page 2 — Style template (the design lab): no framework vocabulary. The model invents a
 *  design language (philosophy → raw tokens → component library),
 *  the page is composed from component instances, and the language
 *  itself is published as a guideline sheet — like designing something
 *  new in Figma and shipping it as a library.
 * ================================================================== */

type LabOp =
  | { kind: 'status'; label: string; pause: number }
  | { kind: 'add'; parentId: string | null; node: LabNode; pause: number }
  | { kind: 'text'; id: string; partial: string; pause: number }

function compileLabOps(page: LabNode): LabOp[] {
  const ops: LabOp[] = []
  ops.push({ kind: 'add', parentId: null, node: { ...page, children: undefined }, pause: 350 })

  const emit = (node: LabNode, parentId: string) => {
    const streamText = !!node.text
    ops.push({
      kind: 'add',
      parentId,
      node: { ...node, children: undefined, text: streamText ? '' : node.text },
      pause: node.children?.length ? 170 : 85,
    })
    if (streamText) {
      const words = node.text!.split(' ')
      for (let i = 2; i < words.length; i += 3) {
        ops.push({ kind: 'text', id: node.id, partial: words.slice(0, i + 1).join(' '), pause: 32 })
      }
      ops.push({ kind: 'text', id: node.id, partial: node.text!, pause: 42 })
    }
    node.children?.forEach((c) => emit(c, node.id))
  }

  for (const section of page.children ?? []) {
    ops.push({ kind: 'status', label: `Composing ${section.label}`, pause: 220 })
    emit(section, page.id)
  }
  return ops
}

/* ------------------------------------------------------------------ *
 *  Raw-style recursive renderer
 * ------------------------------------------------------------------ */

interface LabRendererProps {
  node: LabNode
  system: DesignSystem
  activeNodeId: string | null
  hoverNodeId: string | null
  buildingNodeId: string | null
  interactive: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

function LabRenderer(props: LabRendererProps) {
  const { node, system, activeNodeId, hoverNodeId, buildingNodeId, interactive, onSelect, onHover } = props
  const isActive = interactive && activeNodeId === node.id
  const isHovered = interactive && hoverNodeId === node.id && !isActive
  const isBuilding = buildingNodeId === node.id

  const style: React.CSSProperties = {
    position: 'relative',
    ...nodeStyle(node, system),
    ...(node.image ? imageStyle(system, node.image) : {}),
    ...(isBuilding
      ? { outline: '2px solid #e879f9', outlineOffset: '-1px' }
      : isActive
        ? { outline: '2px solid #3b82f6', outlineOffset: '-1px' }
        : isHovered
          ? { outline: '2px solid rgba(96,165,250,0.55)', outlineOffset: '-1px' }
          : {}),
  }

  const shared = {
    style,
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

  const badge = isActive && (
    <span className="pointer-events-none absolute -top-5 left-0 z-40 flex items-center gap-1 whitespace-nowrap rounded bg-blue-500 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white shadow-lg">
      {node.label}
      {node.component && <span className="opacity-70">〈{node.component}{node.variant ? ` · ${node.variant}` : ''}〉</span>}
    </span>
  )

  const children = node.children?.map((child) => <LabRenderer key={child.id} {...props} node={child} />)
  const body = (
    <>
      {node.icon && system.extras && <LangIcon name={node.icon} spec={system.extras.icons} />}
      {node.text}
      {node.text === '' && <span style={{ opacity: 0 }}>·</span>}
      {children}
      {badge}
    </>
  )

  return node.element === 'button' ? (
    <motion.button type="button" {...shared}>
      {body}
    </motion.button>
  ) : (
    <motion.div {...shared}>{body}</motion.div>
  )
}

/* ------------------------------------------------------------------ *
 *  Design-system guideline sheet (the "published Figma library")
 * ------------------------------------------------------------------ */

function typeSpecimenFont(key: string, system: DesignSystem): string | undefined {
  const display = system.tokens.font.display
  return /display|h1|h2|h3|title|hero/i.test(key) ? display : system.tokens.font.body ?? display
}

function SystemSheet({ system }: { system: DesignSystem }) {
  const pageStyle = nodeStyle(system.page, system)
  const bg = (pageStyle.background as string) ?? (pageStyle.backgroundColor as string) ?? '#ffffff'
  const fg = (pageStyle.color as string) ?? Object.values(system.tokens.color)[0] ?? '#111111'

  return (
    <div className="design-surface w-[1240px] overflow-hidden rounded-xl shadow-2xl" style={{ background: bg, color: fg }}>
      {/* Identity */}
      <div style={{ padding: '48px 56px 32px' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-50">Design language · generated guideline</p>
        <h1 style={{ fontFamily: system.tokens.font.display, fontSize: '44px', lineHeight: 1.05, marginTop: 12, fontWeight: 700 }}>
          {system.name}
        </h1>
        {system.philosophy && (
          <p style={{ fontFamily: system.tokens.font.body, fontSize: '15px', lineHeight: 1.6, marginTop: 14, maxWidth: 520, opacity: 0.85, fontStyle: 'italic' }}>
            “{system.philosophy}”
          </p>
        )}
        {system.experienceNotes.length > 0 && (
          <ul style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {system.experienceNotes.map((note, i) => (
              <li key={i} style={{ fontFamily: system.tokens.font.body, fontSize: '12px', lineHeight: 1.5, opacity: 0.7 }}>
                ◆ {note}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Palette */}
      <SheetSection title="Palette" fg={fg}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {Object.entries(system.tokens.color).map(([name, hex]) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 88, height: 64, borderRadius: 10, background: hex, border: '1px solid rgba(128,128,128,0.25)' }} />
              <p className="font-mono" style={{ fontSize: 10, opacity: 0.75 }}>
                {name}
                <span style={{ opacity: 0.6 }}> · {hex}</span>
              </p>
            </div>
          ))}
        </div>
      </SheetSection>

      {/* Color adaptations */}
      <SheetSection title="Color adaptations · ramps · light and dark · contrast" fg={fg}>
        <ColorAdaptations system={system} />
      </SheetSection>

      {/* Type scale */}
      <SheetSection title="Type scale" fg={fg}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Object.entries(system.tokens.type).map(([key, t]: [string, TypeStyle]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <span className="font-mono" style={{ fontSize: 10, opacity: 0.55, width: 90, flexShrink: 0 }}>
                {key} · {t.size}/{t.weight}
              </span>
              <span
                style={{
                  fontFamily: typeSpecimenFont(key, system),
                  fontSize: t.size,
                  fontWeight: t.weight,
                  lineHeight: t.lineHeight,
                  letterSpacing: t.letterSpacing,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {system.name} speaks in {key}
              </span>
            </div>
          ))}
        </div>
      </SheetSection>

      {/* Fonts + text adaptations */}
      <SheetSection title="Fonts · families, weights, pairing" fg={fg}>
        <FontSpecimens system={system} />
      </SheetSection>
      <SheetSection title="Text adaptations · surfaces, devices, rules" fg={fg}>
        <TextAdaptationsSection system={system} />
      </SheetSection>

      {/* Rhythm, geometry, depth */}
      <SheetSection title="Rhythm · geometry · depth" fg={fg}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(system.tokens.space).map(([name, v]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="font-mono" style={{ fontSize: 10, opacity: 0.55, width: 34 }}>{name}</span>
                <div style={{ width: v, height: 8, background: 'currentColor', opacity: 0.55, borderRadius: 2 }} />
                <span className="font-mono" style={{ fontSize: 10, opacity: 0.4 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {Object.entries(system.tokens.radius).map(([name, v]) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 52, height: 52, borderRadius: v, border: '2px solid currentColor', opacity: 0.65 }} />
                <span className="font-mono" style={{ fontSize: 10, opacity: 0.55 }}>{name} · {v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            {Object.entries(system.tokens.shadow).map(([name, v]) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 64, height: 44, borderRadius: 10, background: bg, boxShadow: v, border: '1px solid rgba(128,128,128,0.2)' }} />
                <span className="font-mono" style={{ fontSize: 10, opacity: 0.55 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetSection>

      {/* Icons, overlays, images */}
      <SheetSection title="Icons" fg={fg}>
        <IconsSection system={system} />
      </SheetSection>
      <SheetSection title="Overlays · modal, drawer, popover, tooltip, toast, menu" fg={fg}>
        <OverlaysSection system={system} />
      </SheetSection>
      <SheetSection title="Images · treatments and generated art" fg={fg}>
        <ImagesSection system={system} />
      </SheetSection>

      {/* Tokens as code */}
      <SheetSection title="Tokens · CSS custom properties" fg={fg}>
        <CodeBlock code={tokensToCss(system)} />
      </SheetSection>

      {/* Component library */}
      <SheetSection title={`Component library · ${system.components.filter((c) => !c.overlay).length} components · every state`} fg={fg} last>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {system.components.filter((c) => !c.overlay).map((c) => (
            <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="font-mono" style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</span>
                {c.role && <span className="font-mono" style={{ fontSize: 10, opacity: 0.5 }}>{c.role}</span>}
              </div>
              {c.description && (
                <p style={{ fontFamily: system.tokens.font.body, fontSize: 11.5, lineHeight: 1.5, opacity: 0.65, maxWidth: 480 }}>{c.description}</p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={resolveStyle(c.base, system.tokens)}>{c.preview}</div>
                  <span className="font-mono" style={{ fontSize: 9, opacity: 0.45 }}>base</span>
                </div>
                {Object.entries(c.variants ?? {}).map(([vName, vStyle]) => (
                  <div key={vName} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ ...resolveStyle(c.base, system.tokens), ...resolveStyle(vStyle, system.tokens) }}>{c.preview}</div>
                    <span className="font-mono" style={{ fontSize: 9, opacity: 0.45 }}>{vName}</span>
                  </div>
                ))}
              </div>
              <StatesRow component={c} system={system} />
              <details style={{ maxWidth: 640 }}>
                <summary className="cursor-pointer font-mono" style={{ fontSize: 10.5, opacity: 0.6 }}>
                  code{c.code ? ' · library usage + CSS' : ' · CSS'}
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {c.code && <CodeBlock code={c.code} label="usage" />}
                  <CodeBlock code={componentToCss(c)} label="css" />
                </div>
              </details>
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the text stays selectable */
    }
  }
  return (
    <div style={{ position: 'relative', borderRadius: 8, background: 'rgba(128,128,128,0.12)', border: '1px solid rgba(128,128,128,0.2)' }}>
      <div className="flex items-center justify-between font-mono" style={{ fontSize: 9.5, opacity: 0.6, padding: '6px 10px 0' }}>
        <span>{label ?? 'css'}</span>
        <button type="button" onClick={copy} style={{ pointerEvents: 'auto' }} aria-label="Copy code">
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre
        className="thin-scroll font-mono"
        style={{ fontSize: 10.5, lineHeight: 1.55, padding: '6px 10px 10px', margin: 0, overflowX: 'auto', maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre' }}
      >
        {code}
      </pre>
    </div>
  )
}

function SheetSection({ title, fg, last, children }: { title: string; fg: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ padding: '28px 56px', borderTop: `1px solid ${fg}22`, paddingBottom: last ? 48 : 28 }}>
      <p className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.25em', opacity: 0.5, marginBottom: 18 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Page component
 * ------------------------------------------------------------------ */

const LAB_EXAMPLES = [
  'A meditation app for deep-sea divers',
  'A ticketing site for an underground jazz cellar',
  'A field-notes journal for desert botanists',
]

interface PageProps {
  config: AIConfig
  openConfig: () => void
  /** Every design system: built-in first, then saved. */
  styles: SavedStyle[]
  /** Only the user's saved styles (persisted). */
  library: SavedStyle[]
  onLibraryChange: (next: SavedStyle[]) => void
  styleId: string | null
  onStyleChange: (id: string | null) => void
  openDesign: () => void
  initial: LabState | null
  onPersist: (state: LabState) => void
}

export default function PageLab({
  config,
  openConfig,
  styles,
  library,
  onLibraryChange,
  styleId: activeStyleId,
  onStyleChange,
  openDesign,
  initial,
  onPersist,
}: PageProps) {
  const [system, setSystem] = useState<DesignSystem | null>(initial?.system ?? null)
  const [tree, setTree] = useState<LabNode | null>(initial?.system?.page ?? null)
  const [view, setView] = useState<'page' | 'system'>('page')
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const [completing, setCompleting] = useState(false)
  const [running, setRunning] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [instruction, setInstruction] = useState<string | null>(initial?.instruction ?? null)
  // Every screen sees a COMPLETE language: states, icons, fonts, adaptations, overlays, images filled in by code.
  const display = useMemo(() => {
    if (!system) return null
    const full = withMode(ensureLanguage(system, instruction ?? ''), mode)
    if (mode === 'light') return full
    // the dark theme has its own contrast: check the page again against the swapped colors (on a copy)
    const copy = structuredClone(full)
    repairDesign(copy)
    return copy
  }, [system, mode, instruction])
  useGoogleFonts(display?.extras?.fonts)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [doneSummary, setDoneSummary] = useState<string | null>(initial?.doneSummary ?? null)
  const [buildingNodeId, setBuildingNodeId] = useState<string | null>(null)
  const artboardRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<ErrorReport | null>(null)
  const runningRef = useRef(false)
  const [exportNote, setExportNote] = useState<string | null>(null)
  useEffect(() => {
    if (!exportNote) return
    const t = window.setTimeout(() => setExportNote(null), 1800)
    return () => window.clearTimeout(t)
  }, [exportNote])
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const runIdRef = useRef(0)

  const activeStyle = activeStyleId ? (styles.find((s) => s.id === activeStyleId) ?? null) : null

  const persistLibrary = onLibraryChange

  const saveCurrentStyle = useCallback(() => {
    if (!system || running) return
    const entry: SavedStyle = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), system }
    persistLibrary([entry, ...library])
    onStyleChange(entry.id)
  }, [system, running, library, persistLibrary, onStyleChange])

  const selectStyle = useCallback(
    (saved: SavedStyle) => {
      if (running) return
      if (activeStyleId === saved.id) {
        onStyleChange(null) // deselect → back to invent mode
        return
      }
      onStyleChange(saved.id)
      setSystem(saved.system)
      setTree(saved.system.page)
      setView('page')
      setActiveNodeId(null)
      setHoverNodeId(null)
      setBuildingNodeId(null)
      setSteps([])
      setInstruction(`Reloaded “${saved.system.name}” from the library`)
      const summary = `Loaded — ${countTree(saved.system.page)} nodes · ${saved.system.components.length} components`
      setDoneSummary(summary)
      onPersist({ system: saved.system, instruction: `Reloaded “${saved.system.name}” from the library`, doneSummary: summary })
    },
    [running, activeStyleId, onStyleChange, onPersist],
  )

  const deleteStyle = useCallback(
    (id: string) => {
      persistLibrary(library.filter((s) => s.id !== id))
      if (activeStyleId === id) onStyleChange(null)
    },
    [library, activeStyleId, persistLibrary, onStyleChange],
  )

  /* ----- export / import ----- */
  const [libraryNote, setLibraryNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const showNote = useCallback((kind: 'ok' | 'err', text: string) => {
    setLibraryNote({ kind, text })
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setLibraryNote(null), 4000)
  }, [])

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'style'

  const exportOne = useCallback(
    (saved: SavedStyle) => {
      downloadJson(saved, `style-${slug(saved.system.name)}.json`)
      showNote('ok', `Exported “${saved.system.name}”`)
    },
    [showNote],
  )

  const exportAll = useCallback(() => {
    if (library.length === 0) return
    downloadJson(library, 'style-library.json')
    showNote('ok', `Exported ${library.length} style${library.length === 1 ? '' : 's'}`)
  }, [library, showNote])

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const imported = parseImportedStyles(await file.text())
        const existingIds = new Set(library.map((s) => s.id))
        const merged = imported.map((s) => (existingIds.has(s.id) ? { ...s, id: crypto.randomUUID() } : s))
        persistLibrary([...merged, ...library])
        showNote('ok', `Imported ${merged.length} style${merged.length === 1 ? '' : 's'}`)
      } catch (err) {
        showNote('err', `Import failed — ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [library, persistLibrary, showNote],
  )

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
      const myRun = ++runIdRef.current
      setRunning(true)
      setSystem(null)
      setTree(null)
      setView('page')
      setActiveNodeId(null)
      setHoverNodeId(null)
      setBuildingNodeId(null)
      setDoneSummary(null)
      setInstruction(trimmed)
      setSteps([])
      setError(null)
      const started = performance.now()
      const model = resolvedModel(config)
      const base = activeStyleId ? (styles.find((s) => s.id === activeStyleId) ?? null) : null

      pushStatus(
        base
          ? `Contacting ${providerMeta(config.provider).label.split(' ')[0].toLowerCase()} · ${model} — composing with “${base.system.name}”`
          : `Contacting ${providerMeta(config.provider).label.split(' ')[0].toLowerCase()} · ${model} — designing from first principles`,
      )
      let streamed = false
      let result
      try {
        const onRepair = (msg: string) => {
          if (runIdRef.current === myRun) pushStatus(msg)
        }
        const onPartial = (partial: { system: DesignSystem }) => {
          // live: tokens + components land first, then the page grows node by node
          if (runIdRef.current !== myRun) return
          if (!streamed) {
            streamed = true
            pushStatus('Streaming design onto canvas — live')
          }
          setSystem(partial.system)
          setTree(partial.system.page)
          setBuildingNodeId(lastNodeId(partial.system.page))
        }
        result = base
          ? await generateWithStyle(config, trimmed, base.system, onRepair, onPartial)
          : await generateDesignSystem(config, trimmed, onRepair, onPartial)
      } catch (err) {
        if (runIdRef.current !== myRun) return
        failStatus(`Generation failed — ${err instanceof Error ? err.message : String(err)}`)
        setError(explainError(config, err))
        setBuildingNodeId(null)
        setRunning(false)
        onPersist({ system: null, instruction: trimmed, doneSummary: null })
        return
      }
      if (runIdRef.current !== myRun) return

      let sys = ensureLanguage(result.system, trimmed)
      if (base) {
        pushStatus(
          `Reusing “${base.system.name}” — ${base.system.components.length} published components${result.newComponents ? ` · ${result.newComponents} new` : ''}`,
        )
        await sleep(500)
        if (runIdRef.current !== myRun) return
      } else {
        pushStatus(`Design language derived — “${sys.name}”`)
        await sleep(500)
        if (runIdRef.current !== myRun) return
        pushStatus(
          `Minted ${Object.keys(sys.tokens.color).length} colors · ${Object.keys(sys.tokens.type).length} type styles · ${Object.keys(sys.tokens.space).length} spacing steps`,
        )
        await sleep(500)
        if (runIdRef.current !== myRun) return
        pushStatus(`Defined ${sys.components.length} reusable components — guideline published`)
      }
      for (const w of result.warnings) pushStatus(`⚠ ${w}`)

      if (!base) {
        // Second pass: fonts, icons, states, dark theme, text, overlays, images chosen FOR this language.
        pushStatus('Completing the language — fonts, icons, component states, dark theme, text, overlays, images')
        try {
          const completed = await generateExtras(config, sys, trimmed)
          if (runIdRef.current !== myRun) return
          sys = completed.system
          pushStatus(completed.used.length ? `Chosen by the model: ${completed.used.join(', ')} — the rest is derived from the tokens` : 'The model added nothing usable — every part is derived from the tokens')
          for (const w of completed.ignored) pushStatus(`⚠ ${w}`)
        } catch (err) {
          if (runIdRef.current !== myRun) return
          pushStatus(`⚠ The completion pass failed (${err instanceof Error ? err.message.slice(0, 90) : 'error'}) — every part is derived from the tokens`)
        }
      }
      setSystem(sys)
      if (runIdRef.current !== myRun) return

      let finalTree: LabNode | null = null
      if (streamed) {
        // canvas already reflects the stream — commit the fully validated page
        finalTree = sys.page
        setTree(finalTree)
      } else {
        // provider didn't stream (or JSON arrived whole) — play back the build
        await sleep(600)
        for (const op of compileLabOps(sys.page)) {
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
                finalTree = prev === null ? prev : patchNode(prev, op.id, { text: op.partial })
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
      const summary = `Done — “${sys.name}” · ${total} nodes from ${sys.components.length} components · ${model} · ${secs}s${streamed ? ' · streamed live' : ''}`
      setDoneSummary(summary)
      setRunning(false)
      onPersist({ system: finalTree ? { ...sys, page: finalTree } : sys, instruction: trimmed, doneSummary: summary })
    },
    [config, running, openConfig, pushStatus, failStatus, activeStyleId, styles, onPersist],
  )

  /** Runs only the second pass, for a built-in, saved or older language. */
  const completeLanguage = useCallback(async () => {
    if (!system || completing || running) return
    if (!config.apiKey.trim()) {
      openConfig()
      return
    }
    setCompleting(true)
    setError(null)
    runningRef.current = true // let the feed listen while this runs
    pushStatus('Completing the language — fonts, icons, component states, dark theme, text, overlays, images')
    try {
      const completed = await generateExtras(config, ensureLanguage(system, instruction ?? ''), instruction ?? system.name)
      setSystem(completed.system)
      pushStatus(completed.used.length ? `Chosen by the model: ${completed.used.join(', ')} — the rest is derived from the tokens` : 'The model added nothing usable — every part is derived from the tokens')
      for (const w of completed.ignored) pushStatus(`⚠ ${w}`)
      setSteps((prev) => prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)))
      onPersist({ system: completed.system, instruction, doneSummary })
    } catch (err) {
      failStatus(`Completion failed — ${err instanceof Error ? err.message : String(err)}`)
      setError(explainError(config, err))
    } finally {
      runningRef.current = false
      setCompleting(false)
    }
  }, [system, completing, running, config, openConfig, pushStatus, failStatus, instruction, doneSummary, onPersist])

  const stopRun = useCallback(() => {
    ++runIdRef.current // must come first: the aborted call's catch checks it
    abortActiveCalls()
    setRunning(false)
    setBuildingNodeId(null)
    failStatus('Stopped by you')
  }, [failStatus])

  const clearCanvas = useCallback(() => {
    ++runIdRef.current
    setError(null)
    setRunning(false)
    setSystem(null)
    setTree(null)
    setInstruction(null)
    setSteps([])
    setDoneSummary(null)
    setBuildingNodeId(null)
    setActiveNodeId(null)
    setHoverNodeId(null)
    onPersist({ system: null, instruction: null, doneSummary: null })
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
            <h1 className="text-[13px] font-semibold tracking-tight">Canvas Agent · Style template</h1>
            <p className="truncate font-mono text-[10px] text-zinc-500">
              {running ? 'inventing a design language…' : config.apiKey ? `${meta.label.split(' ')[0].toLowerCase()} · ${resolvedModel(config) || 'no model'}` : 'no provider configured'}
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
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Brief</p>
          <button
            type="button"
            disabled={running}
            onClick={openDesign}
            className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left transition-colors hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
          >
            <span className="flex h-3 w-14 shrink-0 overflow-hidden rounded-full bg-zinc-800">
              {activeStyle &&
                paletteOf(activeStyle.system, 6).map((hex, i) => <span key={i} className="flex-1" style={{ background: hex }} />)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] font-medium text-zinc-200">{activeStyle ? activeStyle.system.name : 'Free design'}</span>
              <span className="truncate font-mono text-[9.5px] text-zinc-500">
                {activeStyle ? 'composing inside this system' : 'inventing from first principles'}
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
            placeholder="Describe the world this design lives in — the model invents its own language for it…"
            className="thin-scroll resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/60"
          />
          <button
            type="button"
            disabled={running || !prompt.trim()}
            onClick={() => runPrompt(prompt)}
            className={`flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 ${
              running || !prompt.trim()
                ? 'cursor-not-allowed bg-zinc-900 text-zinc-600'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.99]'
            }`}
          >
            {running ? (
              <>
                <DotSpinner className="bg-zinc-400" /> designing…
              </>
            ) : activeStyle ? (
              <>❖ Compose with “{activeStyle.system.name}”</>
            ) : (
              <>❖ Invent a design language</>
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
          <div className="flex flex-wrap gap-1.5">
            {LAB_EXAMPLES.map((p) => (
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
          {(tree !== null || system !== null) && !running && (
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
            emptyHint="No framework here. The model derives a philosophy, mints raw tokens (its own hex pigments, type scale, rhythm), defines a component library from them, then composes the page out of component instances — and publishes the whole language as a guideline sheet."
          />
        </div>

        {/* Selection inspector */}
        <div className="flex h-52 shrink-0 flex-col border-t border-zinc-800/80">
          <p className="px-5 pt-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Selection · node + recipe</p>
          <div className="thin-scroll mx-4 mb-3 min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-800/80 bg-zinc-900/50">
            {activeNode ? (
              <pre className="p-3 font-mono text-[10.5px] leading-relaxed text-sky-300/90">
                {JSON.stringify(activeNode, null, 2)}
                {activeNode.component && system
                  ? `\n\n// component recipe\n${JSON.stringify(system.components.find((c) => c.name === activeNode.component) ?? {}, null, 2)}`
                  : ''}
              </pre>
            ) : (
              <p className="p-3 text-[11px] leading-relaxed text-zinc-600">
                {tree === null
                  ? 'The canvas is empty — nothing to inspect yet.'
                  : running
                    ? 'Selection unlocks when the agent finishes composing.'
                    : 'Click any node — component instances show their token-bound recipe too.'}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* ============ Canvas viewport ============ */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950 px-5">
          <span className="font-mono text-[11px] text-zinc-400">
            paper.design <span className="text-zinc-600">/</span> canvas-02 · lab
          </span>
          <span className="rounded-full border border-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
            {tree ? `${countTree(tree)} nodes` : 'empty'}
          </span>
          {system && (
            <div className="flex items-center gap-0.5 rounded-full border border-zinc-800 p-0.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setView('page')}
                className={`rounded-full px-2.5 py-0.5 transition-colors ${view === 'page' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                page
              </button>
              <button
                type="button"
                onClick={() => setView('system')}
                className={`rounded-full px-2.5 py-0.5 transition-colors ${view === 'system' ? 'bg-emerald-600/80 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                design system
              </button>
            </div>
          )}
          {running && (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] text-amber-400">
              <DotSpinner />
              agent writing
            </span>
          )}
          {display?.extras && !running && (
            <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-zinc-800 p-0.5 font-mono text-[10px]" title="Preview the page and the sheet in the language's light or dark theme">
              {(['light', 'dark'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-full px-2.5 py-0.5 transition-colors ${mode === m ? 'bg-emerald-600/80 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          {system && !running && (
            <button
              type="button"
              disabled={completing}
              onClick={completeLanguage}
              title="Ask the model to choose fonts, icons, states, a dark theme, text rules, overlays and images for this language"
              className="shrink-0 rounded-lg border border-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {completing ? 'completing…' : '✦ Complete language'}
            </button>
          )}
          <span className="ml-auto truncate font-mono text-[10px] text-zinc-600">
            {system ? `language: ${system.name}` : instruction ?? 'no brief yet'}
          </span>
          {system && !running && (
            <div className="flex shrink-0 items-center gap-1.5">
              {exportNote && <span className="font-mono text-[10px] text-emerald-400">{exportNote}</span>}
              <button
                type="button"
                title="Copy this style's colors, fonts, type, spacing, radius and shadows as CSS variables"
                onClick={async () => setExportNote((await copyText(systemToCss(system))) ? 'CSS variables copied' : 'copy blocked')}
                className="rounded-lg border border-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              >
                Copy CSS
              </button>
              <button
                type="button"
                title="Copy a Tailwind CSS v4 @theme block for this style"
                onClick={async () => setExportNote((await copyText(systemToTailwindTheme(system))) ? 'Tailwind theme copied' : 'copy blocked')}
                className="rounded-lg border border-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              >
                Copy Tailwind theme
              </button>
              <button
                type="button"
                title="Download the Tailwind theme as a CSS file"
                onClick={() => downloadText(`${system.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-theme.css`, systemToTailwindTheme(system), 'text/css')}
                className="rounded-lg border border-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              >
                ⇣ .css
              </button>
            </div>
          )}
        </header>

        <div className="canvas-backdrop thin-scroll relative flex-1 overflow-auto bg-zinc-900" onClick={() => setActiveNodeId(null)}>
          <div className="flex min-h-full items-start px-10 pt-24 pb-16">
            <div ref={artboardRef} className="relative mx-auto">
              <AgentCursor
                containerRef={artboardRef}
                targetId={buildingNodeId}
                active={running && view === 'page'}
                name={providerMeta(config.provider).label.split(' ')[0]}
              />
              {error && !running && (
                <div className="mb-4">
                  <AgentError report={error} onRetry={() => runPrompt(instruction ?? prompt)} onSettings={openConfig} onDismiss={() => setError(null)} />
                </div>
              )}
              {running && (
                <div className="absolute -top-11 right-0 z-30">
                  <AgentActivityDots accent="bg-emerald-500" label={steps.find((s) => s.state === 'active')?.label} />
                </div>
              )}
            {view === 'system' && system ? (
              <SystemSheet system={display ?? system} />
            ) : tree === null ? (
              <div className="flex h-[480px] w-[1240px] max-w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-700/70">
                {running ? (
                  <>
                    <DotSpinner className="bg-emerald-400" />
                    <p className="font-mono text-[11px] text-zinc-500">
                      {system ? 'language ready — composing page…' : 'inventing a design language…'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-[11px] text-zinc-500">frame-02 · blank slate</p>
                    <p className="max-w-[280px] text-center text-[11px] leading-relaxed text-zinc-600">
                      No preset styles, no library. Give the agent a world and it designs a language for it — then builds
                      the page from its own components.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="design-surface w-[1240px] overflow-hidden rounded-xl shadow-2xl">
                <LabRenderer
                  node={mode === 'dark' && display && !running ? display.page : tree}
                  system={display ?? system!}
                  activeNodeId={activeNodeId}
                  hoverNodeId={hoverNodeId}
                  buildingNodeId={buildingNodeId}
                  interactive={interactive}
                  onSelect={setActiveNodeId}
                  onHover={setHoverNodeId}
                />
              </div>
            )}
            </div>
          </div>
        </div>
      </main>

      {/* ============ Style library (right panel) ============ */}
      <aside className="flex w-[240px] shrink-0 flex-col border-l border-zinc-800/80 bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-4">
          <h2 className="text-[12px] font-semibold tracking-tight">Style library</h2>
          <span className="font-mono text-[10px] text-zinc-600">
            {styles.length - library.length} built-in · {library.length} saved
          </span>
        </header>

        <button
          type="button"
          disabled={!system || running}
          onClick={saveCurrentStyle}
          className={`mx-3 mt-3 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
            !system || running
              ? 'cursor-not-allowed border-zinc-800 text-zinc-600'
              : 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10'
          }`}
        >
          ＋ Save current style
        </button>

        <div className="mx-3 mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex-1 rounded-lg border border-zinc-800 px-2 py-1.5 font-mono text-[10.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            ⇣ import
          </button>
          <button
            type="button"
            disabled={library.length === 0}
            onClick={exportAll}
            className="flex-1 rounded-lg border border-zinc-800 px-2 py-1.5 font-mono text-[10.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⇡ export all
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
              e.target.value = '' // allow re-importing the same file
            }}
          />
        </div>

        {libraryNote && (
          <p className={`mx-3 mt-2 font-mono text-[10px] leading-relaxed ${libraryNote.kind === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {libraryNote.kind === 'ok' ? '✓' : '✗'} {libraryNote.text}
          </p>
        )}

        <div className="thin-scroll mt-3 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {library.length === 0 && (
            <p className="px-1 pb-1 text-[11px] leading-relaxed text-zinc-600">
              Click a style to load it — while selected, every new brief is composed inside that language. Generate one
              and save it to add your own.
            </p>
          )}
          {styles.map((saved) => (
              <div
                key={saved.id}
                onClick={() => selectStyle(saved)}
                className={`group cursor-pointer rounded-lg border p-2.5 transition-colors ${
                  activeStyleId === saved.id
                    ? 'border-emerald-500/70 bg-emerald-500/5'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[12px] font-medium text-zinc-200">{saved.system.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      title="Export this style as JSON"
                      onClick={(e) => {
                        e.stopPropagation()
                        exportOne(saved)
                      }}
                      className="font-mono text-[10px] text-zinc-600 opacity-0 transition-all hover:text-emerald-400 group-hover:opacity-100"
                    >
                      ⇡
                    </button>
                    {!saved.builtin && (
                      <button
                        type="button"
                        title="Delete style"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteStyle(saved.id)
                        }}
                        className="font-mono text-[10px] text-zinc-600 opacity-0 transition-all hover:text-rose-400 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 flex h-3 overflow-hidden rounded">
                  {Object.values(saved.system.tokens.color)
                    .slice(0, 6)
                    .map((hex, i) => (
                      <span key={i} className="flex-1" style={{ background: hex }} />
                    ))}
                </div>
                <p className="mt-1.5 font-mono text-[9.5px] text-zinc-600">
                  {saved.system.components.length} components ·{' '}
                  {saved.builtin ? 'built-in' : new Date(saved.savedAt).toLocaleDateString()}
                </p>
                {activeStyleId === saved.id && (
                  <p className="mt-1 font-mono text-[9.5px] text-emerald-400">● active — briefs compose with this</p>
                )}
              </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
