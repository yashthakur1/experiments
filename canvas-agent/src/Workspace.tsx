import { ThemeToggle } from './ui'
import { useCallback, useState } from 'react'
import type { AIConfig } from './ai'
import { DesignModal } from './DesignModal'
import { paletteOf, type SavedStyle } from './lab'
import PageCanvas from './PageCanvas'
import PageLab from './PageLab'
import type { CanvasState, LabState, Project } from './projects'

/* ================================================================== *
 *  Workspace — one project, two canvases, one agent:
 *   01 Handover design — AI designs within a safelisted Tailwind
 *      vocabulary (fast, predictable, framework-realizable).
 *   02 Style template — AI composes from a real token + component system,
 *      or invents a raw one from first principles.
 *  Both stay mounted so switching tabs never loses a canvas. Every
 *  finished generation is saved into the project.
 * ================================================================== */

interface WorkspaceProps {
  project: Project
  styles: SavedStyle[]
  library: SavedStyle[]
  onLibraryChange: (next: SavedStyle[]) => void
  config: AIConfig
  openConfig: () => void
  onUpdate: (patch: Partial<Project>) => void
  onBack: () => void
}

export default function Workspace({ project, styles, library, onLibraryChange, config, openConfig, onUpdate, onBack }: WorkspaceProps) {
  const [designOpen, setDesignOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const page = project.page
  const style = project.styleId ? (styles.find((s) => s.id === project.styleId) ?? null) : null

  const persistCanvas = useCallback((canvas: CanvasState) => onUpdate({ canvas }), [onUpdate])
  const persistLab = useCallback((lab: LabState) => onUpdate({ lab }), [onUpdate])
  const setStyleId = useCallback((styleId: string | null) => onUpdate({ styleId }), [onUpdate])
  const openDesign = useCallback(() => setDesignOpen(true), [])

  const commitName = () => {
    const next = name.trim() || 'Untitled project'
    setName(next)
    if (next !== project.name) onUpdate({ name: next })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <nav className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950 px-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-2 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        >
          ← projects
        </button>
        <span className="text-zinc-700">/</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setName(project.name)
              e.currentTarget.blur()
            }
          }}
          aria-label="Project name"
          className="w-48 rounded-md border border-transparent bg-transparent px-2 py-1 text-[12px] font-medium text-zinc-200 outline-none transition-colors hover:border-zinc-800 focus:border-sky-500"
        />
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 p-0.5">
          <button
            type="button"
            onClick={() => onUpdate({ page: 'canvas' })}
            title="Design a real page you can hand to developers: copy React or HTML code, inspect sizes and colors, and export tokens."
            className={`rounded-md px-3 py-1 font-mono text-[11px] transition-colors ${
              page === 'canvas' ? 'bg-fuchsia-600/90 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            01 · handover design
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ page: 'lab' })}
            title="Create a reusable design style: colors, type and components. Save it, export its tokens, and apply it to any design."
            className={`rounded-md px-3 py-1 font-mono text-[11px] transition-colors ${
              page === 'lab' ? 'bg-emerald-600/90 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            02 · style template
          </button>
        </div>
        <button
          type="button"
          onClick={openDesign}
          className="ml-auto flex items-center gap-2 rounded-lg border border-zinc-800 px-2.5 py-1 text-left transition-colors hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          <span className="flex h-2.5 w-10 overflow-hidden rounded-full bg-zinc-800">
            {style && paletteOf(style.system, 6).map((hex, i) => <span key={i} className="flex-1" style={{ background: hex }} />)}
          </span>
          <span className="font-mono text-[11px] text-zinc-300">{style ? style.system.name : 'free design'}</span>
          <span className="font-mono text-[10px] text-zinc-600">▾</span>
        </button>
        <ThemeToggle />
      </nav>

      <div className="min-h-0 flex-1">
        <div className={page === 'canvas' ? 'h-full' : 'hidden'}>
          <PageCanvas
            config={config}
            openConfig={openConfig}
            styles={styles}
            styleId={project.styleId}
            openDesign={openDesign}
            initial={project.canvas}
            onPersist={persistCanvas}
          />
        </div>
        <div className={page === 'lab' ? 'h-full' : 'hidden'}>
          <PageLab
            config={config}
            openConfig={openConfig}
            styles={styles}
            library={library}
            onLibraryChange={onLibraryChange}
            styleId={project.styleId}
            onStyleChange={setStyleId}
            openDesign={openDesign}
            initial={project.lab}
            onPersist={persistLab}
          />
        </div>
      </div>

      {designOpen && (
        <DesignModal
          mode="switch"
          styles={styles}
          initialId={project.styleId}
          onClose={() => setDesignOpen(false)}
          onConfirm={({ styleId }) => {
            setStyleId(styleId)
            setDesignOpen(false)
          }}
        />
      )}
    </div>
  )
}
