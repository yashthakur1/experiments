import { ThemeToggle } from './ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadConfig, saveConfig, type AIConfig } from './ai'
import { ConfigModal } from './ConfigModal'
import { DesignModal } from './DesignModal'
import Home from './Home'
import { loadStyleLibrary, saveStyleLibrary, type SavedStyle } from './lab'
import PageScience from './PageScience'
import { loadProjects, newProject, saveProjects, type Project } from './projects'
import { BUILTIN_STYLES } from './systems'
import Workspace from './Workspace'

/* ================================================================== *
 *  Shell — projects homepage → workspace (two canvases) per project.
 *  The style library is shared: built-in systems ship with the app,
 *  saved ones live in localStorage. Both feed every project.
 * ================================================================== */

type Route = { name: 'home' } | { name: 'project'; id: string } | { name: 'science' }

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [config, setConfig] = useState<AIConfig>(() => loadConfig())
  const [configOpen, setConfigOpen] = useState(false)
  const [library, setLibrary] = useState<SavedStyle[]>(() => loadStyleLibrary())
  const [projects, setProjects] = useState<Project[]>(() => loadProjects())
  const [storageOk, setStorageOk] = useState(true)
  // null = closed; otherwise the design system to preselect (or null for none)
  const [creating, setCreating] = useState<{ presetId: string | null } | null>(null)

  const styles = useMemo(() => [...BUILTIN_STYLES, ...library], [library])

  const updateLibrary = useCallback((next: SavedStyle[]) => {
    setLibrary(next)
    saveStyleLibrary(next)
  }, [])

  useEffect(() => {
    setStorageOk(saveProjects(projects))
  }, [projects])

  const currentId = route.name === 'project' ? route.id : null
  const project = currentId ? (projects.find((p) => p.id === currentId) ?? null) : null

  const updateCurrent = useCallback(
    (patch: Partial<Project>) => {
      if (!currentId) return
      // Switching tabs is navigation, not editing: keep the project's "last edited" time.
      const touch = !(Object.keys(patch).length === 1 && 'page' in patch)
      setProjects((prev) =>
        prev.map((p) => (p.id === currentId ? { ...p, ...patch, ...(touch ? { updatedAt: new Date().toISOString() } : {}) } : p)),
      )
    },
    [currentId],
  )

  const duplicate = useCallback((id: string) => {
    setProjects((prev) => {
      const source = prev.find((p) => p.id === id)
      if (!source) return prev
      const now = new Date().toISOString()
      const copy: Project = { ...structuredClone(source), id: crypto.randomUUID(), name: `${source.name} copy`, createdAt: now, updatedAt: now }
      return [copy, ...prev]
    })
  }, [])

  const remove = useCallback((id: string) => setProjects((prev) => prev.filter((p) => p.id !== id)), [])

  // A deleted or missing project must not leave the user on a blank screen.
  const view: Route = route.name === 'project' && !project ? { name: 'home' } : route

  return (
    <div className="h-full overflow-hidden bg-zinc-950 text-zinc-100">
      {view.name === 'home' && (
        <Home
          projects={projects}
          styles={styles}
          storageOk={storageOk}
          onNew={(presetId) => setCreating({ presetId })}
          onOpen={(id) => setRoute({ name: 'project', id })}
          onDuplicate={duplicate}
          onDelete={remove}
          onScience={() => setRoute({ name: 'science' })}
          openConfig={() => setConfigOpen(true)}
        />
      )}

      {view.name === 'project' && project && (
        <Workspace
          key={project.id}
          project={project}
          styles={styles}
          library={library}
          onLibraryChange={updateLibrary}
          config={config}
          openConfig={() => setConfigOpen(true)}
          onUpdate={updateCurrent}
          onBack={() => setRoute({ name: 'home' })}
        />
      )}

      {view.name === 'science' && (
        <div className="flex h-full flex-col">
          <nav className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800/80 px-4">
            <button
              type="button"
              onClick={() => setRoute({ name: 'home' })}
              className="rounded-md px-2 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              ← projects
            </button>
            <span className="text-zinc-700">/</span>
            <span className="font-mono text-[11px] text-zinc-300">experiments · double-slit</span>
            <ThemeToggle className="ml-auto" />
          </nav>
          <div className="min-h-0 flex-1">
            <PageScience />
          </div>
        </div>
      )}

      {creating && (
        <DesignModal
          mode="create"
          styles={styles}
          initialId={creating.presetId}
          onClose={() => setCreating(null)}
          onConfirm={({ styleId, name, page }) => {
            const created = newProject(name ?? '', styleId, page ?? 'canvas')
            setProjects((prev) => [created, ...prev])
            setCreating(null)
            setRoute({ name: 'project', id: created.id })
          }}
        />
      )}

      {configOpen && (
        <ConfigModal
          config={config}
          onClose={() => setConfigOpen(false)}
          onSave={(next) => {
            setConfig(next)
            saveConfig(next)
            setConfigOpen(false)
          }}
        />
      )}
    </div>
  )
}
