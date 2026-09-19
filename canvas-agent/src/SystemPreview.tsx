import { useEffect, useRef, useState } from 'react'
import type { CanvasNode } from './ai'
import { nodeStyle, type DesignSystem, type LabNode } from './lab'

/* Static, non-interactive renderers used for thumbnails. They reuse the
   exact token resolution of the real canvas, so a thumbnail is the real
   design, just scaled down. */

function LabStaticNode({ node, system }: { node: LabNode; system: DesignSystem }) {
  return (
    <div style={nodeStyle(node, system)}>
      {node.text}
      {node.children?.map((child) => <LabStaticNode key={child.id} node={child} system={system} />)}
    </div>
  )
}

export function LabStatic({ system, node }: { system: DesignSystem; node?: LabNode }) {
  return <LabStaticNode node={node ?? system.page} system={system} />
}

export function CanvasStatic({ node }: { node: CanvasNode }) {
  return (
    <div className={node.classes}>
      {node.content}
      {node.children?.map((child) => <CanvasStatic key={child.id} node={child} />)}
    </div>
  )
}

interface ScaledFrameProps {
  /** Natural width of the content, in px. */
  baseWidth: number
  /** width / height of the frame. */
  aspect?: number
  /** Multiplier on top of "fit width". >1 crops, showing the top-left corner like a zoomed screenshot. */
  zoom?: number
  /** Offset of the content inside the frame, as fractions of frame width/height. */
  inset?: { x: number; y: number }
  background?: string
  className?: string
  children: React.ReactNode
}

export function ScaledFrame({ baseWidth, aspect = 16 / 10, zoom = 1, inset = { x: 0, y: 0 }, background, className = '', children }: ScaledFrameProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const height = width / aspect
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none relative select-none overflow-hidden ${className}`}
      style={{ aspectRatio: String(aspect), background }}
    >
      <div
        style={{
          position: 'absolute',
          left: inset.x * width,
          top: inset.y * height,
          width: baseWidth,
          transformOrigin: 'top left',
          transform: `scale(${(width / baseWidth) * zoom})`,
          visibility: width === 0 ? 'hidden' : 'visible',
        }}
      >
        {children}
      </div>
    </div>
  )
}
