import type { CanvasNode } from './ai'
import type { DesignSystem } from './lab'

/* ================================================================== *
 *  Projects — each project owns a design system choice plus the state
 *  of both canvases, so you can leave and come back. Stored in
 *  localStorage; a full or blocked store never breaks the app.
 * ================================================================== */

/** The design as it was before a change, so a change can be undone. */
export interface CanvasSnapshot {
  tree: CanvasNode | null
  instruction: string | null
  doneSummary: string | null
  turns: string[]
}

export interface CanvasState {
  tree: CanvasNode | null
  instruction: string | null
  doneSummary: string | null
  /** Every request made on this design, oldest first (the chain of changes). */
  turns?: string[]
  /** Earlier versions, newest last. Capped. */
  history?: CanvasSnapshot[]
}

export interface LabState {
  /** The generated language. Its `page` is the canvas content. */
  system: DesignSystem | null
  instruction: string | null
  doneSummary: string | null
}

export type ProjectPage = 'canvas' | 'lab'

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  /** Chosen design system (built-in or saved). null = free design. */
  styleId: string | null
  page: ProjectPage
  canvas: CanvasState | null
  lab: LabState | null
}

const PROJECTS_KEY = 'canvas-agent-projects'

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
    }
  } catch {
    /* corrupted store falls through to empty */
  }
  return []
}

/** Returns false when the browser refuses the write (quota, private mode). */
export function saveProjects(projects: Project[]): boolean {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
    return true
  } catch {
    return false
  }
}

export function newProject(name: string, styleId: string | null, page: ProjectPage): Project {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled project',
    createdAt: now,
    updatedAt: now,
    styleId,
    page,
    canvas: null,
    lab: null,
  }
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
