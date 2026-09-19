import { Component, createElement, type ElementType, type ReactNode } from 'react'
import * as Lucide from 'lucide-react'
import * as Relume from '@relume_io/relume-ui'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { CanvasNode } from '../ai'
import { cn } from '@/lib/utils'
import { componentSpec, ICON_NAMES, type LibraryId } from './catalog'

/* ================================================================== *
 *  Render map: catalog name → the REAL component.
 *  shadcn/ui components live in src/components/ui (the official
 *  new-york-v4 source, fetched from the shadcn registry).
 *  Relume components come straight from the @relume_io/relume-ui package.
 * ================================================================== */

const ICONS = Object.fromEntries(ICON_NAMES.map((name) => [name, (Lucide as unknown as Record<string, ElementType>)[name]])) as Record<string, ElementType>

/** lucide icon by name; forwards data-node-id, className and handlers to the <svg>. */
function Icon({ name, ...rest }: { name?: string } & Record<string, unknown>) {
  const Glyph = ICONS[name ?? ''] ?? Lucide.Circle
  return <Glyph {...rest} />
}

const SHADCN_MAP: Record<string, ElementType> = {
  Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Textarea, Label, Separator,
  Avatar, AvatarFallback, Tabs, TabsList, TabsTrigger, TabsContent, Switch, Checkbox, Progress, Alert, AlertTitle,
  AlertDescription, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Skeleton, Accordion, AccordionItem,
  AccordionTrigger, AccordionContent, Icon,
}

const R = Relume as unknown as Record<string, ElementType>
const RELUME_MAP: Record<string, ElementType> = {
  Button: R.Button, Badge: R.Badge, Input: R.Input, Textarea: R.Textarea, Label: R.Label, Checkbox: R.Checkbox, Switch: R.Switch,
  Separator: R.Separator, Skeleton: R.Skeleton, Tabs: R.Tabs, TabsList: R.TabsList, TabsTrigger: R.TabsTrigger,
  TabsContent: R.TabsContent, Accordion: R.Accordion, AccordionItem: R.AccordionItem, AccordionTrigger: R.AccordionTrigger,
  AccordionContent: R.AccordionContent, Table: R.Table, TableHeader: R.TableHeader, TableBody: R.TableBody,
  TableRow: R.TableRow, TableHead: R.TableHead, TableCell: R.TableCell, Icon,
}

const MAPS: Record<LibraryId, Record<string, ElementType>> = { shadcn: SHADCN_MAP, relume: RELUME_MAP }

/** Names the catalog promises but the render map lacks (checked by tests). */
export function missingRenderers(id: LibraryId): string[] {
  return Object.keys(MAPS[id]).filter((k) => !MAPS[id][k])
}

/* ------------------------------------------------------------------ *
 *  Error boundary: a wrongly nested or misused component must not
 *  take the whole canvas down.
 * ------------------------------------------------------------------ */

class NodeBoundary extends Component<{ name: string; children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }
  render() {
    if (this.state.message === null) return this.props.children
    return (
      <span className="inline-block rounded border border-red-500/60 bg-red-950/60 px-2 py-1 font-mono text-[11px] text-red-300" title={this.state.message}>
        ⚠ {this.props.name} could not render
      </span>
    )
  }
}

interface RealNodeViewProps {
  node: CanvasNode
  library: LibraryId
  /** Extra classes from the editor (selection / hover / building ring). */
  ringClass: string
  handlers: {
    onClick: (e: React.MouseEvent) => void
    onMouseOver: (e: React.MouseEvent) => void
    onMouseOut: (e: React.MouseEvent) => void
  }
  kids: ReactNode[]
}

/** Renders one "component" node with the real library component. */
export function RealNodeView({ node, library, ringClass, handlers, kids }: RealNodeViewProps) {
  const spec = componentSpec(library, node.component)
  const Comp = spec ? MAPS[library][spec.name] : undefined
  if (!spec || !Comp) {
    return (
      <span data-node-id={node.id} className="inline-block rounded border border-amber-500/60 px-2 py-1 font-mono text-[11px] text-amber-300">
        ⚠ unknown component {node.component ?? '?'}
      </span>
    )
  }
  const props: Record<string, unknown> = { ...spec.fixed, ...node.props }
  if (spec.name === 'Icon') props.name = node.props?.name
  const content = spec.takes === 'text' || spec.takes === 'both' ? node.content : undefined
  // createElement with an explicit child list: void elements (Input, Separator…) must get NO children prop.
  const children = [content, ...(spec.takes === 'children' || spec.takes === 'both' ? kids : [])].filter((c) => c !== undefined && c !== '')
  return (
    <NodeBoundary name={spec.name}>
      {createElement(
        Comp,
        {
          ...props,
          // Radix reads defaultValue / defaultChecked once, at mount. While the answer streams in, a node can
          // mount before its props arrive, so remount whenever the props change.
          key: JSON.stringify(props),
          'data-node-id': node.id,
          className: cn(node.classes, ringClass, 'node-in'),
          ...handlers,
        },
        ...children,
      )}
    </NodeBoundary>
  )
}
