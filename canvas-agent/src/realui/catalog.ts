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

export type LibraryId = 'shadcn' | 'relume'

export interface PropSpec {
  kind: 'enum' | 'string' | 'number' | 'boolean'
  values?: readonly string[]
}

export interface ComponentSpec {
  name: string
  /** text: string content only · children: child nodes only · both: text, then children · none: void */
  takes: 'text' | 'children' | 'both' | 'none'
  props?: Record<string, PropSpec>
  /** Always applied (e.g. Accordion needs type="single"). Also exported. */
  fixed?: Record<string, string | number | boolean>
  /** The nearest of these must be an ancestor, or the component would throw. */
  requires?: readonly string[]
  doc: string
  /** Import path a developer uses. */
  module: string
  /** shadcn registry item, for `npx shadcn add <item>`. */
  installName?: string
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

/** Icons (lucide-react) the model may place. The render map must contain every name. */
export const ICON_NAMES = [
  'ArrowRight', 'Check', 'ChevronRight', 'Plus', 'Search', 'Settings', 'Bell', 'User', 'Users', 'Star', 'Zap', 'Mail',
  'Heart', 'Globe', 'Lock', 'Shield', 'Play', 'Download', 'Upload', 'Calendar', 'Clock', 'CreditCard', 'TrendingUp',
  'Code', 'Terminal', 'Rocket', 'Sparkles', 'Layers', 'FileText', 'Menu', 'X', 'Activity', 'Database', 'Cloud', 'Cpu',
  'Key', 'Package',
] as const

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

export const LIBRARIES: Record<LibraryId, LibrarySpec> = { shadcn: SHADCN, relume: RELUME }

/**
 * FREE ONLY. Every import path a catalog component may use, with its licence.
 * A component whose `module` is not listed here fails the catalog test, so a
 * paid or unlicensed package cannot slip in unnoticed. Add an entry only after
 * checking the licence (see THIRD_PARTY.md).
 */
export const FREE_MODULES: Record<string, string> = {
  '@/components/ui/': 'MIT — shadcn/ui source, copied into this project',
  'lucide-react': 'ISC',
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
        .map(([k, p]) => `${k}: ${p.kind === 'enum' ? p.values!.join('|') : p.kind}`)
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
- Do not use "image" nodes except for one chart or photo placeholder; never draw progress bars, badges or avatars as blocks.
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
