import { Component, createElement, useEffect, useState, type ElementType, type ReactElement, type ReactNode } from 'react'
import type { CanvasNode, DesignFonts } from '../ai'
import { useGoogleFonts } from '../fonts'
import { cn } from '@/lib/utils'
import { componentSpec, getLibrary, type LibraryId } from './catalog'
import type { LoadedLibrary } from './libs/types'

/* ================================================================== *
 *  Render maps: catalog name → the REAL component.
 *  Each library lives in its own module under ./libs and is loaded on
 *  demand, so the app opens without shipping Material, Ant Design,
 *  HeroUI and the rest. The first design in a style loads that
 *  library (and preloadLibrary starts it as soon as a style is picked).
 * ================================================================== */

const LOADERS: Record<LibraryId, () => Promise<{ default: LoadedLibrary }>> = {
  shadcn: () => import('./libs/shadcn'),
  relume: () => import('./libs/relume'),
  heroui: () => import('./libs/heroui'),
  mui: () => import('./libs/mui'),
  antd: () => import('./libs/antd'),
}

const loaded: Partial<Record<LibraryId, LoadedLibrary>> = {}
const loading: Partial<Record<LibraryId, Promise<LoadedLibrary>>> = {}

/** Loads a library once; later calls share the same promise. A failed load can be retried. */
export function loadLibrary(id: LibraryId): Promise<LoadedLibrary> {
  const done = loaded[id]
  if (done) return Promise.resolve(done)
  loading[id] ??= LOADERS[id]().then(
    (m) => (loaded[id] = m.default),
    (error) => {
      delete loading[id]
      throw error
    },
  )
  return loading[id]!
}

/** Starts loading in the background (for example when a style is picked). Never throws. */
export function preloadLibrary(id: LibraryId | null | undefined) {
  if (id) loadLibrary(id).catch(() => {})
}

export const isLibraryLoaded = (id: LibraryId) => Boolean(loaded[id])

/** Catalog components with no real component in the render map. Call after loadLibrary. */
export function missingRenderers(id: LibraryId): string[] {
  const map = loaded[id]?.map
  return (getLibrary(id)?.components ?? []).filter((c) => !map?.[c.name]).map((c) => c.name)
}

/**
 * Loads a library and wraps its design in the theme provider the library needs (if any). Shows a small
 * placeholder until the library is ready, so real components never render before they exist.
 */
export function RealLibraryProvider({ library, fonts, children }: { library: LibraryId | null; fonts?: DesignFonts | null; children: ReactNode }) {
  useGoogleFonts([fonts?.heading, fonts?.body])
  const [, setTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const ready = library === null || isLibraryLoaded(library)
  useEffect(() => {
    if (!library || isLibraryLoaded(library)) return
    let alive = true
    setError(null)
    loadLibrary(library).then(
      () => alive && setTick((n) => n + 1),
      (e) => alive && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      alive = false
    }
  }, [library])

  if (library === null) return <>{children}</>
  const label = getLibrary(library)?.label ?? library
  if (error) {
    return (
      <div className="m-6 inline-block rounded border border-red-500/60 bg-red-950/60 px-3 py-2 font-mono text-[12px] text-red-300">
        ⚠ Could not load {label}: {error}
      </div>
    )
  }
  if (!ready) {
    return <div className="delayed-in m-6 font-mono text-[12px] text-zinc-500">Loading {label} components…</div>
  }
  const Provider = loaded[library]!.Provider
  return Provider ? <Provider fonts={fonts}>{children}</Provider> : <>{children}</>
}

/* ------------------------------------------------------------------ *
 *  Error boundary: a wrongly nested or misused component must not
 *  take the whole canvas down.
 * ------------------------------------------------------------------ */

/**
 * A wrapper that is invisible to the library: it takes the real component (`as`) and ALL of its props, and
 * renders `<as {...props}>`. Libraries that inspect their direct children (Material's Tabs reads
 * child.props.value and clones each child) therefore still see the real props on this element.
 * If the component throws, a small fallback is shown instead of taking down the canvas.
 */
class NodeBoundary extends Component<{ as: ElementType; boundaryName: string; resetKey: string } & Record<string, unknown>, { message: string | null }> {
  state = { message: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    // While the answer streams in, a component can be incomplete (a table with no rows yet) and throw.
    // Try again whenever anything under it changes.
    if (this.state.message !== null && prev.resetKey !== this.props.resetKey) this.setState({ message: null })
  }
  render() {
    const { as: As, boundaryName, resetKey: _resetKey, ...rest } = this.props
    void _resetKey
    if (this.state.message === null) return createElement(As, rest)
    // shown only if the error lasts: a streaming node usually recovers within a moment
    return (
      <span className="delayed-in inline-block rounded border border-red-500/60 bg-red-950/60 px-2 py-1 font-mono text-[11px] text-red-300" title={this.state.message}>
        ⚠ {boundaryName} could not render
      </span>
    )
  }
}

/** Changes whenever anything anywhere under a node changes (a table breaks when a row deep inside is half-streamed). */
function subtreeKey(node: CanvasNode): string {
  return `${node.id}:${node.content?.length ?? 0}:${(node.children ?? []).map(subtreeKey).join(',')}`
}

export interface RealHandlers {
  onClick: (e: React.MouseEvent) => void
  onMouseOver: (e: React.MouseEvent) => void
  onMouseOut: (e: React.MouseEvent) => void
}

export interface RenderCtx {
  library: LibraryId
  /** Extra classes from the editor (selection / hover / building ring) for a node. */
  ringClass: (node: CanvasNode) => string
  handlers: (node: CanvasNode) => RealHandlers
  /** Renders a node that is not a real component (layout blocks, text). */
  renderPlain: (node: CanvasNode) => ReactNode
}

/**
 * Renders one "component" node with the real library component, as a plain FUNCTION (not a component), so
 * a real parent gets its real children as direct elements. Material's Tabs, for example, reads each child's
 * props and clones it; a wrapper component in between would hide them.
 */
export function renderRealNode(node: CanvasNode, ctx: RenderCtx): ReactElement {
  const spec = componentSpec(ctx.library, node.component)
  const Comp = spec ? loaded[ctx.library]?.map[spec.name] : undefined
  if (!spec || !Comp) {
    return (
      <span key={node.id} data-node-id={node.id} className="inline-block rounded border border-amber-500/60 px-2 py-1 font-mono text-[11px] text-amber-300">
        ⚠ unknown component {node.component ?? '?'}
      </span>
    )
  }
  const props: Record<string, unknown> = { ...spec.fixed, ...node.props }
  if (spec.name === 'Icon') props.name = node.props?.name
  const content = spec.takes === 'text' || spec.takes === 'both' ? node.content : undefined
  const childNodes = spec.takes === 'children' || spec.takes === 'both' ? (node.children ?? []) : []
  const kids = childNodes.map((c) => (c.type === 'component' ? renderRealNode(c, ctx) : ctx.renderPlain(c)))
  // createElement with an explicit child list: void elements (Input, Separator…) must get NO children prop.
  const children = [content, ...kids].filter((c) => c !== undefined && c !== '')
  const propsKey = JSON.stringify(props)
  return createElement(
    NodeBoundary,
    {
      as: Comp,
      boundaryName: spec.name,
      resetKey: `${propsKey}|${subtreeKey(node)}`,
      ...props,
      // Radix reads defaultValue / defaultChecked once, at mount. While the answer streams in, a node can
      // mount before its props arrive, so remount whenever the props change.
      key: `${node.id}|${propsKey}`,
      'data-node-id': node.id,
      className: cn(node.classes, ctx.ringClass(node), 'node-in'),
      ...ctx.handlers(node),
    },
    ...children,
  )
}
