/* ================================================================== *
 *  Real component libraries — the catalog (pure data, no React).
 *
 *  A "real library" is a set of actual React components (shadcn/ui,
 *  Relume UI, …) that the model may place on the canvas by name. The
 *  catalog says, per component: which props and values exist, whether it
 *  takes text or child components, what it must be nested inside, and
 *  where a developer imports it from. It drives four things:
 *    1. the system prompt (what the model may use)
 *    2. validation (unknown components / props / nesting are corrected)
 *    3. code export (real imports + install command)
 *    4. the renderer (see components.tsx for the name → component map)
 *  Keep it free of React and "@/" imports so Node tests can load it.
 * ================================================================== */

import { ICON_POOL } from '../iconNames'

export type LibraryId = 'shadcn' | 'relume' | 'heroui' | 'mui' | 'antd'

/** One row of a records prop: flat, with plain values only (Ant Design's `items`, `columns`, `dataSource`). */
export type PropRecord = Record<string, string | number | boolean>
export type PropValue = string | number | boolean | PropRecord[]

export interface PropSpec {
  kind: 'enum' | 'string' | 'number' | 'boolean' | 'records'
  values?: readonly string[]
  /** records only: the fields of one row, shown to the model. */
  shape?: string
}

export interface ComponentSpec {
  name: string
  /** text: string content only · children: child nodes only · both: text, then children · none: void */
  takes: 'text' | 'children' | 'both' | 'none'
  props?: Record<string, PropSpec>
  /** Always applied (e.g. Accordion needs type="single"). Also exported. */
  fixed?: Record<string, PropValue>
  /** The nearest of these must be an ancestor, or the component would throw. */
  requires?: readonly string[]
  doc: string
  /** Import path a developer uses. */
  module: string
  /** The name to import when it differs from `name` (Ant Design's Typography.Title imports Typography). */
  importName?: string
  /** shadcn registry item, for `npx shadcn add <item>`. */
  installName?: string
  /** React Aria components need an id: when the model gives none, the node's own id is used. */
  autoId?: boolean
}

export interface LibrarySpec {
  id: LibraryId
  label: string
  /** Class on the artboard root: applies the library's theme, and only inside the artboard. */
  scopeClass: string
  /** Default frameClasses when the model gives none. */
  frameClasses: string
  /** How the model should color and space layout nodes around the components. */
  layoutGuide: string
  /** A short worked example (JSON nodes) that shows the pattern: components inside layout, theme classes for color. */
  example: string
  components: ComponentSpec[]
  /** Comment lines shown at the top of exported code. */
  setupNotes(used: ComponentSpec[]): string[]
}

const e = (...values: string[]): PropSpec => ({ kind: 'enum', values })
const str: PropSpec = { kind: 'string' }
const num: PropSpec = { kind: 'number' }
const bool: PropSpec = { kind: 'boolean' }
const rows = (shape: string): PropSpec => ({ kind: 'records', shape })

/** Icons (lucide-react) the model may place. The render map must contain every name. */
export const ICON_NAMES = ICON_POOL

const ICON: ComponentSpec = {
  name: 'Icon',
  takes: 'none',
  props: { name: e(...ICON_NAMES) },
  doc: 'A lucide icon. Size it with classes (size-4, size-5, size-6). Place it as the LAST child of a Button, or on its own in a layout node.',
  module: 'lucide-react',
}

/* ------------------------------ shadcn/ui ------------------------------ */

const sh = (name: string, file: string, spec: Omit<ComponentSpec, 'name' | 'module' | 'installName'>): ComponentSpec => ({
  name,
  module: `@/components/ui/${file}`,
  installName: file,
  ...spec,
})

export const SHADCN: LibrarySpec = {
  id: 'shadcn',
  label: 'shadcn/ui',
  scopeClass: 'shadcn-scope dark',
  frameClasses: 'bg-background text-foreground',
  layoutGuide:
    'Color layout nodes ONLY with shadcn semantic classes: bg-{background,card,muted,primary,secondary,accent,destructive} (add /10../90 for tints, e.g. bg-primary/10), text-{foreground,muted-foreground,primary,primary-foreground,destructive}, border-border. Never use palette colors (slate-900, blue-500…): they are REMOVED and the design loses its look. The theme is already dark; a dark brief needs no extra color. Radius and font come from the theme.',
  example: `{ "id": "kpis", "type": "grid", "label": "KPIs", "classes": "grid grid-cols-3 gap-6 px-10 py-12", "children": [
  { "id": "k1", "type": "component", "component": "Card", "label": "Revenue card", "children": [
    { "id": "k1h", "type": "component", "component": "CardHeader", "label": "Header", "children": [
      { "id": "k1d", "type": "component", "component": "CardDescription", "label": "Label", "content": "Total revenue" },
      { "id": "k1t", "type": "component", "component": "CardTitle", "label": "Value", "content": "$45,231", "classes": "text-3xl" } ] },
    { "id": "k1c", "type": "component", "component": "CardContent", "label": "Body", "children": [
      { "id": "k1b", "type": "component", "component": "Badge", "label": "Change", "props": { "variant": "secondary" }, "content": "+20.1%" },
      { "id": "k1p", "type": "component", "component": "Progress", "label": "Goal", "props": { "value": 72 }, "classes": "w-full" } ] } ] } ] }`,
  components: [
    sh('Button', 'button', {
      takes: 'both',
      props: { variant: e('default', 'secondary', 'destructive', 'outline', 'ghost', 'link'), size: e('default', 'sm', 'lg', 'icon') },
      doc: 'Every clickable action. Text content, optionally followed by an Icon child.',
    }),
    sh('Badge', 'badge', { takes: 'both', props: { variant: e('default', 'secondary', 'destructive', 'outline') }, doc: 'Small status or category label.' }),
    sh('Card', 'card', { takes: 'children', doc: 'A bordered surface. Build it from CardHeader, CardContent and CardFooter. Add layout classes (w-full, flex, flex-col) as needed.' }),
    sh('CardHeader', 'card', { takes: 'children', requires: ['Card'], doc: 'Top of a Card: holds CardTitle and CardDescription.' }),
    sh('CardTitle', 'card', { takes: 'text', requires: ['CardHeader'], doc: 'Card heading (text).' }),
    sh('CardDescription', 'card', { takes: 'text', requires: ['CardHeader'], doc: 'Muted line under the title (text).' }),
    sh('CardContent', 'card', { takes: 'children', requires: ['Card'], doc: 'Card body. Put layout nodes, text, inputs, tables here.' }),
    sh('CardFooter', 'card', { takes: 'children', requires: ['Card'], doc: 'Card footer, usually holds Buttons.' }),
    sh('Input', 'input', { takes: 'none', props: { type: e('text', 'email', 'password', 'number', 'search'), placeholder: str }, doc: 'Single-line text field.' }),
    sh('Textarea', 'textarea', { takes: 'none', props: { placeholder: str }, doc: 'Multi-line text field.' }),
    sh('Label', 'label', { takes: 'text', doc: 'Form field label (text).' }),
    sh('Separator', 'separator', { takes: 'none', props: { orientation: e('horizontal', 'vertical') }, doc: 'A hairline divider. For a vertical one add h-6 or similar.' }),
    sh('Avatar', 'avatar', { takes: 'children', doc: 'Round user picture. Give it one AvatarFallback child with initials. Size it with size-8, size-10…' }),
    sh('AvatarFallback', 'avatar', { takes: 'text', requires: ['Avatar'], doc: 'Initials shown in an Avatar (text, 1–2 letters).' }),
    sh('Tabs', 'tabs', { takes: 'children', props: { defaultValue: str }, doc: 'Tabbed view. defaultValue must equal one TabsTrigger value. Children: one TabsList, then TabsContent per tab.' }),
    sh('TabsList', 'tabs', { takes: 'children', requires: ['Tabs'], doc: 'Row of TabsTrigger.' }),
    sh('TabsTrigger', 'tabs', { takes: 'text', props: { value: str }, requires: ['TabsList'], doc: 'One tab button (text). value must be unique within the Tabs.' }),
    sh('TabsContent', 'tabs', { takes: 'children', props: { value: str }, requires: ['Tabs'], doc: 'Panel for the tab with the same value.' }),
    sh('Switch', 'switch', { takes: 'none', props: { defaultChecked: bool }, doc: 'On/off toggle.' }),
    sh('Checkbox', 'checkbox', { takes: 'none', props: { defaultChecked: bool }, doc: 'Checkbox.' }),
    sh('Progress', 'progress', { takes: 'none', props: { value: num }, doc: 'Progress bar, value 0–100. Set a width (w-full, w-1/2…).' }),
    sh('Alert', 'alert', { takes: 'children', props: { variant: e('default', 'destructive') }, doc: 'A callout. Children: AlertTitle then AlertDescription.' }),
    sh('AlertTitle', 'alert', { takes: 'text', requires: ['Alert'], doc: 'Alert heading (text).' }),
    sh('AlertDescription', 'alert', { takes: 'text', requires: ['Alert'], doc: 'Alert body (text).' }),
    sh('Table', 'table', { takes: 'children', doc: 'A data table. Children: TableHeader, TableBody. Use for lists, invoices, rankings.' }),
    sh('TableHeader', 'table', { takes: 'children', requires: ['Table'], doc: 'Holds one TableRow of TableHead.' }),
    sh('TableBody', 'table', { takes: 'children', requires: ['Table'], doc: 'Holds TableRow items.' }),
    sh('TableRow', 'table', { takes: 'children', requires: ['Table'], doc: 'A row of TableHead or TableCell.' }),
    sh('TableHead', 'table', { takes: 'text', requires: ['TableRow'], doc: 'Column heading (text).' }),
    sh('TableCell', 'table', { takes: 'both', requires: ['TableRow'], doc: 'A cell: text, or a Badge/Button child.' }),
    sh('Skeleton', 'skeleton', { takes: 'none', doc: 'A grey loading placeholder. Set size with h-4 w-1/2 etc.' }),
    sh('Accordion', 'accordion', { takes: 'children', props: { defaultValue: str }, fixed: { type: 'single', collapsible: true }, doc: 'Collapsible list (FAQ). Children: AccordionItem.' }),
    sh('AccordionItem', 'accordion', { takes: 'children', props: { value: str }, requires: ['Accordion'], doc: 'One entry. value must be unique. Children: AccordionTrigger, AccordionContent.' }),
    sh('AccordionTrigger', 'accordion', { takes: 'text', requires: ['AccordionItem'], doc: 'The question line (text).' }),
    sh('AccordionContent', 'accordion', { takes: 'text', requires: ['AccordionItem'], doc: 'The answer (text).' }),
    ICON,
  ],
  setupNotes(used) {
    const items = [...new Set(used.map((c) => c.installName).filter((n): n is string => !!n))]
    return [
      'Built with the real shadcn/ui components (new-york style).',
      items.length ? `Add them:  npx shadcn@latest add ${items.join(' ')}` : '',
      'This design uses the dark theme: put className="dark" on an ancestor to match it.',
      used.some((c) => c.name === 'Icon') ? 'Icons need:  npm i lucide-react' : '',
    ].filter(Boolean)
  },
}

/* ---------------------------- Relume UI (npm) ---------------------------- */

const rl = (name: string, spec: Omit<ComponentSpec, 'name' | 'module'>): ComponentSpec => ({ name, module: '@relume_io/relume-ui', ...spec })

export const RELUME: LibrarySpec = {
  id: 'relume',
  label: 'Relume',
  scopeClass: 'relume-scope',
  frameClasses: 'bg-background-primary text-text-primary',
  layoutGuide:
    'Color layout nodes ONLY with Relume role classes: bg-background-{primary,secondary,tertiary,alternative,success,error}, text-text-{primary,secondary,alternative,success,error}, border-border-{primary,secondary,tertiary,alternative,success,error}. Relume is a light, black-and-white system: alternate sections between bg-background-primary (white) and bg-background-secondary (light grey); use bg-background-alternative (black) with text-text-alternative for one contrast band. Never use palette colors (slate-900, blue-500…). Relume typography scale: text-{xs,sm,base,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,8xl,9xl,10xl}. Sections use px-[5%] horizontal padding and py-16, py-24 or py-28 vertical padding; keep inner content at max-w-xxl (1280px) or narrower (max-w-lg, max-w-md). Corners are square: do not add rounded-* except on avatars and pills. Palette colors (zinc-900, emerald-400, blue gradients…) are REMOVED and the design loses its look. For a DARK brief, do not invent a dark palette: make sections bg-background-alternative (black) with text-text-alternative and border-border-alternative, and use Button variant secondary-alt on them. Relume UI has no Card, Alert, Avatar or Progress: build a card from a layout node with border border-border-primary and p-6, and put the real Badge, Button and Table inside.',
  example: `{ "id": "holdings", "type": "container", "label": "Holdings", "classes": "flex flex-col gap-6 px-[5%] py-16 bg-background-alternative text-text-alternative", "children": [
  { "id": "hh", "type": "text", "label": "Heading", "classes": "text-5xl font-bold", "content": "Top holdings" },
  { "id": "hb", "type": "container", "label": "Actions", "classes": "flex flex-row gap-4", "children": [
    { "id": "hb1", "type": "component", "component": "Button", "label": "Export", "props": { "variant": "secondary-alt" }, "content": "Export" },
    { "id": "hb2", "type": "component", "component": "Badge", "label": "Status", "props": { "variant": "success" }, "content": "Live" } ] },
  { "id": "ht", "type": "component", "component": "Table", "label": "Holdings table", "classes": "w-full text-text-alternative", "children": [
    { "id": "th", "type": "component", "component": "TableHeader", "label": "Head", "children": [
      { "id": "thr", "type": "component", "component": "TableRow", "label": "Head row", "classes": "border-border-alternative", "children": [
        { "id": "th1", "type": "component", "component": "TableHead", "label": "Asset", "content": "Asset" },
        { "id": "th2", "type": "component", "component": "TableHead", "label": "24h", "content": "24h change" } ] } ] },
    { "id": "tb", "type": "component", "component": "TableBody", "label": "Body", "children": [
      { "id": "tr1", "type": "component", "component": "TableRow", "label": "Row", "classes": "border-border-alternative", "children": [
        { "id": "tc1", "type": "component", "component": "TableCell", "label": "Asset", "content": "Bitcoin" },
        { "id": "tc2", "type": "component", "component": "TableCell", "label": "Change", "children": [
          { "id": "tc2b", "type": "component", "component": "Badge", "label": "Up", "props": { "variant": "success" }, "content": "+5.3%" } ] } ] } ] } ] } ] }`,
  components: [
    rl('Button', {
      takes: 'both',
      props: { variant: e('primary', 'secondary', 'secondary-alt', 'tertiary', 'link', 'link-alt', 'ghost'), size: e('primary', 'sm', 'link', 'icon') },
      doc: 'Every clickable action. primary = solid black, secondary = outlined, secondary-alt = outlined on dark, link = text link, ghost = quiet. Text content, optionally followed by an Icon child.',
    }),
    rl('Badge', { takes: 'text', props: { variant: e('default', 'secondary', 'outline', 'success') }, doc: 'Small tag or label (text).' }),
    rl('Input', { takes: 'none', props: { type: e('text', 'email', 'password', 'number', 'search'), placeholder: str }, doc: 'Single-line text field.' }),
    rl('Textarea', { takes: 'none', props: { placeholder: str }, doc: 'Multi-line text field.' }),
    rl('Label', { takes: 'text', doc: 'Form field label (text).' }),
    rl('Checkbox', { takes: 'none', props: { defaultChecked: bool }, doc: 'Checkbox.' }),
    rl('Switch', { takes: 'none', props: { defaultChecked: bool }, doc: 'On/off toggle.' }),
    rl('Separator', { takes: 'none', props: { orientation: e('horizontal', 'vertical') }, doc: 'A hairline divider.' }),
    rl('Skeleton', { takes: 'none', doc: 'A grey loading placeholder. Set size with h-4 w-1/2 etc.' }),
    rl('Tabs', { takes: 'children', props: { defaultValue: str }, doc: 'Tabbed view. defaultValue must equal one TabsTrigger value. Children: one TabsList, then TabsContent per tab.' }),
    rl('TabsList', { takes: 'children', requires: ['Tabs'], doc: 'Row of TabsTrigger.' }),
    rl('TabsTrigger', { takes: 'text', props: { value: str }, requires: ['TabsList'], doc: 'One tab button (text). value must be unique within the Tabs.' }),
    rl('TabsContent', { takes: 'children', props: { value: str }, requires: ['Tabs'], doc: 'Panel for the tab with the same value.' }),
    rl('Accordion', { takes: 'children', props: { defaultValue: str }, fixed: { type: 'single', collapsible: true }, doc: 'Collapsible list (FAQ). Children: AccordionItem.' }),
    rl('AccordionItem', { takes: 'children', props: { value: str }, requires: ['Accordion'], doc: 'One entry. value must be unique. Children: AccordionTrigger, AccordionContent.' }),
    rl('AccordionTrigger', { takes: 'text', requires: ['AccordionItem'], doc: 'The question line (text).' }),
    rl('AccordionContent', { takes: 'text', requires: ['AccordionItem'], doc: 'The answer (text).' }),
    rl('Table', { takes: 'children', doc: 'A data table. Children: TableHeader, TableBody.' }),
    rl('TableHeader', { takes: 'children', requires: ['Table'], doc: 'Holds one TableRow of TableHead.' }),
    rl('TableBody', { takes: 'children', requires: ['Table'], doc: 'Holds TableRow items.' }),
    rl('TableRow', { takes: 'children', requires: ['Table'], doc: 'A row of TableHead or TableCell.' }),
    rl('TableHead', { takes: 'text', requires: ['TableRow'], doc: 'Column heading (text).' }),
    rl('TableCell', { takes: 'both', requires: ['TableRow'], doc: 'A cell: text, or a Badge/Button child.' }),
    { ...ICON },
  ],
  setupNotes(used) {
    return [
      'Built with the real Relume UI components (@relume_io/relume-ui).',
      'Install:  npm i @relume_io/relume-ui @relume_io/relume-tailwind',
      'Add to tailwind.config:  presets: [require("@relume_io/relume-tailwind")], content: ["./node_modules/@relume_io/relume-ui/dist/**/*.{js,ts,jsx,tsx}"]',
      used.some((c) => c.name === 'Icon') ? 'Icons need:  npm i lucide-react' : '',
    ].filter(Boolean)
  },
}


/* ------------------------------ HeroUI v3 (MIT) ------------------------------ */

const hu = (name: string, spec: Omit<ComponentSpec, 'name' | 'module'>): ComponentSpec => ({ name, module: '@heroui/react', ...spec })
const id: PropSpec = str

export const HEROUI: LibrarySpec = {
  id: 'heroui',
  label: 'HeroUI',
  scopeClass: 'heroui-scope dark',
  frameClasses: 'bg-background text-foreground',
  layoutGuide:
    'Color layout nodes ONLY with HeroUI classes: bg-{background,surface,surface-secondary,surface-tertiary,default,accent,success,warning,danger} (add /10../90 for tints, e.g. bg-accent/10), text-{foreground,muted,accent,success,warning,danger}, border-border, border-separator. HeroUI is soft and rounded: use rounded-2xl on big blocks and rounded-xl on small ones. Palette colors (zinc-900, blue-500, gradients) are REMOVED. The theme is dark; a dark brief needs no extra color.',
  example: `{ "id": "kpis", "type": "grid", "label": "KPIs", "classes": "grid grid-cols-3 gap-6 px-10 py-12", "children": [
  { "id": "k1", "type": "component", "component": "Card", "label": "Revenue card", "children": [
    { "id": "k1h", "type": "component", "component": "CardHeader", "label": "Header", "children": [
      { "id": "k1d", "type": "component", "component": "CardDescription", "label": "Label", "content": "Total revenue" },
      { "id": "k1t", "type": "component", "component": "CardTitle", "label": "Value", "content": "$45,231", "classes": "text-3xl" } ] },
    { "id": "k1c", "type": "component", "component": "CardContent", "label": "Body", "children": [
      { "id": "k1b", "type": "component", "component": "Chip", "label": "Change", "props": { "color": "success", "variant": "soft" }, "content": "+20.1%" },
      { "id": "k1p", "type": "component", "component": "ProgressBar", "label": "Goal", "props": { "value": 72 }, "classes": "w-full", "children": [
        { "id": "k1pt", "type": "component", "component": "ProgressBarTrack", "label": "Track", "children": [
          { "id": "k1pf", "type": "component", "component": "ProgressBarFill", "label": "Fill" } ] } ] } ] } ] },
  { "id": "k2", "type": "component", "component": "Tabs", "label": "Views", "children": [
    { "id": "k2l", "type": "component", "component": "TabListContainer", "label": "Tab bar", "children": [
      { "id": "k2ll", "type": "component", "component": "TabList", "label": "Tabs", "children": [
        { "id": "k2a", "type": "component", "component": "Tab", "label": "Overview", "props": { "id": "overview" }, "content": "Overview", "children": [
          { "id": "k2ai", "type": "component", "component": "TabIndicator", "label": "Indicator" } ] },
        { "id": "k2b", "type": "component", "component": "Tab", "label": "Billing", "props": { "id": "billing" }, "content": "Billing", "children": [
          { "id": "k2bi", "type": "component", "component": "TabIndicator", "label": "Indicator" } ] } ] } ] },
    { "id": "k2p", "type": "component", "component": "TabPanel", "label": "Panel", "props": { "id": "overview" }, "children": [
      { "id": "k2t", "type": "text", "label": "Copy", "classes": "text-sm text-muted", "content": "Usage grew across every region this month." } ] } ] } ] }`,
  components: [
    hu('Button', { takes: 'both', props: { variant: e('primary', 'secondary', 'tertiary', 'outline', 'ghost', 'danger', 'danger-soft'), size: e('sm', 'md', 'lg'), fullWidth: bool }, doc: 'Every clickable action. Text content, optionally followed by an Icon child.' }),
    hu('Chip', { takes: 'text', props: { color: e('default', 'accent', 'success', 'warning', 'danger'), variant: e('primary', 'secondary', 'soft', 'tertiary'), size: e('sm', 'md', 'lg') }, doc: 'Small status or category label (text).' }),
    hu('Card', { takes: 'children', props: { variant: e('default', 'secondary', 'tertiary', 'transparent') }, doc: 'A surface. Build it from CardHeader, CardContent and CardFooter. Add layout classes (w-full, flex, flex-col) as needed.' }),
    hu('CardHeader', { takes: 'children', requires: ['Card'], doc: 'Top of a Card: holds CardTitle and CardDescription.' }),
    hu('CardTitle', { takes: 'text', requires: ['CardHeader'], doc: 'Card heading (text).' }),
    hu('CardDescription', { takes: 'text', requires: ['CardHeader'], doc: 'Muted line under the title (text).' }),
    hu('CardContent', { takes: 'children', requires: ['Card'], doc: 'Card body. Put layout nodes, text, chips, progress bars here.' }),
    hu('CardFooter', { takes: 'children', requires: ['Card'], doc: 'Card footer, usually holds Buttons.' }),
    hu('Alert', { takes: 'children', props: { status: e('default', 'accent', 'success', 'warning', 'danger') }, doc: 'A callout. Children: AlertIndicator, then AlertContent (AlertTitle + AlertDescription).' }),
    hu('AlertIndicator', { takes: 'none', requires: ['Alert'], doc: 'The status icon of an Alert (drawn automatically).' }),
    hu('AlertContent', { takes: 'children', requires: ['Alert'], doc: 'Holds AlertTitle and AlertDescription.' }),
    hu('AlertTitle', { takes: 'text', requires: ['AlertContent'], doc: 'Alert heading (text).' }),
    hu('AlertDescription', { takes: 'text', requires: ['AlertContent'], doc: 'Alert body (text).' }),
    hu('Avatar', { takes: 'children', props: { size: e('sm', 'md', 'lg'), color: e('default', 'accent', 'success', 'warning', 'danger') }, doc: 'Round user picture. Give it one AvatarFallback child with initials.' }),
    hu('AvatarFallback', { takes: 'text', requires: ['Avatar'], doc: 'Initials shown in an Avatar (text, 1–2 letters).' }),
    hu('ProgressBar', { takes: 'children', props: { value: num }, fixed: { 'aria-label': 'Progress' }, doc: 'Progress bar, value 0–100. Children: one ProgressBarTrack. Set a width (w-full…).' }),
    hu('ProgressBarTrack', { takes: 'children', requires: ['ProgressBar'], doc: 'The track of a ProgressBar. Holds one ProgressBarFill.' }),
    hu('ProgressBarFill', { takes: 'none', requires: ['ProgressBarTrack'], doc: 'The filled part of a ProgressBar.' }),
    hu('Switch', { takes: 'children', props: { defaultSelected: bool }, fixed: { 'aria-label': 'Toggle' }, doc: 'On/off toggle. Children: SwitchControl (with SwitchThumb), then optional SwitchContent (label text).' }),
    hu('SwitchControl', { takes: 'children', requires: ['Switch'], doc: 'The track. Holds one SwitchThumb.' }),
    hu('SwitchThumb', { takes: 'none', requires: ['SwitchControl'], doc: 'The knob.' }),
    hu('SwitchContent', { takes: 'text', requires: ['Switch'], doc: 'Label text next to the switch.' }),
    hu('Checkbox', { takes: 'children', props: { defaultSelected: bool }, fixed: { 'aria-label': 'Option' }, doc: 'Checkbox. Children: CheckboxControl (with CheckboxIndicator), then optional CheckboxContent (label text).' }),
    hu('CheckboxControl', { takes: 'children', requires: ['Checkbox'], doc: 'The box. Holds one CheckboxIndicator.' }),
    hu('CheckboxIndicator', { takes: 'none', requires: ['CheckboxControl'], doc: 'The check mark.' }),
    hu('CheckboxContent', { takes: 'text', requires: ['Checkbox'], doc: 'Label text next to the box.' }),
    hu('Input', { takes: 'none', props: { type: e('text', 'email', 'password', 'number', 'search'), placeholder: str }, fixed: { 'aria-label': 'Input' }, doc: 'Single-line text field.' }),
    hu('Label', { takes: 'text', doc: 'Form field label (text).' }),
    hu('Separator', { takes: 'none', props: { orientation: e('horizontal', 'vertical') }, doc: 'A hairline divider. For a vertical one add h-6 or similar.' }),
    hu('Skeleton', { takes: 'none', doc: 'A shimmering loading placeholder. Set size with h-4 w-1/2 etc.' }),
    hu('Spinner', { takes: 'none', doc: 'A loading spinner.' }),
    hu('Kbd', { takes: 'text', doc: 'A keyboard key hint, e.g. ⌘K (text).' }),
    hu('Link', { takes: 'text', props: { href: str }, doc: 'A text link.' }),
    hu('Tabs', { takes: 'children', props: { defaultSelectedKey: str }, doc: 'Tabbed view. Children: one TabListContainer (holding a TabList of Tab) then one TabPanel per Tab. defaultSelectedKey must equal a Tab id.' }),
    hu('TabListContainer', { takes: 'children', requires: ['Tabs'], doc: 'Wraps the TabList.' }),
    hu('TabList', { takes: 'children', requires: ['TabListContainer'], fixed: { 'aria-label': 'Views' }, doc: 'The row of Tab.' }),
    hu('Tab', { takes: 'both', props: { id }, autoId: true, requires: ['TabList'], doc: 'One tab (text). id must be unique in the Tabs and match its TabPanel. Optional last child: TabIndicator.' }),
    hu('TabIndicator', { takes: 'none', requires: ['Tab'], doc: 'The sliding selection mark inside a Tab.' }),
    hu('TabPanel', { takes: 'children', props: { id }, autoId: true, requires: ['Tabs'], doc: 'Panel for the Tab with the same id.' }),
    hu('Accordion', { takes: 'children', doc: 'Collapsible list (FAQ). Children: AccordionItem.' }),
    hu('AccordionItem', { takes: 'children', props: { id }, autoId: true, requires: ['Accordion'], doc: 'One entry. id must be unique. Children: AccordionHeading (with AccordionTrigger), then AccordionPanel (with AccordionBody).' }),
    hu('AccordionHeading', { takes: 'children', requires: ['AccordionItem'], doc: 'Wraps the AccordionTrigger.' }),
    hu('AccordionTrigger', { takes: 'both', requires: ['AccordionHeading'], doc: 'The question line (text). Optional last child: AccordionIndicator.' }),
    hu('AccordionIndicator', { takes: 'none', requires: ['AccordionTrigger'], doc: 'The chevron.' }),
    hu('AccordionPanel', { takes: 'children', requires: ['AccordionItem'], doc: 'Wraps the AccordionBody.' }),
    hu('AccordionBody', { takes: 'both', requires: ['AccordionPanel'], doc: 'The answer (text).' }),
    hu('Table', { takes: 'children', doc: 'A data table. Children: one TableScrollContainer › TableContent › TableHeader + TableBody.' }),
    hu('TableScrollContainer', { takes: 'children', requires: ['Table'], doc: 'Scroll wrapper. Holds one TableContent.' }),
    hu('TableContent', { takes: 'children', requires: ['TableScrollContainer'], fixed: { 'aria-label': 'Table' }, doc: 'The table element. Holds TableHeader and TableBody.' }),
    hu('TableHeader', { takes: 'children', requires: ['TableContent'], doc: 'Holds TableColumn items (no row).' }),
    hu('TableColumn', { takes: 'text', props: { id, isRowHeader: bool }, autoId: true, requires: ['TableHeader'], doc: 'A column heading (text). Set isRowHeader true on the first column.' }),
    hu('TableBody', { takes: 'children', requires: ['TableContent'], doc: 'Holds TableRow items.' }),
    hu('TableRow', { takes: 'children', props: { id }, autoId: true, requires: ['TableBody'], doc: 'A row of TableCell (one per column, in order).' }),
    hu('TableCell', { takes: 'both', requires: ['TableRow'], doc: 'A cell: text, or a Chip/Button child.' }),
    { ...ICON },
  ],
  setupNotes(used) {
    return [
      'Built with the real HeroUI v3 components (@heroui/react, MIT).',
      'Install:  npm i @heroui/react @heroui/styles   (needs React 19 and Tailwind CSS 4)',
      'In your main CSS:  @import "tailwindcss";  @import "@heroui/styles";',
      'This design uses the dark theme: put className="dark" on an ancestor to match it.',
      used.some((c) => c.name === 'Icon') ? 'Icons need:  npm i lucide-react' : '',
    ].filter(Boolean)
  },
}


/* ------------------------------ Material UI (MIT) ------------------------------ */

const mu = (name: string, spec: Omit<ComponentSpec, 'name' | 'module'>): ComponentSpec => ({ name, module: '@mui/material', ...spec })
const MUI_COLORS = ['primary', 'secondary', 'success', 'error', 'info', 'warning'] as const

export const MUI: LibrarySpec = {
  id: 'mui',
  label: 'Material UI',
  scopeClass: 'mui-scope',
  frameClasses: 'bg-background text-foreground',
  layoutGuide:
    'Color layout nodes ONLY with these semantic classes: bg-{background,card,muted,primary,secondary,destructive}, text-{foreground,muted-foreground,primary,secondary,destructive}, border-border. Material is LIGHT by default: white page (bg-background), light grey bands (bg-muted), Paper/Card surfaces. Use the primary blue sparingly for actions. Elevation comes from Paper/Card, not from shadow classes. Type is Roboto. Palette colors (slate-900, blue-500, gradients) are REMOVED.',
  example: `{ "id": "kpis", "type": "grid", "label": "KPIs", "classes": "grid grid-cols-3 gap-6 px-10 py-12", "children": [
  { "id": "k1", "type": "component", "component": "Card", "label": "Revenue card", "children": [
    { "id": "k1h", "type": "component", "component": "CardHeader", "label": "Header", "props": { "title": "Total revenue", "subheader": "Last 30 days" } },
    { "id": "k1c", "type": "component", "component": "CardContent", "label": "Body", "classes": "flex flex-col gap-3", "children": [
      { "id": "k1v", "type": "component", "component": "Typography", "label": "Value", "props": { "variant": "h4" }, "content": "$45,231" },
      { "id": "k1b", "type": "component", "component": "Chip", "label": "Change", "props": { "label": "+20.1%", "color": "success", "size": "small" } },
      { "id": "k1p", "type": "component", "component": "LinearProgress", "label": "Goal", "props": { "variant": "determinate", "value": 72 } } ] },
    { "id": "k1a", "type": "component", "component": "CardActions", "label": "Actions", "children": [
      { "id": "k1btn", "type": "component", "component": "Button", "label": "Details", "props": { "size": "small" }, "content": "View details" } ] } ] },
  { "id": "k2", "type": "container", "label": "Views", "classes": "flex flex-col gap-4", "children": [
    { "id": "k2t", "type": "component", "component": "Tabs", "label": "Tabs", "props": { "value": "overview" }, "children": [
      { "id": "k2a", "type": "component", "component": "Tab", "label": "Overview", "props": { "label": "Overview", "value": "overview" } },
      { "id": "k2b", "type": "component", "component": "Tab", "label": "Billing", "props": { "label": "Billing", "value": "billing" } } ] },
    { "id": "k2x", "type": "component", "component": "Typography", "label": "Copy", "props": { "variant": "body2", "color": "text.secondary" }, "content": "Usage grew across every region this month." } ] } ] }`,
  components: [
    mu('Button', { takes: 'both', props: { variant: e('text', 'outlined', 'contained'), color: e('inherit', ...MUI_COLORS), size: e('small', 'medium', 'large'), fullWidth: bool }, doc: 'Every clickable action. Text content, optionally followed by an Icon child. contained = solid, outlined = border, text = plain.' }),
    mu('IconButton', { takes: 'children', props: { color: e('default', ...MUI_COLORS), size: e('small', 'medium', 'large') }, doc: 'A round button that holds one Icon child.' }),
    mu('Chip', { takes: 'none', props: { label: str, color: e('default', ...MUI_COLORS), variant: e('filled', 'outlined'), size: e('small', 'medium') }, doc: 'Small status or category label. The text goes in the label prop.' }),
    mu('Avatar', { takes: 'text', props: { variant: e('circular', 'rounded', 'square') }, doc: 'User picture with initials as text (1–2 letters).' }),
    mu('Typography', { takes: 'text', props: { variant: e('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'subtitle1', 'subtitle2', 'body1', 'body2', 'caption', 'overline'), color: e('text.primary', 'text.secondary', ...MUI_COLORS), align: e('left', 'center', 'right'), gutterBottom: bool }, doc: 'Material type. Use for headings and paragraphs so the type scale is real (h4 = 34px, body1 = 16px…).' }),
    mu('Paper', { takes: 'children', props: { elevation: num, variant: e('elevation', 'outlined'), square: bool }, doc: 'A raised surface. elevation 0–24 (1 = subtle, 8 = floating). Add layout classes (p-6, flex, flex-col, gap-4).' }),
    mu('Card', { takes: 'children', props: { variant: e('elevation', 'outlined') }, doc: 'A card surface. Build it from CardHeader, CardContent and CardActions.' }),
    mu('CardHeader', { takes: 'none', props: { title: str, subheader: str }, requires: ['Card'], doc: 'Top of a Card. Title and subheader are props, not children.' }),
    mu('CardContent', { takes: 'children', requires: ['Card'], doc: 'Card body. Put Typography, chips, progress here.' }),
    mu('CardActions', { takes: 'children', requires: ['Card'], doc: 'Card footer that holds Buttons.' }),
    mu('Alert', { takes: 'both', props: { severity: e('error', 'warning', 'info', 'success'), variant: e('standard', 'filled', 'outlined') }, doc: 'A callout. Text content, optionally preceded by an AlertTitle child.' }),
    mu('AlertTitle', { takes: 'text', requires: ['Alert'], doc: 'Alert heading (text). Put it before the message.' }),
    mu('LinearProgress', { takes: 'none', props: { variant: e('determinate', 'indeterminate'), value: num, color: e(...MUI_COLORS) }, doc: 'Progress bar, value 0–100 for determinate.' }),
    mu('CircularProgress', { takes: 'none', props: { variant: e('determinate', 'indeterminate'), value: num, color: e(...MUI_COLORS) }, doc: 'Round progress spinner.' }),
    mu('Switch', { takes: 'none', props: { defaultChecked: bool, color: e(...MUI_COLORS), size: e('small', 'medium') }, doc: 'On/off toggle. Put a Typography label next to it in a layout node.' }),
    mu('Checkbox', { takes: 'none', props: { defaultChecked: bool, color: e(...MUI_COLORS) }, doc: 'Checkbox. Put a Typography label next to it.' }),
    mu('TextField', { takes: 'none', props: { label: str, placeholder: str, helperText: str, defaultValue: str, variant: e('outlined', 'filled', 'standard'), size: e('small', 'medium'), type: e('text', 'email', 'password', 'number', 'search'), fullWidth: bool }, doc: 'A labelled text field (label floats above the value).' }),
    mu('Divider', { takes: 'none', props: { orientation: e('horizontal', 'vertical'), variant: e('fullWidth', 'inset', 'middle') }, doc: 'A hairline divider.' }),
    mu('Skeleton', { takes: 'none', props: { variant: e('text', 'rectangular', 'rounded', 'circular'), animation: e('pulse', 'wave') }, doc: 'A loading placeholder. Set size with h-8 w-1/2 etc.' }),
    mu('Tabs', { takes: 'children', props: { value: str, variant: e('standard', 'scrollable', 'fullWidth'), centered: bool, textColor: e('primary', 'secondary', 'inherit') }, doc: 'Tab bar. value is the selected Tab value. Children: Tab items. Put the tab content in a layout node below.' }),
    mu('Tab', { takes: 'none', props: { label: str, value: str }, requires: ['Tabs'], doc: 'One tab. label is the text, value must be unique in the Tabs.' }),
    mu('Accordion', { takes: 'children', props: { defaultExpanded: bool }, doc: 'Collapsible entry (FAQ). Children: AccordionSummary, then AccordionDetails.' }),
    mu('AccordionSummary', { takes: 'text', requires: ['Accordion'], doc: 'The question line (text).' }),
    mu('AccordionDetails', { takes: 'both', requires: ['Accordion'], doc: 'The answer (text).' }),
    mu('TableContainer', { takes: 'children', doc: 'Scroll wrapper. Holds one Table.' }),
    mu('Table', { takes: 'children', props: { size: e('small', 'medium') }, doc: 'A data table. Children: TableHead, TableBody.' }),
    mu('TableHead', { takes: 'children', requires: ['Table'], doc: 'Holds one TableRow of TableCell.' }),
    mu('TableBody', { takes: 'children', requires: ['Table'], doc: 'Holds TableRow items.' }),
    mu('TableRow', { takes: 'children', requires: ['Table'], doc: 'A row of TableCell.' }),
    mu('TableCell', { takes: 'both', props: { align: e('left', 'right', 'center') }, requires: ['TableRow'], doc: 'A cell: text, or a Chip child. Cells in TableHead are headings.' }),
    { ...ICON },
  ],
  setupNotes(used) {
    return [
      'Built with the real Material UI components (@mui/material, MIT core).',
      'Install:  npm i @mui/material @emotion/react @emotion/styled',
      'Wrap your app:  <ThemeProvider theme={createTheme()}> … </ThemeProvider>   (import both from "@mui/material")',
      'Type is Roboto:  add the Roboto font (Google Fonts) to your page.',
      used.some((c) => c.name === 'Icon') ? 'Icons need:  npm i lucide-react' : '',
    ].filter(Boolean)
  },
}

/* ------------------------------ Ant Design (MIT) ------------------------------ */

const an = (name: string, spec: Omit<ComponentSpec, 'name' | 'module'>): ComponentSpec => ({ name, module: 'antd', ...spec })
const ANT_TAG_COLORS = ['default', 'success', 'processing', 'error', 'warning', 'blue', 'green', 'red', 'orange', 'gold', 'purple', 'cyan', 'magenta', 'volcano'] as const
const ANT_SIZE = ['small', 'middle', 'large'] as const

export const ANTD: LibrarySpec = {
  id: 'antd',
  label: 'Ant Design',
  scopeClass: 'antd-scope',
  frameClasses: 'bg-background text-foreground',
  layoutGuide:
    'Color layout nodes ONLY with these semantic classes: bg-{background,card,muted,primary,accent,destructive}, text-{foreground,muted-foreground,primary,destructive}, border-border. Ant Design is LIGHT and dense: white surfaces (bg-card), a light grey page or band (bg-muted), 16px/24px spacing (gap-4, gap-6, p-6), 6px corners. Blue (bg-primary) is for the one main action. Palette colors (slate-900, blue-500, gradients) are REMOVED.',
  example: `{ "id": "kpis", "type": "grid", "label": "KPIs", "classes": "grid grid-cols-3 gap-6 px-10 py-10", "children": [
  { "id": "k1", "type": "component", "component": "Card", "label": "Revenue card", "children": [
    { "id": "k1s", "type": "component", "component": "Statistic", "label": "Revenue", "props": { "title": "Total revenue", "value": "45,231", "prefix": "$" } },
    { "id": "k1t", "type": "component", "component": "Tag", "label": "Change", "props": { "color": "success" }, "content": "+20.1%" },
    { "id": "k1p", "type": "component", "component": "Progress", "label": "Goal", "props": { "percent": 72 } } ] },
  { "id": "k2", "type": "container", "label": "Views", "classes": "flex flex-col gap-4 col-span-2", "children": [
    { "id": "k2t", "type": "component", "component": "Tabs", "label": "Tabs", "props": { "defaultActiveKey": "orders", "items": [
      { "key": "orders", "label": "Orders", "children": "Every order placed this month." },
      { "key": "returns", "label": "Returns", "children": "Refunds and exchanges." } ] } },
    { "id": "k2x", "type": "component", "component": "Table", "label": "Orders", "props": { "size": "small",
      "columns": [ { "title": "Order", "dataIndex": "order", "key": "order" }, { "title": "Status", "dataIndex": "status", "key": "status" } ],
      "dataSource": [ { "key": "1", "order": "#1024", "status": "Shipped" }, { "key": "2", "order": "#1025", "status": "Packing" } ] } } ] } ] }`,
  components: [
    an('Button', { takes: 'both', props: { type: e('default', 'primary', 'dashed', 'text', 'link'), danger: bool, size: e(...ANT_SIZE), block: bool, ghost: bool, shape: e('default', 'circle', 'round') }, doc: 'Every clickable action. Text content, optionally followed by an Icon child. type "primary" is the one main action per area.' }),
    an('Tag', { takes: 'text', props: { color: e(...ANT_TAG_COLORS), variant: e('filled', 'solid', 'outlined') }, doc: 'Small status or category label. Text content. success / processing / warning / error for statuses.' }),
    an('Badge', { takes: 'none', props: { status: e('success', 'processing', 'default', 'error', 'warning'), text: str }, doc: 'A status dot with a label (text prop), for lists and tables.' }),
    an('Card', { takes: 'children', props: { title: str, size: e('medium', 'small'), variant: e('outlined', 'borderless') }, doc: 'A bordered surface with an optional title bar. Put Statistic, Typography, Tag, Progress inside.' }),
    an('Statistic', { takes: 'none', props: { title: str, value: str, prefix: str, suffix: str }, doc: 'A big number with a caption. value is a string such as "1,280" or "99.99".' }),
    an('Alert', { takes: 'none', props: { type: e('success', 'info', 'warning', 'error'), title: str, description: str, showIcon: bool, variant: e('outlined', 'filled') }, doc: 'A callout with an optional description. Set showIcon true.' }),
    an('Progress', { takes: 'none', props: { percent: num, type: e('line', 'circle', 'dashboard'), status: e('normal', 'exception', 'active', 'success'), size: e('small', 'medium') }, doc: 'Progress bar or ring, percent 0–100.' }),
    an('Switch', { takes: 'none', props: { defaultChecked: bool, size: e('small', 'medium') }, doc: 'On/off toggle. Put a Typography.Text label next to it in a layout node.' }),
    an('Checkbox', { takes: 'text', props: { defaultChecked: bool }, doc: 'Checkbox with its label as the text content.' }),
    an('Input', { takes: 'none', props: { placeholder: str, defaultValue: str, size: e(...ANT_SIZE), variant: e('outlined', 'filled', 'borderless', 'underlined') }, doc: 'Single-line text field.' }),
    an('Input.TextArea', { importName: 'Input', takes: 'none', props: { placeholder: str, defaultValue: str, rows: num }, doc: 'Multi-line text field.' }),
    an('Select', { takes: 'none', props: { placeholder: str, defaultValue: str, options: rows('{value,label}'), size: e(...ANT_SIZE), variant: e('outlined', 'filled', 'borderless', 'underlined') }, doc: 'A dropdown. options is a list of { value, label }. Give it a width class such as w-48.' }),
    an('Segmented', { takes: 'none', props: { options: rows('{value,label}'), defaultValue: str, block: bool }, doc: 'A pill switcher between a few views. options is a list of { value, label }.' }),
    an('Divider', { takes: 'none', props: { orientation: e('horizontal', 'vertical'), variant: e('solid', 'dashed', 'dotted') }, doc: 'A hairline divider.' }),
    an('Avatar', { takes: 'text', props: { shape: e('circle', 'square'), size: num }, doc: 'User picture with initials as text (1–2 letters). size in px, default 32.' }),
    an('Skeleton', { takes: 'none', props: { active: bool, avatar: bool }, doc: 'A loading placeholder for a text block.' }),
    an('Rate', { takes: 'none', props: { defaultValue: num }, doc: 'Star rating 0–5.' }),
    an('Typography.Title', { importName: 'Typography', takes: 'text', props: { level: num }, doc: 'A heading. level 1–5 (1 is the largest). Use it instead of a text node for headings.' }),
    an('Typography.Text', { importName: 'Typography', takes: 'text', props: { type: e('secondary', 'success', 'warning', 'danger'), strong: bool }, doc: 'Inline text. secondary is the muted grey.' }),
    an('Typography.Paragraph', { importName: 'Typography', takes: 'text', props: { type: e('secondary', 'success', 'warning', 'danger') }, doc: 'A paragraph of body text.' }),
    an('Tabs', { takes: 'none', props: { items: rows('{key,label,children}'), defaultActiveKey: str, type: e('line', 'card'), size: e('small', 'middle', 'large') }, doc: 'Tabs. items is a list of { key, label, children } where children is the panel TEXT. defaultActiveKey is one of the keys.' }),
    an('Collapse', { takes: 'none', props: { items: rows('{key,label,children}'), defaultActiveKey: str, ghost: bool }, doc: 'Accordion / FAQ. items is a list of { key, label, children } where children is the answer text.' }),
    an('Table', { takes: 'none', props: { columns: rows('{title,dataIndex,key}'), dataSource: rows('{key,<one field per column>}'), size: e('small', 'middle', 'large'), bordered: bool }, fixed: { pagination: false }, doc: 'A data table. columns lists { title, dataIndex, key }; dataSource lists rows { key, <dataIndex>: text }. Cells are plain text or numbers.' }),
    an('Steps', { takes: 'none', props: { items: rows('{title,content}'), current: num, size: e('small', 'medium') }, doc: 'A progress-through-steps indicator. current is the 0-based active step.' }),
    an('Breadcrumb', { takes: 'none', props: { items: rows('{title}') }, doc: 'A path trail. items is a list of { title }.' }),
    { ...ICON },
  ],
  setupNotes(used) {
    return [
      'Built with the real Ant Design components (antd, MIT).',
      'Install:  npm i antd',
      'Ant Design themes itself. For the default look you need nothing else; for custom colors wrap your app in <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}> (import it from "antd").',
      used.some((c) => c.name === 'Icon') ? 'Icons need:  npm i lucide-react' : '',
    ].filter(Boolean)
  },
}

export const LIBRARIES: Record<LibraryId, LibrarySpec> = { shadcn: SHADCN, heroui: HEROUI, mui: MUI, antd: ANTD, relume: RELUME }

/**
 * FREE ONLY. Every import path a catalog component may use, with its licence.
 * A component whose `module` is not listed here fails the catalog test, so a
 * paid or unlicensed package cannot slip in unnoticed. Add an entry only after
 * checking the licence (see THIRD_PARTY.md).
 */
export const FREE_MODULES: Record<string, string> = {
  '@/components/ui/': 'MIT — shadcn/ui source, copied into this project',
  'lucide-react': 'ISC',
  '@heroui/react': 'MIT — HeroUI open-source components (never HeroUI Pro)',
  '@mui/material': 'MIT — Material UI core (never the paid MUI X packages)',
  antd: 'MIT — Ant Design (pro packages such as ProComponents are not used)',
  '@relume_io/relume-ui':
    'No licence declared. Free per Relume\'s free-components page, which tells you to install it. Base primitives only: never the paid section library.',
}

/** The licence note for a module path, or null when the module is not on the free list. */
export function freeLicense(module: string): string | null {
  const key = Object.keys(FREE_MODULES).find((k) => (k.endsWith('/') ? module.startsWith(k) : module === k))
  return key ? FREE_MODULES[key] : null
}

export function getLibrary(id: LibraryId | null | undefined): LibrarySpec | null {
  return id ? (LIBRARIES[id] ?? null) : null
}

export function componentSpec(id: LibraryId, name: string | undefined): ComponentSpec | null {
  return getLibrary(id)?.components.find((c) => c.name === name) ?? null
}

/** The catalog as text for the system prompt. */
export function catalogText(lib: LibrarySpec): string {
  return lib.components
    .map((c) => {
      const props = Object.entries(c.props ?? {})
        .map(([k, p]) => `${k}: ${p.kind === 'enum' ? p.values!.join('|') : p.kind === 'records' ? `list of ${p.shape}` : p.kind}`)
        .join('; ')
      const takes = { text: 'text content', children: 'child nodes', both: 'text content, then optional child nodes', none: 'no content, no children' }[c.takes]
      const needs = c.requires ? ` Must be inside ${c.requires.join(' or ')}.` : ''
      return `- ${c.name} — ${takes}${props ? `. props { ${props} }` : ''}.${needs} ${c.doc}`
    })
    .join('\n')
}

/** The extra system-prompt section that switches the model into real-component mode. */
export function libraryPrompt(lib: LibrarySpec): string {
  return `REAL COMPONENT MODE — ${lib.label}
This design is built from the REAL ${lib.label} React components, rendered by the actual library (not imitations). A developer will receive it as real JSX with real imports.

Extra node type. In addition to container / grid / text / image, a node may be:
{
  "id": "<unique-kebab-case-string>",
  "type": "component",
  "component": "<a name from the CATALOG below>",
  "label": "<short human name>",
  "props": { "<prop>": "<value>" },       // only props and values listed in the CATALOG
  "content": "<string>",                   // only if the component takes text
  "classes": "<layout classes from the ALLOWED VOCABULARY>",
  "children": [CanvasNode, ...]            // only if the component takes child nodes
}

RULES FOR THIS MODE (they override the general rules where they differ):
- Use "component" nodes for EVERYTHING that a component covers: every button, badge, card, input, tab set, table, alert, avatar, progress bar, switch, checkbox, FAQ. NEVER draw those with container/text/image/button nodes. Do not use the "button" node type at all. A good design has at least 10 component nodes; a design made mostly of container/text/image nodes is WRONG for this mode.
- Pictures are "image" nodes (with art, alt, prompt) and symbols are "icon" nodes: they are NOT library components, so use them freely as the ICONS, IMAGES AND FONTS section says. Never draw progress bars or badges as blocks; use the library components for those. A person's avatar is the Avatar component if the catalog has one, otherwise an image node.
- container / grid nodes are only for layout (flex, grid, gap, padding, width, alignment) and section backgrounds. text nodes are only for headings and paragraphs no component covers.
- ${lib.layoutGuide}
- frameClasses must be "${lib.frameClasses}" (you may add nothing else).
- Respect nesting: a component listed as "Must be inside X" only works inside X. Wrong nesting is removed.
- "classes" on a component adds layout only (width, margin, flex, alignment). Do not restyle components with color classes.
- Use real, specific copy. 25–60 nodes total; maximum nesting depth 10.

EXAMPLE of the pattern (layout node + real components; colors only from theme classes):
${lib.example}

CATALOG (the ONLY components you may use):
${catalogText(lib)}`
}
