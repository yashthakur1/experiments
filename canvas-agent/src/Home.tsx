import { useState } from 'react'
import { DesignCard } from './DesignModal'
import { paletteOf, type SavedStyle } from './lab'
import { timeAgo, type Project } from './projects'
import { CanvasStatic, LabStatic, ScaledFrame } from './SystemPreview'

/* ================================================================== *
 *  Projects homepage — every project, the design systems you can start
 *  from, and the experiments. Opening a project drops you on its canvas.
 * ================================================================== */

function ProjectThumb({ project, styles }: { project: Project; styles: SavedStyle[] }) {
  const style = project.styleId ? (styles.find((s) => s.id === project.styleId) ?? null) : null
  const labReady = project.lab?.system !== null && project.lab?.system !== undefined
  const canvasReady = !!project.canvas?.tree
  // Prefer the page the user was last on, then whichever has content.
  const useLab = project.page === 'lab' ? labReady || !canvasReady : !canvasReady && labReady

  if (useLab && project.lab?.system) {
    return (
      <ScaledFrame baseWidth={1240} aspect={4 / 3} zoom={1.15} background="#09090b">
        <LabStatic system={project.lab.system} />
      </ScaledFrame>
    )
  }
  if (canvasReady && project.canvas?.tree) {
    return (
      <ScaledFrame baseWidth={1200} aspect={4 / 3} zoom={1.15} background="#09090b">
        <CanvasStatic node={project.canvas.tree} />
      </ScaledFrame>
    )
  }
  if (style) {
    return (
      <ScaledFrame
        baseWidth={1240}
        aspect={4 / 3}
        zoom={1.9}
        inset={{ x: 0.08, y: 0.3 }}
        background={style.system.meta?.backdrop ?? `linear-gradient(135deg, ${paletteOf(style.system, 3).join(', ')})`}
      >
        <div style={{ borderRadius: 14, overflow: 'hidden', opacity: 0.55 }}>
          <LabStatic system={style.system} />
        </div>
      </ScaledFrame>
    )
  }
  return (
    <div aria-hidden="true" className="canvas-backdrop flex items-center justify-center bg-zinc-900" style={{ aspectRatio: String(4 / 3) }}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">empty canvas</span>
    </div>
  )
}

interface ProjectCardProps {
  project: Project
  styles: SavedStyle[]
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function ProjectCard({ project, styles, onOpen, onDuplicate, onDelete }: ProjectCardProps) {
  const [confirming, setConfirming] = useState(false)
  const style = project.styleId ? (styles.find((s) => s.id === project.styleId) ?? null) : null

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition-all duration-150 focus-within:border-zinc-600 hover:-translate-y-0.5 hover:border-zinc-600">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-400"
      >
        <ProjectThumb project={project} styles={styles} />
        <div className="flex flex-col gap-1 px-4 py-3">
          <span className="truncate text-[14px] font-semibold text-zinc-100">{project.name}</span>
          <span className="flex items-center gap-2 truncate font-mono text-[10.5px] text-zinc-500">
            <span className={`size-1.5 shrink-0 rounded-full ${project.page === 'lab' ? 'bg-emerald-400' : 'bg-fuchsia-400'}`} />
            {project.page === 'lab' ? 'design lab' : 'vocabulary'} · {style ? style.system.name : 'free design'} · {timeAgo(project.updatedAt)}
          </span>
        </div>
      </button>

      <div
        className={`absolute right-2 top-2 flex items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-950/90 p-0.5 font-mono text-[10px] backdrop-blur transition-opacity ${
          confirming ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
        }`}
      >
        {confirming ? (
          <>
            <button type="button" onClick={onDelete} className="rounded-md px-2 py-1 text-rose-400 hover:bg-rose-500/10">
              delete?
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800">
              keep
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onDuplicate} title="Duplicate project" className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
              duplicate
            </button>
            <button type="button" onClick={() => setConfirming(true)} title="Delete project" className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400">
              delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface HomeProps {
  projects: Project[]
  styles: SavedStyle[]
  storageOk: boolean
  onNew: (presetStyleId: string | null) => void
  onOpen: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onScience: () => void
  openConfig: () => void
}

export default function Home({ projects, styles, storageOk, onNew, onOpen, onDuplicate, onDelete, onScience, openConfig }: HomeProps) {
  const sorted = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="thin-scroll h-full overflow-y-auto bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-8 pb-24 pt-8">
        <header className="flex items-center gap-3">
          <span className="font-mono text-[12px] font-semibold tracking-tight text-zinc-300">
            paper.design <span className="font-normal text-zinc-600">· AI canvas</span>
          </span>
          <button
            type="button"
            onClick={openConfig}
            className="ml-auto rounded-lg border border-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            ⚙ model
          </button>
          <button
            type="button"
            onClick={() => onNew(null)}
            className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-sky-500"
          >
            ＋ New project
          </button>
        </header>

        <section className="flex flex-col gap-3">
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-balance">Design with an agent, inside a real system.</h1>
          <p className="max-w-[620px] text-[14px] leading-relaxed text-zinc-400">
            Start a project, pick a design system, and describe a screen. The agent builds it live on the canvas from that
            system’s tokens and components.
          </p>
        </section>

        <section aria-labelledby="projects-title" className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id="projects-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Projects
            </h2>
            <span className="font-mono text-[10.5px] text-zinc-700">{projects.length}</span>
            {!storageOk && (
              <span className="font-mono text-[10.5px] text-amber-400">browser storage is full or blocked — changes will not survive a reload</span>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            <button
              type="button"
              onClick={() => onNew(null)}
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-zinc-500 transition-colors hover:border-sky-500/70 hover:bg-sky-500/5 hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <span className="text-2xl">＋</span>
              <span className="text-[13px] font-medium">New project</span>
              <span className="font-mono text-[10.5px] text-zinc-600">pick a design system, then design</span>
            </button>
            {sorted.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                styles={styles}
                onOpen={() => onOpen(project.id)}
                onDuplicate={() => onDuplicate(project.id)}
                onDelete={() => onDelete(project.id)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="systems-title" className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id="systems-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Design systems
            </h2>
            <span className="font-mono text-[10.5px] text-zinc-700">click one to start a project with it</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {styles.map((s) => (
              <DesignCard key={s.id} style={s} onClick={() => onNew(s.id)} />
            ))}
          </div>
        </section>

        <section aria-labelledby="exp-title" className="flex flex-col gap-4">
          <h2 id="exp-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Experiments
          </h2>
          <button
            type="button"
            onClick={onScience}
            className="flex max-w-[420px] items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-colors hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sky-600/20 text-lg text-sky-300">∿</span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-zinc-100">Double-slit · wave optics</span>
              <span className="text-[11.5px] text-zinc-500">A live interference simulation. It has no design system.</span>
            </span>
          </button>
        </section>
      </div>
    </div>
  )
}
