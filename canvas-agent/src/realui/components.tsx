import { Component, createElement, useEffect, type ElementType, type ReactElement, type ReactNode } from 'react'
import * as Lucide from 'lucide-react'
import * as HeroUI from '@heroui/react'
import * as Mui from '@mui/material'
import * as Antd from 'antd'
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
import { googleFontsHref } from '../language'
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

const H = HeroUI as unknown as Record<string, ElementType>
/** HeroUI's catalog names ARE its real export names, so the map is a plain lookup. */
const HEROUI_NAMES = [
  'Button', 'Chip', 'Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter', 'Alert', 'AlertIndicator',
  'AlertContent', 'AlertTitle', 'AlertDescription', 'Avatar', 'AvatarFallback', 'ProgressBar', 'ProgressBarTrack', 'ProgressBarFill',
  'Switch', 'SwitchControl', 'SwitchThumb', 'SwitchContent', 'Checkbox', 'CheckboxControl', 'CheckboxIndicator', 'CheckboxContent',
  'Input', 'Label', 'Separator', 'Skeleton', 'Spinner', 'Kbd', 'Link', 'Tabs', 'TabListContainer', 'TabList', 'Tab', 'TabIndicator',
  'TabPanel', 'Accordion', 'AccordionItem', 'AccordionHeading', 'AccordionTrigger', 'AccordionIndicator', 'AccordionPanel',
  'AccordionBody', 'Table', 'TableScrollContainer', 'TableContent', 'TableHeader', 'TableColumn', 'TableBody', 'TableRow', 'TableCell',
] as const
const HEROUI_MAP: Record<string, ElementType> = { ...Object.fromEntries(HEROUI_NAMES.map((n) => [n, H[n]])), Icon }

const M = Mui as unknown as Record<string, ElementType>
const MUI_NAMES = [
  'Button', 'IconButton', 'Chip', 'Avatar', 'Typography', 'Paper', 'Card', 'CardHeader', 'CardContent', 'CardActions', 'Alert', 'AlertTitle',
  'LinearProgress', 'CircularProgress', 'Switch', 'Checkbox', 'TextField', 'Divider', 'Skeleton', 'Tabs', 'Tab', 'Accordion',
  'AccordionSummary', 'AccordionDetails', 'TableContainer', 'Table', 'TableHead', 'TableBody', 'TableRow', 'TableCell',
] as const
const MUI_MAP: Record<string, ElementType> = { ...Object.fromEntries(MUI_NAMES.map((n) => [n, M[n]])), Icon }

const A = Antd as unknown as Record<string, ElementType & Record<string, ElementType>>
/** Ant Design's catalog names are its real dotted names (Typography.Title), so each maps to the real sub-component. */
const ANTD_NAMES = [
  'Button', 'Tag', 'Badge', 'Card', 'Statistic', 'Alert', 'Progress', 'Switch', 'Checkbox', 'Input', 'Select', 'Segmented', 'Divider',
  'Avatar', 'Skeleton', 'Rate', 'Tabs', 'Collapse', 'Table', 'Steps', 'Breadcrumb',
] as const
const ANTD_MAP: Record<string, ElementType> = {
  ...Object.fromEntries(ANTD_NAMES.map((n) => [n, A[n]])),
  'Input.TextArea': A.Input?.TextArea,
  'Typography.Title': A.Typography?.Title,
  'Typography.Text': A.Typography?.Text,
  'Typography.Paragraph': A.Typography?.Paragraph,
  Icon,
}

const MAPS: Record<LibraryId, Record<string, ElementType>> = { shadcn: SHADCN_MAP, relume: RELUME_MAP, heroui: HEROUI_MAP, mui: MUI_MAP, antd: ANTD_MAP }

/* ------------------------------------------------------------------ *
 *  Providers: libraries that theme through JavaScript, not CSS variables
 * ------------------------------------------------------------------ */

const muiTheme = Mui.createTheme() // the real default Material theme

function useFonts(families: string[]) {
  useEffect(() => {
    const href = googleFontsHref(families.map((family) => ({ role: 'body', family, weights: [300, 400, 500, 700] })))
    if (!href || document.querySelector(`link[href="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [families])
}

const ROBOTO = ['Roboto']

/** Wraps a real-library design in whatever theme provider the library needs. */
export function RealLibraryProvider({ library, children }: { library: LibraryId | null; children: ReactNode }) {
  useFonts(library === 'mui' ? ROBOTO : [])
  if (library === 'mui') return <Mui.ThemeProvider theme={muiTheme}>{children}</Mui.ThemeProvider>
  if (library === 'antd') return <Antd.ConfigProvider>{children}</Antd.ConfigProvider>
  return <>{children}</>
}

/** Names the catalog promises but the render map lacks (checked by tests). */
export function missingRenderers(id: LibraryId): string[] {
  return Object.keys(MAPS[id]).filter((k) => !MAPS[id][k])
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
  const Comp = spec ? MAPS[ctx.library][spec.name] : undefined
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
