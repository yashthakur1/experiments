import { useEffect, useMemo, useRef, useState } from 'react'
import { paletteOf, type SavedStyle } from './lab'
import type { ProjectPage } from './projects'
import { LabStatic, ScaledFrame } from './SystemPreview'

/* ================================================================== *
 *  Design selection — a grid of live thumbnails (the real page,
 *  scaled down), search, filter, and a footer that explains what you
 *  are about to pick. Used to start a project and to switch systems.
 * ================================================================== */

function fallbackBackdrop(style: SavedStyle): string {
  const [a = '#27272a', b = '#3f3f46', c = '#18181b'] = paletteOf(style.system, 3)
  return `linear-gradient(135deg, ${c}, ${a} 55%, ${b})`
}

interface DesignCardProps {
  style: SavedStyle | null // null = free design
  selected?: boolean
  onClick: () => void
  radio?: boolean
}

export function DesignCard({ style, selected = false, onClick, radio = false }: DesignCardProps) {
  const title = style ? style.system.name : 'Free design'
  const subtitle = style
    ? (style.system.meta?.tagline ?? `${style.system.components.length} components · saved style`)
    : 'No design system. The model picks its own look.'

  return (
    <button
      type="button"
      onClick={onClick}
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? selected : undefined}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-zinc-900/60 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
        selected
          ? 'border-sky-500 shadow-[0_0_0_1px_rgb(14_165_233)]'
          : 'border-zinc-800 hover:-translate-y-0.5 hover:border-zinc-600'
      }`}
    >
      {style ? (
        <ScaledFrame
          baseWidth={1240}
          aspect={4 / 3}
          zoom={1.9}
          inset={{ x: 0.08, y: 0.3 }}
          background={style.system.meta?.backdrop ?? fallbackBackdrop(style)}
        >
          <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
            <LabStatic system={style.system} />
          </div>
        </ScaledFrame>
      ) : (
        <div
          aria-hidden="true"
          className="flex items-center justify-center bg-zinc-950"
          style={{ aspectRatio: String(4 / 3) }}
        >
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-6 py-5">
            <span className="text-2xl text-zinc-400">✦</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">blank slate</span>
          </div>
        </div>
      )}

      {selected && (
        <span className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-sky-500 text-[12px] font-bold text-white shadow-lg">
          ✓
        </span>
      )}

      <div className="flex flex-col gap-0.5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-zinc-100">{title}</span>
          {style?.builtin && (
            <span className="rounded-full border border-zinc-700 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-zinc-500">
              built-in
            </span>
          )}
        </div>
        <span className="truncate text-[12px] text-zinc-500">{subtitle}</span>
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */

type Filter = 'all' | 'builtin' | 'yours'

export interface DesignChoice {
  styleId: string | null
  name?: string
  page?: ProjectPage
}

interface DesignModalProps {
  mode: 'create' | 'switch'
  styles: SavedStyle[]
  initialId: string | null
  onClose: () => void
  onConfirm: (choice: DesignChoice) => void
}

export function DesignModal({ mode, styles, initialId, onClose, onConfirm }: DesignModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [name, setName] = useState('')
  const [page, setPage] = useState<ProjectPage>('canvas')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const yoursCount = styles.filter((s) => !s.builtin).length
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return styles.filter((s) => {
      if (filter === 'builtin' && !s.builtin) return false
      if (filter === 'yours' && s.builtin) return false
      if (!q) return true
      const hay = `${s.system.name} ${s.system.meta?.tagline ?? ''} ${s.system.meta?.stack ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [styles, query, filter])

  const selected = selectedId ? (styles.find((s) => s.id === selectedId) ?? null) : null
  const showFree = filter === 'all' && (!query.trim() || 'free design'.includes(query.trim().toLowerCase()))
  const meta = selected?.system.meta

  const confirm = () =>
    onConfirm(mode === 'create' ? { styleId: selected?.id ?? null, name: name.trim() || 'Untitled project', page } : { styleId: selected?.id ?? null })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(800px,92vh)] w-[min(1120px,100%)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl outline-none"
      >
        {/* Header */}
        <header className="flex flex-wrap items-center gap-4 border-b border-zinc-800/80 px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 id="design-modal-title" className="text-[15px] font-semibold tracking-tight text-zinc-100">
              {mode === 'create' ? 'New project · choose a design system' : 'Design system'}
            </h2>
            <p className="text-[12px] text-zinc-500">
              Every canvas in the project builds inside the system you pick. You can change it later.
            </p>
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 p-0.5 font-mono text-[11px]">
            {(
              [
                ['all', `all · ${styles.length}`],
                ['builtin', `built-in · ${styles.length - yoursCount}`],
                ['yours', `yours · ${yoursCount}`],
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-md px-2.5 py-1 transition-colors ${filter === id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search systems…"
            aria-label="Search design systems"
            className="w-48 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            ✕
          </button>
        </header>

        {/* Grid */}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-6">
          <div role="radiogroup" aria-label="Design systems" className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
            {showFree && <DesignCard radio style={null} selected={selectedId === null} onClick={() => setSelectedId(null)} />}
            {visible.map((s) => (
              <DesignCard key={s.id} radio style={s} selected={selectedId === s.id} onClick={() => setSelectedId(s.id)} />
            ))}
          </div>
          {visible.length === 0 && !showFree && (
            <p className="py-16 text-center text-[12px] text-zinc-600">
              No design system matches “{query}”. Save one from Style template and it will show up here.
            </p>
          )}
          {filter === 'yours' && yoursCount === 0 && (
            <p className="py-16 text-center text-[12px] leading-relaxed text-zinc-600">
              Nothing saved yet. Create one in Style template, press “Save current style”, and it appears here.
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-zinc-800/80 bg-zinc-950 px-6 py-4">
          <div className="flex min-h-[128px] min-w-0 flex-1 basis-[320px] flex-col justify-center gap-1.5">
            {selected ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-zinc-100">{selected.system.name}</span>
                  <span className="flex h-2.5 w-24 overflow-hidden rounded-full">
                    {paletteOf(selected.system, 8).map((hex, i) => (
                      <span key={i} className="flex-1" style={{ background: hex }} />
                    ))}
                  </span>
                  <span className="font-mono text-[10.5px] text-zinc-500">{selected.system.components.length} components</span>
                </div>
                <p className="line-clamp-2 text-[11.5px] leading-relaxed text-zinc-400">{selected.system.philosophy}</p>
                {meta && (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-zinc-600">
                    <span>{meta.stack}</span>
                    {meta.install && <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">{meta.install}</code>}
                    {meta.docs && (
                      <a href={meta.docs} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                        docs ↗
                      </a>
                    )}
                  </p>
                )}
                {meta && <p className="text-[10.5px] leading-relaxed text-zinc-600">Source: {meta.provenance}</p>}
              </>
            ) : (
              <p className="text-[12px] leading-relaxed text-zinc-500">
                <span className="font-semibold text-zinc-300">Free design.</span> No system constrains the model. Each brief gets its own look.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {mode === 'create' && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Project name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirm()
                    }}
                    placeholder="Untitled project"
                    className="w-52 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[12.5px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500"
                  />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Start in</span>
                  <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 p-0.5 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPage('canvas')}
                      title="Design a real page you can hand to developers: copy React or HTML code, inspect sizes and colors, and export tokens."
                      className={`rounded-md px-2.5 py-1.5 transition-colors ${page === 'canvas' ? 'bg-fuchsia-600/90 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      handover design
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage('lab')}
                      title="Create a reusable design style: colors, type and components. Save it, export its tokens, and apply it to any design."
                      className={`rounded-md px-2.5 py-1.5 transition-colors ${page === 'lab' ? 'bg-emerald-600/90 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      style template
                    </button>
                  </div>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              className="rounded-lg bg-sky-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-sky-500"
            >
              {mode === 'create' ? 'Create project' : selected ? `Use ${selected.system.name}` : 'Use free design'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
