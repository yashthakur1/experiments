import type { ComponentDef, DesignSystem, LabNode, SavedStyle, StyleDecl, TypeStyle } from './lab'

/* ================================================================== *
 *  Built-in design systems.
 *
 *  shadcn/ui  — values taken from the official new-york-v4 theme
 *               (dark neutral, OKLCH converted to hex) and its
 *               component classes.
 *  HeroUI     — values taken from the HeroUI v3 source CSS
 *               (themes/default/variables.css + components/*.css).
 *  Halo · Lunaris · Nitro — no public source was found. They are
 *               rebuilt from the reference thumbnails (pixel-sampled
 *               colors, measured radii, visible type). `meta.provenance`
 *               says so in the UI.
 *
 *  All five share ONE component vocabulary and ONE token key set, so
 *  the same page renders in every system and the AI composes the same
 *  way inside any of them. Real library usage lives in `code`.
 * ================================================================== */

const ty = (size: number, weight: number, lineHeight: number | string, letterSpacing = '0'): TypeStyle => ({
  size: `${size}px`,
  weight,
  lineHeight,
  letterSpacing,
})

const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px' }

const comp = (
  name: string,
  role: string,
  description: string,
  preview: string,
  base: StyleDecl,
  variants?: Record<string, StyleDecl>,
  code?: string,
): ComponentDef => ({ name, role, description, preview, base, ...(variants ? { variants } : {}), ...(code ? { code } : {}) })

const tstyle = (key: string, font = '$font.body'): StyleDecl => ({
  fontFamily: font,
  fontSize: `$type.${key}.size`,
  fontWeight: `$type.${key}.weight`,
  lineHeight: `$type.${key}.lineHeight`,
  letterSpacing: `$type.${key}.letterSpacing`,
})

/** Heading / Text / StatValue are identical in structure everywhere; only tokens differ. */
function typography(display = '$font.display'): ComponentDef[] {
  return [
    comp(
      'Heading',
      'Titles and section headings',
      'Three levels (h1, h2, h3) on the display face.',
      'Fleet overview',
      { ...tstyle('h2', display), margin: 0, color: '$color.foreground' },
      { h1: tstyle('h1', display), h3: tstyle('h3', display) },
    ),
    comp(
      'Text',
      'Body copy and supporting text',
      'Body by default. Variants: muted, small, caption, overline.',
      'Your request has been approved.',
      { ...tstyle('body'), margin: 0, color: '$color.foreground' },
      {
        muted: { color: '$color.mutedForeground' },
        small: tstyle('small'),
        caption: { ...tstyle('caption'), color: '$color.mutedForeground' },
        overline: { ...tstyle('overline'), textTransform: 'uppercase', color: '$color.mutedForeground' },
      },
    ),
    comp('StatValue', 'Large key figure', 'One big number per card.', '1,280', {
      ...tstyle('stat', display),
      margin: 0,
      color: '$color.foreground',
    }),
  ]
}

/* ------------------------------------------------------------------ *
 *  Shared page: a "fleet dashboard" (same content as the reference
 *  thumbnails — Mission approved, Active Rovers 1,280, Refresh
 *  automatically) composed only from the component vocabulary.
 * ------------------------------------------------------------------ */

interface PageCfg {
  brand: string
  logo: string
  iconSide: 'left' | 'right'
  alertVariant?: string
  badge: { neutral?: string; up?: string; down?: string }
  button: { secondary?: string; outline?: string; ghost?: string; danger?: string }
  brandStyle?: StyleDecl
  rootStyle?: StyleDecl
}

function fleetPage(cfg: PageCfg): LabNode {
  const n = (id: string, label: string, rest: Partial<LabNode> = {}): LabNode => ({ id, label, element: 'div', ...rest })
  const text = (id: string, label: string, t: string, variant?: string, style?: StyleDecl): LabNode =>
    n(id, label, { component: 'Text', variant, text: t, ...(style ? { style } : {}) })
  const icon = (id: string, glyph: string): LabNode =>
    n(id, 'icon', { text: glyph, style: { width: '16px', textAlign: 'center', opacity: 0.75, flexShrink: 0 } })

  const navItem = (id: string, glyph: string, label: string, active = false): LabNode => {
    const ic = icon(`${id}-icon`, glyph)
    const tx = n(`${id}-label`, `${label} label`, { text: label, style: { flex: cfg.iconSide === 'right' ? 1 : 'initial' } })
    return n(id, label, {
      component: 'NavItem',
      variant: active ? 'active' : undefined,
      element: 'button',
      children: cfg.iconSide === 'left' ? [ic, tx] : [tx, ic],
    })
  }

  const stat = (id: string, label: string, value: string, delta: string, kind: 'up' | 'down' | 'neutral'): LabNode =>
    n(id, `${label} card`, {
      component: 'Card',
      children: [
        n(`${id}-head`, 'card header', { component: 'CardHeader', children: [text(`${id}-label`, 'stat label', label, 'overline')] }),
        n(`${id}-body`, 'card content', {
          component: 'CardContent',
          style: { gap: '$space.sm' },
          children: [
            n(`${id}-value`, 'stat value', { component: 'StatValue', text: value }),
            n(`${id}-delta`, 'delta', { component: 'Badge', variant: cfg.badge[kind], text: delta }),
          ],
        }),
      ],
    })

  const row = (id: string, cells: [string, string, LabNode | string, string], head = false): LabNode =>
    n(id, head ? 'table head' : 'table row', {
      component: 'TableRow',
      variant: head ? 'head' : undefined,
      style: { gridTemplateColumns: '1.4fr 1fr 1fr 0.6fr' },
      children: cells.map((cell, i) =>
        typeof cell === 'string' ? n(`${id}-c${i}`, 'cell', { text: cell }) : cell,
      ),
    })

  const status = (id: string, t: string, kind: 'up' | 'down' | 'neutral'): LabNode =>
    n(id, 'status', { component: 'Badge', variant: cfg.badge[kind], text: t })

  const tab = (id: string, t: string, active = false): LabNode =>
    n(id, t, { component: 'Tab', variant: active ? 'active' : undefined, element: 'button', text: t })

  const btn = (id: string, t: string, variant?: string): LabNode =>
    n(id, `${t} button`, { component: 'Button', variant, element: 'button', text: t })

  return n('page', `${cfg.brand} fleet dashboard`, {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      minHeight: '780px',
      background: '$color.background',
      color: '$color.foreground',
      fontFamily: '$font.body',
      fontSize: '$type.body.size',
      lineHeight: '$type.body.lineHeight',
      ...cfg.rootStyle,
    },
    children: [
      n('sidebar', 'sidebar', {
        component: 'Sidebar',
        children: [
          n('brand', 'brand', {
            style: { display: 'flex', alignItems: 'center', gap: '$space.sm', padding: '$space.sm $space.sm $space.md' },
            children: [
              n('brand-mark', 'logo', { component: 'LogoMark', text: cfg.logo }),
              n('brand-name', 'brand name', {
                component: 'Heading',
                variant: 'h3',
                text: cfg.brand,
                ...(cfg.brandStyle ? { style: cfg.brandStyle } : {}),
              }),
            ],
          }),
          n('nav-ops-label', 'group label', { component: 'NavLabel', text: 'Operations' }),
          navItem('nav-dashboard', '▦', 'Dashboard', true),
          navItem('nav-missions', '◎', 'Missions'),
          navItem('nav-fleet', '▥', 'Fleet status'),
          n('nav-mgmt-label', 'group label', { component: 'NavLabel', text: 'Management', style: { marginTop: '$space.md' } }),
          navItem('nav-rentals', '▣', 'Rentals'),
          navItem('nav-billing', '▤', 'Billing'),
          navItem('nav-settings', '✦', 'Settings'),
        ],
      }),
      n('main', 'main', {
        style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '$space.lg', padding: '$space.xl' },
        children: [
          n('topbar', 'top bar', {
            style: { display: 'flex', alignItems: 'center', gap: '$space.md' },
            children: [
              n('search', 'search', { component: 'Input', style: { flex: 1 }, text: `⌕  Search ${cfg.brand}…` }),
              n('avatar', 'avatar', { component: 'Avatar', text: 'KM' }),
            ],
          }),
          n('alert', 'alert', {
            component: 'Alert',
            variant: cfg.alertVariant,
            children: [
              n('alert-icon', 'icon', { text: '✓', style: { fontWeight: 700, lineHeight: '$type.body.lineHeight' } }),
              n('alert-body', 'alert body', {
                style: { display: 'flex', flexDirection: 'column', gap: '$space.xs' },
                children: [
                  n('alert-title', 'alert title', { component: 'AlertTitle', text: 'Mission approved' }),
                  n('alert-desc', 'alert description', {
                    component: 'AlertDescription',
                    text: 'Your request to rent the Curiosity-X rover has been approved.',
                  }),
                ],
              }),
            ],
          }),
          n('stats', 'stat grid', {
            style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '$space.md' },
            children: [
              stat('stat-rovers', 'Active rovers', '1,280', '-12%', 'down'),
              stat('stat-missions', 'Missions completed', '342', '+8%', 'up'),
              stat('stat-uptime', 'Fleet uptime', '99.2%', '+0.4%', 'up'),
            ],
          }),
          n('log', 'mission log', {
            component: 'Card',
            children: [
              n('log-head', 'log header', {
                component: 'CardHeader',
                style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                children: [
                  n('log-titles', 'titles', {
                    style: { display: 'flex', flexDirection: 'column', gap: '$space.xs' },
                    children: [
                      n('log-title', 'title', { component: 'Heading', variant: 'h3', text: 'Recent missions' }),
                      text('log-sub', 'subtitle', 'Live telemetry across the fleet', 'muted'),
                    ],
                  }),
                  n('refresh', 'refresh switch', {
                    style: { display: 'flex', alignItems: 'center', gap: '$space.sm' },
                    children: [
                      n('switch', 'switch', {
                        component: 'Switch',
                        variant: 'checked',
                        children: [n('switch-thumb', 'thumb', { component: 'SwitchThumb', variant: 'checked' })],
                      }),
                      text('refresh-label', 'switch label', 'Refresh automatically', 'small'),
                    ],
                  }),
                ],
              }),
              n('log-body', 'log content', {
                component: 'CardContent',
                style: { gap: '$space.md' },
                children: [
                  n('tabs', 'tabs', {
                    component: 'Tabs',
                    children: [tab('tab-all', 'All', true), tab('tab-active', 'Active'), tab('tab-done', 'Completed')],
                  }),
                  n('table', 'table', {
                    style: { display: 'flex', flexDirection: 'column' },
                    children: [
                      row('row-head', ['Mission', 'Rover', 'Status', 'Launch'], true),
                      row('row-1', ['Olympus survey', 'Curiosity-X', status('row-1-s', 'Approved', 'up'), 'Sep 24']),
                      row('row-2', ['Gale crater run', 'Perseverance-2', status('row-2-s', 'Pending', 'neutral'), 'Oct 02']),
                      row('row-3', ['Valles transit', 'Opportunity-R', status('row-3-s', 'Delayed', 'down'), 'Oct 11']),
                    ],
                  }),
                  n('actions', 'actions', {
                    style: { display: 'flex', flexWrap: 'wrap', gap: '$space.sm' },
                    children: [
                      btn('btn-request', 'Request rover'),
                      btn('btn-view', 'View missions', cfg.button.outline),
                      btn('btn-secondary', 'Export log', cfg.button.secondary),
                      btn('btn-ghost', 'Details', cfg.button.ghost),
                      btn('btn-cancel', 'Cancel mission', cfg.button.danger),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

/* ================================================================== *
 *  1 · shadcn/ui  (new-york-v4, dark, neutral)
 * ================================================================== */

const shadcn: DesignSystem = {
  name: 'shadcn/ui',
  philosophy:
    'Components you own. Neutral surfaces carry the layout, one hairline separates layers, and color appears only when it means something.',
  experienceNotes: [
    'Neutral first: zinc-like surfaces, color only for meaning (destructive, focus).',
    'Separate layers with a 1px border, not with heavy shadows.',
    'Controls are 36px high by default so every row aligns.',
    'Focus shows a 3px soft ring around the control. Never remove it.',
    'Keep variants few: default, secondary, outline, ghost, destructive, link.',
  ],
  meta: {
    tagline: 'shadcn/ui component kit',
    stack: 'React · Tailwind v4 · Radix UI · CVA',
    install: 'npx shadcn@latest init',
    docs: 'https://ui.shadcn.com/docs',
    backdrop: 'linear-gradient(135deg,#f4f5f6 0%,#e4e7ea 100%)',
    provenance: 'Official new-york-v4 dark theme: OKLCH values converted to hex; radius scale 0.625rem × (0.6, 0.8, 1, 1.4). Real shadcn/ui components are installed in this app.',
    library: 'shadcn',
  },
  tokens: {
    color: {
      background: '#0a0a0a',
      card: '#171717',
      primary: '#e5e5e5',
      foreground: '#fafafa',
      sidebar: '#171717',
      muted: '#262626',
      mutedForeground: '#a1a1a1',
      border: 'rgba(255,255,255,0.10)',
      input: 'rgba(255,255,255,0.15)',
      primaryForeground: '#171717',
      secondary: '#262626',
      secondaryForeground: '#fafafa',
      accent: '#262626',
      destructive: '#dc2626',
      destructiveText: '#ff6467',
      success: '#22c55e',
      successSoft: '#171717',
      successText: '#fafafa',
      successBorder: 'rgba(255,255,255,0.10)',
      ring: '#737373',
    },
    font: {
      display: "Geist, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      body: "Geist, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    type: {
      h1: ty(36, 800, 1.1, '-0.025em'),
      h2: ty(24, 600, 1.33, '-0.02em'),
      h3: ty(16, 600, 1, '0'),
      body: ty(14, 400, 1.5),
      small: ty(14, 500, 1),
      caption: ty(12, 400, 1.33),
      overline: ty(12, 500, 1.33, '0.02em'),
      stat: ty(28, 600, 1.15, '-0.02em'),
    },
    space: SPACE,
    radius: { sm: '6px', md: '8px', lg: '10px', xl: '14px', full: '9999px' },
    shadow: {
      none: 'none',
      xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      ring: '0 0 0 3px rgba(115,115,115,0.5)',
    },
  },
  components: [
    ...typography(),
    comp(
      'Button',
      'Primary interactive action',
      'h-9, radius md, text-sm medium. Variants match buttonVariants: secondary, outline, ghost, destructive, link.',
      'Request rover',
      {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '$space.sm', height: '36px', padding: '0 $space.md',
        borderRadius: '$radius.md', border: '1px solid transparent', background: '$color.primary', color: '$color.primaryForeground',
        ...tstyle('small'), lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '$shadow.none',
      },
      {
        secondary: { background: '$color.secondary', color: '$color.secondaryForeground' },
        outline: { background: 'rgba(255,255,255,0.05)', border: '1px solid $color.input', color: '$color.foreground', boxShadow: '$shadow.xs' },
        ghost: { background: 'transparent', color: '$color.foreground' },
        destructive: { background: 'rgba(220,38,38,0.6)', color: '#ffffff' },
        link: { background: 'transparent', color: '$color.foreground', textDecoration: 'underline', textUnderlineOffset: '4px' },
        sm: { height: '32px', padding: '0 12px' },
        lg: { height: '40px', padding: '0 24px' },
      },
      `import { Button } from "@/components/ui/button"\n\n<Button>Request rover</Button>\n<Button variant="outline">View missions</Button>\n<Button variant="secondary">Export log</Button>\n<Button variant="ghost">Details</Button>\n<Button variant="destructive">Cancel mission</Button>`,
    ),
    comp(
      'Card',
      'Surface that groups related content',
      'rounded-xl border, py-6, gap-6, shadow-sm. Header and content own the horizontal padding.',
      'Card surface',
      {
        display: 'flex', flexDirection: 'column', gap: '$space.lg', padding: '$space.lg 0', background: '$color.card', color: '$color.foreground',
        border: '1px solid $color.border', borderRadius: '$radius.xl', boxShadow: '$shadow.sm',
      },
      undefined,
      `import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"\n\n<Card>\n  <CardHeader>\n    <CardTitle>Active rovers</CardTitle>\n    <CardDescription>Across the fleet</CardDescription>\n  </CardHeader>\n  <CardContent>1,280</CardContent>\n</Card>`,
    ),
    comp('CardHeader', 'Card title area', 'px-6, small gap between title and description.', 'Header', {
      display: 'flex', flexDirection: 'column', gap: '$space.sm', padding: '0 $space.lg',
    }),
    comp('CardContent', 'Card body', 'px-6.', 'Content', { display: 'flex', flexDirection: 'column', gap: '$space.sm', padding: '0 $space.lg' }),
    comp(
      'Input',
      'Single-line text field',
      'h-9, radius md, 1px input border, shadow-xs; dark fill is input/30.',
      '⌕  Search…',
      {
        display: 'flex', alignItems: 'center', height: '36px', padding: '4px 12px', borderRadius: '$radius.md', border: '1px solid $color.input',
        background: 'rgba(255,255,255,0.05)', color: '$color.mutedForeground', ...tstyle('body'), lineHeight: 1.4, boxShadow: '$shadow.xs',
      },
      undefined,
      `import { Input } from "@/components/ui/input"\n\n<Input type="search" placeholder="Search Acme…" />`,
    ),
    comp(
      'Badge',
      'Small status label',
      'Radius md, px-2 py-0.5, text-xs medium. Variants: secondary, outline, destructive.',
      'New',
      {
        display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '2px 8px', borderRadius: '$radius.md', border: '1px solid transparent',
        background: '$color.primary', color: '$color.primaryForeground', ...tstyle('overline'), letterSpacing: '0',
      },
      {
        secondary: { background: '$color.secondary', color: '$color.secondaryForeground' },
        outline: { background: 'transparent', border: '1px solid $color.border', color: '$color.foreground' },
        destructive: { background: '$color.destructive', color: '#ffffff' },
      },
      `import { Badge } from "@/components/ui/badge"\n\n<Badge variant="secondary">+8%</Badge>\n<Badge variant="destructive">-12%</Badge>`,
    ),
    comp(
      'Alert',
      'Inline message',
      'rounded-lg border, px-4 py-3, text-sm. Variants: default, destructive.',
      'Heads up',
      {
        display: 'flex', alignItems: 'flex-start', gap: '$space.md', padding: '12px $space.md', borderRadius: '$radius.lg', border: '1px solid $color.border',
        background: '$color.card', color: '$color.foreground', ...tstyle('body'),
      },
      { destructive: { color: '$color.destructiveText' } },
      `import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"\nimport { CircleCheckIcon } from "lucide-react"\n\n<Alert>\n  <CircleCheckIcon />\n  <AlertTitle>Mission approved</AlertTitle>\n  <AlertDescription>Your request to rent the Curiosity-X rover…</AlertDescription>\n</Alert>`,
    ),
    comp('AlertTitle', 'Alert headline', 'font-medium, one line.', 'Title', { ...tstyle('small'), lineHeight: 1.4, color: 'inherit' }),
    comp('AlertDescription', 'Alert supporting text', 'text-sm, muted.', 'Description', { ...tstyle('body'), color: '$color.mutedForeground' }),
    comp(
      'Switch',
      'On/off toggle (track)',
      'h-[1.15rem] w-8 pill. Unchecked track is input; checked track is primary.',
      '',
      { display: 'flex', alignItems: 'center', width: '32px', height: '18px', padding: '1px', borderRadius: '$radius.full', background: '$color.input', cursor: 'pointer', flexShrink: 0 },
      { checked: { background: '$color.primary', justifyContent: 'flex-end' } },
      `import { Switch } from "@/components/ui/switch"\nimport { Label } from "@/components/ui/label"\n\n<div className="flex items-center gap-2">\n  <Switch id="refresh" defaultChecked />\n  <Label htmlFor="refresh">Refresh automatically</Label>\n</div>`,
    ),
    comp('SwitchThumb', 'Switch knob', 'size-4 circle; checked thumb uses primary-foreground.', '', { width: '16px', height: '16px', borderRadius: '$radius.full', background: '$color.foreground' }, { checked: { background: '$color.primaryForeground' } }),
    comp(
      'Tabs',
      'Segmented tab list',
      'h-9 muted pill list, p-[3px]. Active trigger gets input border and a light fill.',
      'Tabs',
      { display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', height: '36px', padding: '3px', borderRadius: '$radius.lg', background: '$color.muted' },
      undefined,
      `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"\n\n<Tabs defaultValue="all">\n  <TabsList>\n    <TabsTrigger value="all">All</TabsTrigger>\n    <TabsTrigger value="active">Active</TabsTrigger>\n  </TabsList>\n  <TabsContent value="all">…</TabsContent>\n</Tabs>`,
    ),
    comp(
      'Tab',
      'Single tab trigger',
      'px-2 py-1, text-sm medium, radius md.',
      'Overview',
      { display: 'inline-flex', alignItems: 'center', height: '29px', padding: '0 12px', borderRadius: '$radius.md', border: '1px solid transparent', background: 'transparent', color: '$color.mutedForeground', ...tstyle('small'), cursor: 'pointer' },
      { active: { background: 'rgba(255,255,255,0.08)', border: '1px solid $color.input', color: '$color.foreground' } },
    ),
    comp('Sidebar', 'Primary navigation rail', 'w-64, sidebar surface, right border, p-2.', 'Sidebar', {
      display: 'flex', flexDirection: 'column', gap: '$space.xs', width: '256px', flexShrink: 0, padding: '$space.sm', background: '$color.sidebar', borderRight: '1px solid $color.border',
    }),
    comp('NavLabel', 'Sidebar group label', 'text-xs medium, 70% foreground.', 'Operations', { padding: '$space.sm', color: 'rgba(250,250,250,0.7)', ...tstyle('overline'), letterSpacing: '0' }),
    comp(
      'NavItem',
      'Sidebar menu button',
      'h-8, radius md, text-sm. Active gets sidebar-accent and medium weight.',
      'Dashboard',
      { display: 'flex', alignItems: 'center', gap: '$space.sm', height: '32px', padding: '0 $space.sm', borderRadius: '$radius.md', background: 'transparent', color: '$color.foreground', ...tstyle('body'), cursor: 'pointer', textAlign: 'left' },
      { active: { background: '$color.accent', fontWeight: 500 } },
      `<SidebarMenuItem>\n  <SidebarMenuButton isActive asChild>\n    <a href="/"><LayoutDashboard /> <span>Dashboard</span></a>\n  </SidebarMenuButton>\n</SidebarMenuItem>`,
    ),
    comp('LogoMark', 'Brand mark', 'Rounded square, 32px.', '◉', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '$radius.md', background: '$color.primary', color: '$color.primaryForeground', fontSize: '16px',
    }),
    comp(
      'Avatar',
      'User identity',
      'size-8 circle, muted fallback.',
      'KM',
      { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '$radius.full', background: '$color.muted', color: '$color.foreground', ...tstyle('overline'), letterSpacing: '0', flexShrink: 0 },
      undefined,
      `import { Avatar, AvatarFallback } from "@/components/ui/avatar"\n\n<Avatar>\n  <AvatarFallback>KM</AvatarFallback>\n</Avatar>`,
    ),
    comp(
      'TableRow',
      'Table row (grid)',
      'Border-bottom hairline; head variant is muted and medium weight.',
      'Row',
      { display: 'grid', alignItems: 'center', padding: '12px $space.sm', borderBottom: '1px solid $color.border', ...tstyle('body') },
      { head: { color: '$color.mutedForeground', fontWeight: 500 } },
      `import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"\n\n<TableRow>\n  <TableCell>Olympus survey</TableCell>\n  <TableCell>Curiosity-X</TableCell>\n</TableRow>`,
    ),
  ],
  page: fleetPage({
    brand: 'Acme',
    logo: '◉',
    iconSide: 'left',
    badge: { neutral: 'outline', up: 'secondary', down: 'destructive' },
    button: { secondary: 'secondary', outline: 'outline', ghost: 'ghost', danger: 'destructive' },
  }),
}

/* ================================================================== *
 *  2 · HeroUI v3  (dark, default theme)
 * ================================================================== */

const heroui: DesignSystem = {
  name: 'HeroUI',
  philosophy:
    'Soft, rounded and quiet. Surfaces lift one step off a near-black canvas, corners are generous, and a single blue accent marks the primary path.',
  experienceNotes: [
    'Surface, default and accent are the only fills. Borders stay faint.',
    'Corners are large (buttons and tabs 24px, chips 16px). Never mix sharp and soft.',
    'One accent per screen region. Success and danger stay soft (tinted), not solid.',
    'Selected state slides: tabs and switches animate an indicator, not a swap.',
    'Buttons come in seven variants and no color prop: primary, secondary, tertiary, outline, ghost, danger, danger-soft.',
  ],
  meta: {
    tagline: 'HeroUI component kit',
    stack: 'React · Tailwind v4 · React Aria Components',
    install: 'npm i @heroui/react @heroui/styles',
    docs: 'https://heroui.com/docs/react',
    backdrop: 'linear-gradient(120deg,#af7763 0%,#c9a89c 42%,#bdc1c8 100%)',
    provenance: 'HeroUI v3 default dark theme: variables.css (OKLCH → hex) and component CSS (button, chip, alert, switch, tabs).',
  },
  tokens: {
    color: {
      background: '#060607',
      card: '#18181b',
      primary: '#0485f7',
      foreground: '#fafafa',
      sidebar: '#060607',
      muted: '#27272a',
      mutedForeground: '#9f9fa9',
      border: '#28282c',
      input: '#18181b',
      primaryForeground: '#fafafa',
      secondary: '#27272a',
      secondaryForeground: '#4fa8fa',
      accent: '#27272a',
      destructive: '#db3b3e',
      destructiveText: '#f0797b',
      success: '#17c964',
      successSoft: 'rgba(23,201,100,0.14)',
      successText: '#17c964',
      successBorder: 'rgba(23,201,100,0.14)',
      ring: '#0485f7',
    },
    font: {
      display: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      body: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    type: {
      h1: ty(30, 700, 1.2, '-0.02em'),
      h2: ty(22, 600, 1.3, '-0.01em'),
      h3: ty(16, 600, 1.4),
      body: ty(14, 400, 1.5),
      small: ty(14, 500, 1.4),
      caption: ty(12, 400, 1.4),
      overline: ty(12, 500, 1.4, '0.02em'),
      stat: ty(28, 600, 1.15, '-0.01em'),
    },
    space: SPACE,
    radius: { sm: '4px', md: '6px', lg: '8px', xl: '12px', xxl: '16px', full: '24px' },
    shadow: {
      none: 'none',
      sm: '0 0 0 0 transparent inset',
      md: '0 0 1px 0 rgba(255,255,255,0.3) inset',
      lg: '0 8px 20px rgba(4,133,247,0.35)',
    },
  },
  components: [
    ...typography(),
    comp(
      'Button',
      'Primary interactive action',
      'Pill (rounded-3xl), h-10, px-4, text-sm medium. Variants: secondary, tertiary, outline, ghost, danger, danger-soft.',
      'Request rover',
      {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '$space.sm', height: '40px', padding: '0 $space.md',
        borderRadius: '$radius.full', border: '1px solid transparent', background: '$color.primary', color: '$color.primaryForeground',
        ...tstyle('small'), lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer',
      },
      {
        secondary: { background: '$color.secondary', color: '$color.secondaryForeground' },
        tertiary: { background: '$color.secondary', color: '$color.foreground' },
        outline: { background: 'transparent', border: '1px solid $color.border', color: '$color.foreground' },
        ghost: { background: 'transparent', color: '$color.foreground' },
        danger: { background: '$color.destructive', color: '#ffffff' },
        'danger-soft': { background: 'rgba(219,59,62,0.15)', color: '$color.destructiveText' },
        sm: { height: '32px', padding: '0 12px' },
        lg: { height: '44px', fontSize: '16px' },
      },
      `import {Button} from "@heroui/react";\n\n<Button>Request rover</Button>\n<Button variant="secondary">Export log</Button>\n<Button variant="outline">View missions</Button>\n<Button variant="ghost">Details</Button>\n<Button variant="danger">Cancel mission</Button>\n<Button variant="danger-soft">Cancel</Button>`,
    ),
    comp(
      'Card',
      'Surface that groups related content',
      'Surface fill, large radius, no border, no shadow in dark mode. Padding lives in header and content.',
      'Card surface',
      { display: 'flex', flexDirection: 'column', gap: '$space.sm', padding: '$space.sm 0', background: '$color.card', color: '$color.foreground', borderRadius: '$radius.full', boxShadow: '$shadow.sm' },
      undefined,
      `import {Card} from "@heroui/react";\n\n<Card>\n  <Card.Header>\n    <Card.Title>Active rovers</Card.Title>\n    <Card.Description>Across the fleet</Card.Description>\n  </Card.Header>\n  <Card.Content>1,280</Card.Content>\n</Card>`,
    ),
    comp('CardHeader', 'Card title area', 'p-4 top, tight gap.', 'Header', { display: 'flex', flexDirection: 'column', gap: '$space.xs', padding: '$space.sm $space.md 0' }),
    comp('CardContent', 'Card body', 'px-4.', 'Content', { display: 'flex', flexDirection: 'column', gap: '$space.sm', padding: '0 $space.md $space.sm' }),
    comp(
      'Input',
      'Single-line text field',
      'Field fill (surface), radius 12px, h-9, no border, text-sm.',
      '⌕  Search…',
      { display: 'flex', alignItems: 'center', height: '40px', padding: '0 $space.md', borderRadius: '$radius.xl', background: '$color.input', color: '$color.mutedForeground', ...tstyle('body'), lineHeight: 1.4 },
      undefined,
      `import {Input} from "@heroui/react";\n\n<Input placeholder="Search Flux…" />`,
    ),
    comp(
      'Badge',
      'Small status label (HeroUI Chip)',
      'Chip: radius 16px, text-xs. Soft variants tint the fill with the status color.',
      'New',
      { display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '2px 10px', borderRadius: '$radius.xxl', background: '$color.muted', color: '$color.foreground', ...tstyle('overline'), letterSpacing: '0' },
      {
        success: { background: 'rgba(23,201,100,0.14)', color: '$color.success' },
        danger: { background: 'rgba(219,59,62,0.15)', color: '$color.destructiveText' },
        accent: { background: 'rgba(4,133,247,0.14)', color: '$color.secondaryForeground' },
      },
      `import {Chip} from "@heroui/react";\n\n<Chip color="success" variant="soft">\n  <Chip.Label>+8%</Chip.Label>\n</Chip>\n<Chip color="danger" variant="soft">\n  <Chip.Label>-12%</Chip.Label>\n</Chip>`,
    ),
    comp(
      'Alert',
      'Inline message',
      'Surface fill, radius 24px, px-4 py-3, gap-4. Status color goes to icon and title only.',
      'Heads up',
      { display: 'flex', alignItems: 'flex-start', gap: '$space.md', padding: '12px $space.md', borderRadius: '$radius.full', background: '$color.card', color: '$color.foreground', ...tstyle('body') },
      { success: { color: '$color.success' }, danger: { color: '$color.destructiveText' } },
      `import {Alert} from "@heroui/react";\n\n<Alert status="success">\n  <Alert.Indicator />\n  <Alert.Content>\n    <Alert.Title>Mission approved</Alert.Title>\n    <Alert.Description>Your request to rent the Curiosity-X rover…</Alert.Description>\n  </Alert.Content>\n</Alert>`,
    ),
    comp('AlertTitle', 'Alert headline', 'text-sm medium, leading-6; takes the status color.', 'Title', { ...tstyle('small'), lineHeight: 1.5, color: 'inherit' }),
    comp('AlertDescription', 'Alert supporting text', 'text-sm, muted in every status.', 'Description', { ...tstyle('body'), color: '$color.mutedForeground' }),
    comp(
      'Switch',
      'On/off toggle (control)',
      'Control 40×20 pill. Off uses default fill; on uses accent.',
      '',
      { display: 'flex', alignItems: 'center', width: '40px', height: '20px', padding: '2px', borderRadius: '$radius.xl', background: '$color.muted', cursor: 'pointer', flexShrink: 0 },
      { checked: { background: '$color.primary', justifyContent: 'flex-end' } },
      `import {Switch} from "@heroui/react";\n\n<Switch defaultSelected>\n  <Switch.Control>\n    <Switch.Thumb />\n  </Switch.Control>\n  <Switch.Content>Refresh automatically</Switch.Content>\n</Switch>`,
    ),
    comp('SwitchThumb', 'Switch knob', 'Wide pill thumb, 22×16.', '', { width: '22px', height: '16px', borderRadius: '$radius.lg', background: '$color.foreground' }, { checked: { background: '$color.primaryForeground' } }),
    comp(
      'Tabs',
      'Segmented tab list',
      'p-1 pill list on the default fill; the selected tab gets a sliding segment.',
      'Tabs',
      { display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', padding: '4px', borderRadius: '$radius.full', background: '$color.muted' },
      undefined,
      `import {Tabs} from "@heroui/react";\n\n<Tabs>\n  <Tabs.ListContainer>\n    <Tabs.List aria-label="Missions">\n      <Tabs.Tab id="all">All<Tabs.Indicator /></Tabs.Tab>\n      <Tabs.Tab id="active">Active<Tabs.Indicator /></Tabs.Tab>\n    </Tabs.List>\n  </Tabs.ListContainer>\n  <Tabs.Panel id="all">…</Tabs.Panel>\n</Tabs>`,
    ),
    comp(
      'Tab',
      'Single tab',
      'h-8, px-4, radius 24px, text-sm medium, muted until selected.',
      'Overview',
      { display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 $space.md', borderRadius: '$radius.full', background: 'transparent', color: '$color.mutedForeground', ...tstyle('small'), cursor: 'pointer' },
      { active: { background: '#3f3f46', color: '$color.foreground' } },
    ),
    comp('Sidebar', 'Primary navigation rail', 'Canvas-colored rail, p-4, hairline right edge.', 'Sidebar', {
      display: 'flex', flexDirection: 'column', gap: '$space.xs', width: '260px', flexShrink: 0, padding: '$space.md', background: '$color.sidebar', borderRight: '1px solid $color.border',
    }),
    comp('NavLabel', 'Sidebar group label', 'text-xs medium, muted.', 'Operations', { padding: '$space.sm $space.sm 4px', color: '$color.mutedForeground', ...tstyle('overline') }),
    comp(
      'NavItem',
      'Sidebar list item',
      'h-10 rounded row; selected gets the default fill.',
      'Dashboard',
      { display: 'flex', alignItems: 'center', gap: '$space.sm', height: '40px', padding: '0 12px', borderRadius: '$radius.xl', background: 'transparent', color: '$color.mutedForeground', ...tstyle('body'), cursor: 'pointer', textAlign: 'left' },
      { active: { background: '$color.muted', color: '$color.foreground', fontWeight: 500 } },
      `import {ListBox} from "@heroui/react";\n\n<ListBox aria-label="Navigation" selectionMode="single" defaultSelectedKeys={["dashboard"]}>\n  <ListBox.Item id="dashboard">Dashboard</ListBox.Item>\n  <ListBox.Item id="missions">Missions</ListBox.Item>\n</ListBox>`,
    ),
    comp('LogoMark', 'Brand mark', 'Accent circle, 32px.', '◉', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '$radius.full', background: '$color.primary', color: '$color.primaryForeground', fontSize: '16px',
    }),
    comp(
      'Avatar',
      'User identity',
      'Circle, default fill, initials fallback.',
      'KM',
      { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '$radius.full', background: '$color.primary', color: '$color.primaryForeground', ...tstyle('overline'), letterSpacing: '0', flexShrink: 0 },
      undefined,
      `import {Avatar} from "@heroui/react";\n\n<Avatar>\n  <Avatar.Fallback>KM</Avatar.Fallback>\n</Avatar>`,
    ),
    comp(
      'TableRow',
      'Table row (grid)',
      'Separator hairline; head variant is muted.',
      'Row',
      { display: 'grid', alignItems: 'center', padding: '12px $space.sm', borderBottom: '1px solid $color.border', ...tstyle('body') },
      { head: { color: '$color.mutedForeground', fontWeight: 500 } },
      `import {Table} from "@heroui/react";\n\n<Table aria-label="Missions">\n  <Table.Header>…</Table.Header>\n  <Table.Body>…</Table.Body>\n</Table>`,
    ),
  ],
  page: fleetPage({
    brand: 'Orbit',
    logo: '◉',
    iconSide: 'left',
    alertVariant: 'success',
    badge: { neutral: undefined, up: 'success', down: 'danger' },
    button: { secondary: 'secondary', outline: 'outline', ghost: 'ghost', danger: 'danger' },
    rootStyle: { fontSize: '14px' },
  }),
}

/* ================================================================== *
 *  3 · Halo  — luminous dark, floating rails, pill everything
 * ================================================================== */

const halo: DesignSystem = {
  name: 'Halo',
  philosophy:
    'A night interface that glows. Panels float on deep indigo, every control is a pill, and one mint accent says "go".',
  experienceNotes: [
    'Panels float: the sidebar is a rounded island with its own border, not a full-height wall.',
    'Everything interactive is a pill. Cards use large 20px corners.',
    'Mint is the only accent. It marks success, primary action and the current state.',
    'Labels are small uppercase and dim so numbers and titles lead.',
    'Icons sit at the trailing edge of navigation rows.',
  ],
  meta: {
    tagline: 'Halo design system',
    stack: 'React · CSS variables',
    backdrop: 'radial-gradient(120% 90% at 25% 10%,#b7d96a 0%,#63b480 45%,#2f8f6c 100%)',
    provenance: 'No public source found. Rebuilt from the reference thumbnail: pixel-sampled colors, measured radii.',
  },
  tokens: {
    color: {
      background: '#14132a',
      card: '#191830',
      primary: '#9be59a',
      foreground: '#ecebf5',
      sidebar: '#1b1a31',
      muted: '#2b2a42',
      mutedForeground: '#8d8ca8',
      border: 'rgba(255,255,255,0.07)',
      input: '#101024',
      primaryForeground: '#0f2a1b',
      secondary: '#2b2a42',
      secondaryForeground: '#ecebf5',
      accent: '#2b2a42',
      destructive: '#f26d85',
      destructiveText: '#ff9aab',
      success: '#9be59a',
      successSoft: '#37463f',
      successText: '#a9eda3',
      successBorder: '#37463f',
      ring: '#9be59a',
    },
    font: {
      display: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      body: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    type: {
      h1: ty(32, 600, 1.15, '-0.02em'),
      h2: ty(22, 600, 1.25, '-0.01em'),
      h3: ty(15, 700, 1.3, '0.04em'),
      body: ty(14, 400, 1.5),
      small: ty(13, 500, 1.4),
      caption: ty(12, 400, 1.4),
      overline: ty(11, 500, 1.4, '0.06em'),
      stat: ty(32, 400, 1.1, '-0.01em'),
    },
    space: SPACE,
    radius: { sm: '8px', md: '12px', lg: '20px', xl: '28px', full: '9999px' },
    shadow: {
      none: 'none',
      sm: '0 1px 0 rgba(255,255,255,0.04) inset',
      md: '0 12px 32px rgba(6,5,20,0.45)',
      glow: '0 0 24px rgba(155,229,154,0.25)',
    },
  },
  components: [
    ...typography(),
    comp(
      'Button',
      'Primary interactive action',
      'Pill, 40px, mint fill with dark text. Variants: secondary, outline, ghost, destructive.',
      'Request rover',
      {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '$space.sm', height: '40px', padding: '0 20px', borderRadius: '$radius.full',
        border: '1px solid transparent', background: '$color.primary', color: '$color.primaryForeground', ...tstyle('small'), fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer',
      },
      {
        secondary: { background: '$color.secondary', color: '$color.secondaryForeground' },
        outline: { background: 'transparent', border: '1px solid rgba(255,255,255,0.16)', color: '$color.foreground' },
        ghost: { background: 'transparent', color: '$color.mutedForeground' },
        destructive: { background: '$color.destructive', color: '#2a0a12' },
      },
    ),
    comp(
      'Card',
      'Surface that groups related content',
      'Radius 20px, hairline border, inner top highlight. Padding lives in header and content.',
      'Card surface',
      { display: 'flex', flexDirection: 'column', gap: '$space.xs', padding: '$space.sm 0', background: '$color.card', color: '$color.foreground', border: '1px solid $color.border', borderRadius: '$radius.lg', boxShadow: '$shadow.sm' },
    ),
    comp('CardHeader', 'Card title area', 'Generous inset.', 'Header', { display: 'flex', flexDirection: 'column', gap: '$space.xs', padding: '$space.md $space.lg 0' }),
    comp('CardContent', 'Card body', 'Generous inset.', 'Content', { display: 'flex', flexDirection: 'column', gap: '$space.sm', padding: '$space.sm $space.lg $space.md' }),
    comp('Input', 'Single-line text field', 'Full pill on a darker well, 44px.', '⌕  Search…', {
      display: 'flex', alignItems: 'center', height: '44px', padding: '0 18px', borderRadius: '$radius.full', background: '$color.input', color: '$color.mutedForeground', ...tstyle('body'), lineHeight: 1.4,
    }),
    comp(
      'Badge',
      'Small status label',
      'Pill chip on the muted fill. Variants: success, danger.',
      '-12%',
      { display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '4px 12px', borderRadius: '$radius.full', background: '$color.muted', color: '$color.foreground', ...tstyle('small') },
      { success: { background: 'rgba(155,229,154,0.16)', color: '$color.successText' }, danger: { background: 'rgba(242,109,133,0.16)', color: '$color.destructiveText' } },
    ),
    comp(
      'Alert',
      'Inline message',
      'Radius 20px, tinted sage fill, mint text.',
      'Heads up',
      { display: 'flex', alignItems: 'flex-start', gap: '$space.md', padding: '$space.md 20px', borderRadius: '$radius.lg', background: '$color.card', color: '$color.foreground', ...tstyle('body') },
      { success: { background: '$color.successSoft', color: '$color.successText' }, danger: { background: 'rgba(242,109,133,0.16)', color: '$color.destructiveText' } },
    ),
    comp('AlertTitle', 'Alert headline', 'Semibold.', 'Title', { ...tstyle('small'), fontWeight: 600, fontSize: '14px', color: 'inherit' }),
    comp('AlertDescription', 'Alert supporting text', 'Same hue as the title.', 'Description', { ...tstyle('body'), color: 'inherit' }),
    comp(
      'Switch',
      'On/off toggle (track)',
      '44×24 pill. On is mint.',
      '',
      { display: 'flex', alignItems: 'center', width: '44px', height: '24px', padding: '3px', borderRadius: '$radius.full', background: '$color.muted', cursor: 'pointer', flexShrink: 0 },
      { checked: { background: '$color.primary', justifyContent: 'flex-end' } },
    ),
    comp('SwitchThumb', 'Switch knob', '18px circle.', '', { width: '18px', height: '18px', borderRadius: '$radius.full', background: '$color.foreground' }, { checked: { background: '$color.primaryForeground' } }),
    comp('Tabs', 'Segmented tab list', 'Pill list on the dark well.', 'Tabs', {
      display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', gap: '2px', padding: '4px', borderRadius: '$radius.full', background: '$color.input',
    }),
    comp(
      'Tab',
      'Single tab',
      'Pill; active takes the muted fill.',
      'Overview',
      { display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 16px', borderRadius: '$radius.full', background: 'transparent', color: '$color.mutedForeground', ...tstyle('small'), cursor: 'pointer' },
      { active: { background: '$color.muted', color: '$color.foreground' } },
    ),
    comp('Sidebar', 'Primary navigation rail', 'Floating island: 28px radius, hairline border.', 'Sidebar', {
      display: 'flex', flexDirection: 'column', gap: '$space.xs', width: '256px', flexShrink: 0, padding: '$space.lg 20px', background: '$color.sidebar', border: '1px solid $color.border', borderRadius: '$radius.xl',
    }),
    comp('NavLabel', 'Sidebar group label', 'Small uppercase, dim.', 'Operations', { padding: '$space.sm 12px 4px', color: '$color.mutedForeground', ...tstyle('overline'), textTransform: 'uppercase' }),
    comp(
      'NavItem',
      'Sidebar row',
      '44px pill; icon at the trailing edge; active fills with muted.',
      'Dashboard',
      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '$space.sm', height: '44px', padding: '0 16px', borderRadius: '$radius.full', background: 'transparent', color: '$color.foreground', ...tstyle('body'), cursor: 'pointer', textAlign: 'left' },
      { active: { background: '$color.muted', fontWeight: 500 } },
    ),
    comp('LogoMark', 'Brand mark', 'Mint glyph, no container.', '✺', { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: '$color.primary', fontSize: '22px' }),
    comp('Avatar', 'User identity', 'Mint gradient circle.', 'KM', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '$radius.full', background: 'linear-gradient(135deg,#9be59a,#5bbf9a)', color: '$color.primaryForeground', ...tstyle('overline'), letterSpacing: '0', flexShrink: 0,
    }),
    comp(
      'TableRow',
      'Table row (grid)',
      'Hairline; head is small uppercase.',
      'Row',
      { display: 'grid', alignItems: 'center', padding: '14px $space.sm', borderBottom: '1px solid $color.border', ...tstyle('body') },
      { head: { color: '$color.mutedForeground', ...tstyle('overline'), textTransform: 'uppercase' } },
    ),
  ],
  page: fleetPage({
    brand: 'Flux',
    logo: '✺',
    iconSide: 'right',
    alertVariant: 'success',
    badge: { neutral: undefined, up: 'success', down: 'danger' },
    button: { secondary: 'secondary', outline: 'outline', ghost: 'ghost', danger: 'destructive' },
    brandStyle: { textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '13px' },
    rootStyle: { padding: '$space.md', gap: '$space.md' },
  }),
}

/* ================================================================== *
 *  4 · Lunaris — graphite, mono labels, one orange signal
 * ================================================================== */

const lunaris: DesignSystem = {
  name: 'Lunaris',
  philosophy:
    'Instrument-panel calm. Graphite surfaces, hairline grids, monospace labels for data and one orange signal light.',
  experienceNotes: [
    'Structure is drawn with 1px hairlines: card headers, sidebar edge, table rows.',
    'Labels and data headings are monospace. Body copy stays sans.',
    'Orange is a signal. Use it for the brand, warnings and deltas, not for buttons everywhere.',
    'Corners are tight (4–6px). Only navigation and search are pills.',
    'Status tints are muted and dark so the numbers stay brightest.',
  ],
  meta: {
    tagline: 'Lunaris design system',
    stack: 'React · CSS variables',
    backdrop: 'radial-gradient(90% 90% at 30% 20%,#86592a 0%,#583a18 48%,#33220f 100%)',
    provenance: 'No public source found. Rebuilt from the reference thumbnail: pixel-sampled colors, visible type.',
  },
  tokens: {
    color: {
      background: '#111111',
      card: '#141414',
      primary: '#f59a23',
      foreground: '#ededed',
      sidebar: '#1a1a1a',
      muted: '#2b2b2b',
      mutedForeground: '#8f8f8f',
      border: '#2a2a2a',
      input: '#161616',
      primaryForeground: '#1a1206',
      secondary: '#2b2b2b',
      secondaryForeground: '#ededed',
      accent: '#2c2c2c',
      destructive: '#e5484d',
      destructiveText: '#f47b7f',
      success: '#7fd39a',
      successSoft: '#1f2d26',
      successText: '#a5e3b6',
      successBorder: '#2c3d34',
      ring: '#f59a23',
    },
    font: {
      display: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace",
      body: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace",
    },
    type: {
      h1: ty(28, 600, 1.2, '-0.01em'),
      h2: ty(20, 600, 1.3),
      h3: ty(13, 500, 1.4, '0.01em'),
      body: ty(14, 400, 1.5),
      small: ty(13, 500, 1.4),
      caption: ty(12, 400, 1.4),
      overline: ty(12, 400, 1.4, '0.02em'),
      stat: ty(30, 500, 1.1, '-0.01em'),
    },
    space: SPACE,
    radius: { sm: '3px', md: '4px', lg: '6px', xl: '8px', full: '9999px' },
    shadow: { none: 'none', sm: 'none', md: '0 8px 24px rgba(0,0,0,0.5)', glow: '0 0 0 3px rgba(245,154,35,0.25)' },
  },
  components: [
    ...typography(),
    comp(
      'Button',
      'Primary interactive action',
      'Orange signal fill, 4px corners, 36px. Variants: secondary, outline, ghost, destructive.',
      'Request rover',
      {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '$space.sm', height: '36px', padding: '0 $space.md', borderRadius: '$radius.md',
        border: '1px solid transparent', background: '$color.primary', color: '$color.primaryForeground', ...tstyle('small'), fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer',
      },
      {
        secondary: { background: '$color.secondary', color: '$color.secondaryForeground' },
        outline: { background: 'transparent', border: '1px solid $color.border', color: '$color.foreground' },
        ghost: { background: 'transparent', color: '$color.mutedForeground' },
        destructive: { background: '$color.destructive', color: '#ffffff' },
      },
    ),
    comp('Card', 'Surface that groups related content', 'Hairline frame, 4px corners, no shadow. Header row has its own divider.', 'Card surface', {
      display: 'flex', flexDirection: 'column', background: '$color.card', color: '$color.foreground', border: '1px solid $color.border', borderRadius: '$radius.md',
    }),
    comp('CardHeader', 'Card title row', 'Divider under the label; label is mono.', 'Header', {
      display: 'flex', flexDirection: 'column', gap: '$space.xs', padding: '14px 20px', borderBottom: '1px solid $color.border',
    }),
    comp('CardContent', 'Card body', '20px inset.', 'Content', { display: 'flex', flexDirection: 'column', gap: '$space.sm', padding: '20px' }),
    comp('Input', 'Single-line text field', 'Pill search well with hairline.', '⌕  Search…', {
      display: 'flex', alignItems: 'center', height: '40px', padding: '0 16px', borderRadius: '$radius.full', border: '1px solid $color.border', background: '$color.input', color: '$color.mutedForeground', ...tstyle('body'), lineHeight: 1.4,
    }),
    comp(
      'Badge',
      'Small status label',
      'Pill; success is green tint, danger is orange tint (deltas use orange).',
      '-12%',
      { display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '3px 10px', borderRadius: '$radius.full', background: '$color.muted', color: '$color.foreground', ...tstyle('overline') },
      { success: { background: '#1f2d26', color: '$color.successText' }, danger: { background: '#2a1e10', color: '$color.primary' } },
    ),
    comp(
      'Alert',
      'Inline message',
      'Hairline box with dark green tint; a bare check glyph, no icon chip.',
      'Heads up',
      { display: 'flex', alignItems: 'flex-start', gap: '$space.md', padding: '$space.md 20px', borderRadius: '$radius.md', border: '1px solid $color.border', background: '$color.card', color: '$color.foreground', ...tstyle('body') },
      { success: { background: '$color.successSoft', border: '1px solid $color.successBorder', color: '$color.successText' }, danger: { background: '#2a1618', border: '1px solid #4a2426', color: '$color.destructiveText' } },
    ),
    comp('AlertTitle', 'Alert headline', 'Medium.', 'Title', { ...tstyle('small'), fontSize: '14px', color: 'inherit' }),
    comp('AlertDescription', 'Alert supporting text', 'Same hue as the title.', 'Description', { ...tstyle('body'), color: 'inherit' }),
    comp(
      'Switch',
      'On/off toggle (track)',
      '40×22 pill, orange when on.',
      '',
      { display: 'flex', alignItems: 'center', width: '40px', height: '22px', padding: '3px', borderRadius: '$radius.full', background: '$color.muted', cursor: 'pointer', flexShrink: 0 },
      { checked: { background: '$color.primary', justifyContent: 'flex-end' } },
    ),
    comp('SwitchThumb', 'Switch knob', '16px circle.', '', { width: '16px', height: '16px', borderRadius: '$radius.full', background: '$color.foreground' }, { checked: { background: '$color.primaryForeground' } }),
    comp('Tabs', 'Underline tab list', 'Hairline baseline.', 'Tabs', {
      display: 'flex', alignItems: 'flex-end', gap: '$space.md', borderBottom: '1px solid $color.border',
    }),
    comp(
      'Tab',
      'Single tab',
      'Mono label; active gets an orange underline.',
      'Overview',
      { display: 'inline-flex', alignItems: 'center', height: '36px', padding: '0 4px', marginBottom: '-1px', borderBottom: '2px solid transparent', background: 'transparent', color: '$color.mutedForeground', ...tstyle('small', '$font.mono'), cursor: 'pointer' },
      { active: { color: '$color.foreground', borderBottom: '2px solid $color.primary' } },
    ),
    comp('Sidebar', 'Primary navigation rail', '260px graphite rail, hairline right edge.', 'Sidebar', {
      display: 'flex', flexDirection: 'column', gap: '$space.xs', width: '260px', flexShrink: 0, padding: '$space.md', background: '$color.sidebar', borderRight: '1px solid $color.border',
    }),
    comp('NavLabel', 'Sidebar group label', 'Mono, dim.', 'Operations', { padding: '$space.sm 12px 4px', color: '$color.mutedForeground', ...tstyle('overline', '$font.mono') }),
    comp(
      'NavItem',
      'Sidebar row',
      '40px pill; active fills with accent.',
      'Dashboard',
      { display: 'flex', alignItems: 'center', gap: '12px', height: '40px', padding: '0 14px', borderRadius: '$radius.full', background: 'transparent', color: '$color.mutedForeground', ...tstyle('body'), cursor: 'pointer', textAlign: 'left' },
      { active: { background: '$color.accent', color: '$color.foreground' } },
    ),
    comp('LogoMark', 'Brand mark', 'Orange disc with a star glyph.', '✦', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '$radius.full', background: '$color.primary', color: '$color.primaryForeground', fontSize: '15px',
    }),
    comp('Avatar', 'User identity', 'Graphite circle with hairline.', 'KM', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '$radius.full', background: '$color.muted', border: '1px solid $color.border', color: '$color.foreground', ...tstyle('overline', '$font.mono'), flexShrink: 0,
    }),
    comp(
      'TableRow',
      'Table row (grid)',
      'Hairline rows; head is mono and dim.',
      'Row',
      { display: 'grid', alignItems: 'center', padding: '12px $space.sm', borderBottom: '1px solid $color.border', ...tstyle('body') },
      { head: { color: '$color.mutedForeground', ...tstyle('overline', '$font.mono') } },
    ),
  ],
  page: fleetPage({
    brand: 'Lunaris',
    logo: '✦',
    iconSide: 'left',
    alertVariant: 'success',
    badge: { neutral: undefined, up: 'success', down: 'danger' },
    button: { secondary: 'secondary', outline: 'outline', ghost: 'ghost', danger: 'destructive' },
    brandStyle: { textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f59a23' },
  }),
}

/* ================================================================== *
 *  5 · Nitro — flat Material-style dark, sharp corners, blue accent
 * ================================================================== */

const nitro: DesignSystem = {
  name: 'Nitro',
  philosophy:
    'Flat, sharp and fast. Stacked grey planes, square corners, Roboto type, and a blue bar that shows where you are.',
  experienceNotes: [
    'Planes step from canvas to rail to card by 6–8% lightness. No shadows needed.',
    'Corners are 2px. Only avatars and switches are round.',
    'Location is a 3px blue bar on the left edge of the active row.',
    'Alerts use a left status bar and a tinted plane, not a full border.',
    'Type is Roboto: regular for values, medium for actions.',
  ],
  meta: {
    tagline: 'Nitro design system',
    stack: 'React · CSS variables',
    backdrop:
      'radial-gradient(circle,rgba(10,20,60,0.35) 1px,transparent 1.6px) 0 0/7px 7px,linear-gradient(135deg,#5b86f7 0%,#2f4bb0 60%,#22336f 100%)',
    provenance: 'No public source found. Rebuilt from the reference thumbnail: pixel-sampled colors, visible type.',
  },
  tokens: {
    color: {
      background: '#252629',
      card: '#2e2f33',
      primary: '#4d7bf5',
      foreground: '#e6e6e8',
      sidebar: '#2e2f33',
      muted: '#3a3b40',
      mutedForeground: '#a3a4aa',
      border: '#3d3e43',
      input: '#1f2022',
      primaryForeground: '#ffffff',
      secondary: '#3a3b40',
      secondaryForeground: '#e6e6e8',
      accent: '#1f1f21',
      destructive: '#e5484d',
      destructiveText: '#f28b8e',
      success: '#8fd19e',
      successSoft: '#464a45',
      successText: '#cfeac0',
      successBorder: '#c2d7b8',
      ring: '#4d7bf5',
    },
    font: {
      display: "Roboto, 'Helvetica Neue', Arial, sans-serif",
      body: "Roboto, 'Helvetica Neue', Arial, sans-serif",
      mono: "'Roboto Mono', ui-monospace, Menlo, monospace",
    },
    type: {
      h1: ty(32, 400, 1.2),
      h2: ty(22, 500, 1.3),
      h3: ty(16, 500, 1.4, '0.01em'),
      body: ty(14, 400, 1.5, '0.01em'),
      small: ty(14, 500, 1.4, '0.02em'),
      caption: ty(12, 400, 1.4, '0.02em'),
      overline: ty(13, 500, 1.4, '0.02em'),
      stat: ty(34, 400, 1.1),
    },
    space: SPACE,
    radius: { sm: '2px', md: '2px', lg: '4px', xl: '4px', full: '9999px' },
    shadow: { none: 'none', sm: 'none', md: '0 2px 6px rgba(0,0,0,0.4)', lg: '0 8px 24px rgba(0,0,0,0.5)' },
  },
  components: [
    ...typography(),
    comp(
      'Button',
      'Primary interactive action',
      'Flat blue rectangle, 2px corners, 36px. Variants: secondary, outline, ghost, destructive.',
      'Request rover',
      {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '$space.sm', height: '36px', padding: '0 20px', borderRadius: '$radius.md',
        border: '1px solid transparent', background: '$color.primary', color: '$color.primaryForeground', ...tstyle('small'), lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer',
      },
      {
        secondary: { background: '$color.secondary', color: '$color.secondaryForeground' },
        outline: { background: 'transparent', border: '1px solid #55565c', color: '$color.foreground' },
        ghost: { background: 'transparent', color: '$color.primary' },
        destructive: { background: '$color.destructive', color: '#ffffff' },
      },
    ),
    comp('Card', 'Surface that groups related content', 'Plane one step above the canvas. Square, no border.', 'Card surface', {
      display: 'flex', flexDirection: 'column', background: '$color.card', color: '$color.foreground', borderRadius: '$radius.lg', border: '1px solid $color.border',
    }),
    comp('CardHeader', 'Card title area', 'Top inset.', 'Header', { display: 'flex', flexDirection: 'column', gap: '$space.xs', padding: '$space.md 20px 0' }),
    comp('CardContent', 'Card body', '20px inset.', 'Content', { display: 'flex', flexDirection: 'column', gap: '$space.sm', padding: '$space.sm 20px 20px' }),
    comp('Input', 'Single-line text field', 'Recessed rectangle with hairline.', '⌕  Search…', {
      display: 'flex', alignItems: 'center', height: '44px', padding: '0 $space.md', borderRadius: '$radius.md', border: '1px solid $color.border', background: '$color.input', color: '$color.mutedForeground', ...tstyle('body'), lineHeight: 1.4,
    }),
    comp(
      'Badge',
      'Small status label',
      'Square-cornered tag. Variants: success, danger.',
      '-12%',
      { display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '2px 8px', borderRadius: '$radius.md', background: '$color.muted', color: '$color.foreground', ...tstyle('caption'), fontWeight: 500 },
      { success: { background: 'rgba(143,209,158,0.18)', color: '$color.success' }, danger: { background: 'rgba(229,72,77,0.2)', color: '$color.destructiveText' } },
    ),
    comp(
      'Alert',
      'Inline message',
      'Tinted plane with a 3px left status bar.',
      'Heads up',
      { display: 'flex', alignItems: 'flex-start', gap: '$space.md', padding: '$space.md 20px', borderRadius: '$radius.md', borderLeft: '3px solid $color.border', background: '$color.card', color: '$color.foreground', ...tstyle('body') },
      { success: { background: '$color.successSoft', borderLeft: '3px solid $color.successBorder', color: '$color.successText' }, danger: { background: '#4a2a2c', borderLeft: '3px solid $color.destructive', color: '$color.destructiveText' } },
    ),
    comp('AlertTitle', 'Alert headline', 'Medium.', 'Title', { ...tstyle('small'), fontSize: '15px', color: 'inherit' }),
    comp('AlertDescription', 'Alert supporting text', 'Same hue as the title.', 'Description', { ...tstyle('body'), color: 'inherit' }),
    comp(
      'Switch',
      'On/off toggle (track)',
      '36×18 pill; blue when on.',
      '',
      { display: 'flex', alignItems: 'center', width: '36px', height: '18px', padding: '2px', borderRadius: '$radius.full', background: '#55565c', cursor: 'pointer', flexShrink: 0 },
      { checked: { background: '$color.primary', justifyContent: 'flex-end' } },
    ),
    comp('SwitchThumb', 'Switch knob', '14px circle.', '', { width: '14px', height: '14px', borderRadius: '$radius.full', background: '#ffffff' }),
    comp('Tabs', 'Underline tab list', 'Hairline baseline.', 'Tabs', { display: 'flex', alignItems: 'flex-end', gap: '$space.lg', borderBottom: '1px solid $color.border' }),
    comp(
      'Tab',
      'Single tab',
      'Medium label; active gets a blue underline.',
      'Overview',
      { display: 'inline-flex', alignItems: 'center', height: '40px', padding: '0 2px', marginBottom: '-1px', borderBottom: '2px solid transparent', background: 'transparent', color: '$color.mutedForeground', ...tstyle('small'), cursor: 'pointer' },
      { active: { color: '$color.foreground', borderBottom: '2px solid $color.primary' } },
    ),
    comp('Sidebar', 'Primary navigation rail', '260px plane, no border; rows run edge to edge.', 'Sidebar', {
      display: 'flex', flexDirection: 'column', width: '260px', flexShrink: 0, padding: '$space.md 0', background: '$color.sidebar',
    }),
    comp('NavLabel', 'Sidebar group label', 'Medium, dim.', 'Operations', { padding: '$space.md 20px $space.sm', color: '$color.mutedForeground', ...tstyle('overline'), letterSpacing: '0.01em' }),
    comp(
      'NavItem',
      'Sidebar row',
      '44px full-width row; active is a darker plane with a 3px blue bar.',
      'Dashboard',
      { display: 'flex', alignItems: 'center', gap: '$space.md', height: '44px', padding: '0 20px', borderLeft: '3px solid transparent', background: 'transparent', color: '$color.mutedForeground', ...tstyle('body'), fontSize: '15px', cursor: 'pointer', textAlign: 'left' },
      { active: { background: '$color.accent', borderLeft: '3px solid $color.primary', color: '$color.foreground' } },
    ),
    comp('LogoMark', 'Brand mark', 'Blue square with a diamond glyph.', '◆', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: '$color.primary', color: '#ffffff', fontSize: '13px',
    }),
    comp('Avatar', 'User identity', 'Blue circle.', 'KM', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '$radius.full', background: '$color.primary', color: '#ffffff', ...tstyle('small'), flexShrink: 0,
    }),
    comp(
      'TableRow',
      'Table row (grid)',
      'Hairline rows; head is medium and dim.',
      'Row',
      { display: 'grid', alignItems: 'center', padding: '12px $space.sm', borderBottom: '1px solid $color.border', ...tstyle('body') },
      { head: { color: '$color.mutedForeground', fontWeight: 500 } },
    ),
  ],
  page: fleetPage({
    brand: 'Nitro',
    logo: '◆',
    iconSide: 'left',
    alertVariant: 'success',
    badge: { neutral: undefined, up: 'success', down: 'danger' },
    button: { secondary: 'secondary', outline: 'outline', ghost: 'ghost', danger: 'destructive' },
    brandStyle: { fontWeight: 500 },
  }),
}


/* ================================================================== *
 *  Relume  (light, black & white)
 *  Tokens: @relume_io/relume-tailwind 1.3.0 (colors, type scale, shadows).
 *  Classes: @relume_io/relume-ui 1.3.1 (Button, Badge, Input, Accordion).
 *  Relume UI has no Card, Alert or Avatar; those recipes follow how
 *  Relume's own sections build them (bordered blocks, 1px black lines).
 * ================================================================== */

const relume: DesignSystem = {
  name: 'Relume',
  philosophy:
    'Wireframe clarity. Black on white, one-pixel black lines, square corners. Structure comes from spacing and type size, not from color or shadow.',
  experienceNotes: [
    'Black and white only. Light grey (#eeeeee) alternates sections; one solid black band adds contrast.',
    'Square corners everywhere. Only badges are pills.',
    'Borders are 1px black. Blocks are outlines, not shadows.',
    'Buttons: primary is solid black, secondary is outlined, tertiary and link are plain text. Padding is 24 × 12.',
    'Sections breathe: 5% side padding, 64–112px vertical padding, content capped at 1280px.',
    'Headings are bold with tight line height (1.2); body is 16px at 1.5.',
  ],
  meta: {
    tagline: 'Relume UI + Tailwind preset',
    stack: 'React · Tailwind · Radix UI',
    install: 'npm i @relume_io/relume-ui @relume_io/relume-tailwind',
    docs: 'https://react-docs.relume.io/',
    backdrop: 'linear-gradient(135deg,#ffffff 0%,#eeeeee 100%)',
    provenance:
      'Tokens read from @relume_io/relume-tailwind 1.3.0 and classes from @relume_io/relume-ui 1.3.1. The preset defines no font, so the system sans stack is used. Real Relume UI components are installed in this app.',
    library: 'relume',
  },
  tokens: {
    color: {
      background: '#ffffff',
      card: '#ffffff',
      primary: '#000000',
      foreground: '#000000',
      sidebar: '#eeeeee',
      muted: '#eeeeee',
      mutedForeground: '#666666',
      border: '#000000',
      input: '#000000',
      primaryForeground: '#ffffff',
      secondary: '#ffffff',
      secondaryForeground: '#000000',
      accent: '#eeeeee',
      destructive: '#b42318',
      destructiveText: '#b42318',
      success: '#027a48',
      successSoft: '#ecfdf3',
      successText: '#027a48',
      successBorder: '#027a48',
      ring: '#000000',
    },
    font: {
      display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    type: {
      h1: ty(56, 700, 1.2),
      h2: ty(40, 700, 1.2),
      h3: ty(24, 700, 1.4),
      body: ty(16, 400, 1.5),
      small: ty(14, 400, 1.5),
      caption: ty(12, 400, 1.5),
      overline: ty(14, 600, 1.5),
      stat: ty(40, 700, 1.2),
    },
    space: SPACE,
    radius: { sm: '0px', md: '0px', lg: '0px', xl: '0px', full: '9999px' },
    shadow: {
      none: 'none',
      xs: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      sm: '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
      md: '0px 4px 8px -2px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.06)',
      ring: '0 0 0 2px #000000',
    },
  },
  components: [
    ...typography(),
    comp(
      'Button',
      'Every clickable action',
      'px-6 py-3, gap-3, square corners, 1px border. primary = black fill; secondary = white with black border; tertiary/link = text only.',
      'Request rover',
      {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px $space.lg', borderRadius: '$radius.md',
        border: '1px solid $color.border', background: '$color.primary', color: '$color.primaryForeground', ...tstyle('body'), lineHeight: 1.5,
        whiteSpace: 'nowrap', cursor: 'pointer',
      },
      {
        secondary: { background: '$color.secondary', color: '$color.secondaryForeground' },
        outline: { background: '$color.secondary', color: '$color.secondaryForeground' },
        ghost: { background: 'transparent', border: '1px solid transparent', color: '$color.foreground' },
        destructive: { background: '$color.secondary', border: '1px solid $color.destructive', color: '$color.destructiveText' },
        link: { background: 'transparent', border: '0', padding: '0', textDecoration: 'underline' },
        sm: { padding: '8px 20px' },
      },
      `import { Button } from "@relume_io/relume-ui"\n\n<Button variant="primary">Request rover</Button>\n<Button variant="secondary">View missions</Button>\n<Button variant="tertiary">Details</Button>\n<Button variant="link" size="link">Learn more</Button>`,
    ),
    comp(
      'Card',
      'A bordered block that groups content',
      'Relume UI has no Card: sections use a div with a 1px black border and p-6/p-8, no radius, no shadow.',
      'Card surface',
      { display: 'flex', flexDirection: 'column', gap: '$space.lg', padding: '$space.lg', background: '$color.card', color: '$color.foreground', border: '1px solid $color.border', borderRadius: '$radius.md' },
      undefined,
      `<div className="flex flex-col gap-4 border border-border-primary p-6">\n  <h3 className="text-2xl font-bold">Active rovers</h3>\n  <p>Across the fleet</p>\n</div>`,
    ),
    comp('CardHeader', 'Block title area', 'Stacks title and description with a small gap.', 'Header', { display: 'flex', flexDirection: 'column', gap: '$space.sm' }),
    comp('CardContent', 'Block body', 'Plain content area.', 'Content', { display: 'flex', flexDirection: 'column', gap: '$space.sm' }),
    comp(
      'Input',
      'Single-line text field',
      'min-h-11 (44px), 1px black border, px-3 py-2, transparent fill, square.',
      '⌕  Search…',
      { display: 'flex', alignItems: 'center', minHeight: '44px', padding: '8px 12px', borderRadius: '$radius.md', border: '1px solid $color.input', background: 'transparent', color: '$color.mutedForeground', ...tstyle('body') },
      undefined,
      `import { Input } from "@relume_io/relume-ui"\n\n<Input type="search" placeholder="Search…" />`,
    ),
    comp(
      'Badge',
      'Small pill label',
      'Fully rounded, 1px border, px-2, text-sm semibold. Variants: default (black), secondary (grey), outline, success.',
      'New',
      { display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '0 8px', borderRadius: '$radius.full', border: '1px solid transparent', background: '$color.primary', color: '$color.primaryForeground', ...tstyle('small'), fontWeight: 600 },
      {
        secondary: { background: '$color.muted', color: '$color.foreground' },
        outline: { background: 'transparent', border: '1px solid $color.border', color: '$color.foreground' },
        destructive: { background: '#fef3f2', color: '$color.destructiveText' },
      },
      `import { Badge } from "@relume_io/relume-ui"\n\n<Badge variant="secondary">+8%</Badge>\n<Badge variant="success">Live</Badge>`,
    ),
    comp(
      'Alert',
      'Inline message',
      'Square block with a 1px border; success uses the success tint. Relume UI has no Alert: built from a bordered div.',
      'Heads up',
      { display: 'flex', alignItems: 'flex-start', gap: '$space.md', padding: '$space.md', borderRadius: '$radius.md', border: '1px solid $color.successBorder', background: '$color.successSoft', color: '$color.successText', ...tstyle('body') },
      { destructive: { border: '1px solid $color.destructive', background: '#fef3f2', color: '$color.destructiveText' } },
    ),
    comp('AlertTitle', 'Alert headline', 'Bold, one line.', 'Title', { ...tstyle('body'), fontWeight: 700, color: 'inherit' }),
    comp('AlertDescription', 'Alert supporting text', 'Body text in the alert color.', 'Description', { ...tstyle('body'), color: 'inherit' }),
    comp(
      'Switch',
      'On/off toggle (track)',
      'Rounded track, black when on.',
      '',
      { display: 'flex', alignItems: 'center', width: '40px', height: '24px', padding: '2px', borderRadius: '$radius.full', background: '#cccccc', cursor: 'pointer', flexShrink: 0 },
      { checked: { background: '$color.primary', justifyContent: 'flex-end' } },
      `import { Switch } from "@relume_io/relume-ui"\n\n<Switch defaultChecked />`,
    ),
    comp('SwitchThumb', 'Switch knob', '20px circle.', '', { width: '20px', height: '20px', borderRadius: '$radius.full', background: '#ffffff', boxShadow: '$shadow.xs' }),
    comp(
      'Tabs',
      'Tab list',
      'Flex row; each trigger is a plain label, the active one has a black underline.',
      'Tabs',
      { display: 'inline-flex', alignItems: 'stretch', alignSelf: 'flex-start', borderBottom: '1px solid $color.border' },
      undefined,
      `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@relume_io/relume-ui"\n\n<Tabs defaultValue="all">\n  <TabsList>\n    <TabsTrigger value="all">All</TabsTrigger>\n    <TabsTrigger value="active">Active</TabsTrigger>\n  </TabsList>\n  <TabsContent value="all">…</TabsContent>\n</Tabs>`,
    ),
    comp(
      'Tab',
      'Single tab trigger',
      'px-4 py-2, plain text; active gets a 2px black bottom border.',
      'Overview',
      { display: 'inline-flex', alignItems: 'center', padding: '8px 16px', borderBottom: '2px solid transparent', background: 'transparent', color: '$color.mutedForeground', ...tstyle('body'), cursor: 'pointer' },
      { active: { borderBottom: '2px solid $color.border', color: '$color.foreground', fontWeight: 600 } },
    ),
    comp('Sidebar', 'Primary navigation rail', 'Light grey rail, black right border.', 'Sidebar', {
      display: 'flex', flexDirection: 'column', gap: '$space.xs', width: '256px', flexShrink: 0, padding: '$space.sm', background: '$color.sidebar', borderRight: '1px solid $color.border',
    }),
    comp('NavLabel', 'Sidebar group label', 'Small semibold label.', 'Operations', { padding: '$space.sm', color: '$color.mutedForeground', ...tstyle('overline') }),
    comp(
      'NavItem',
      'Sidebar menu button',
      'Square row, p-2, text-base; active is white with medium weight.',
      'Dashboard',
      { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '$radius.md', background: 'transparent', color: '$color.foreground', ...tstyle('body'), cursor: 'pointer', textAlign: 'left' },
      { active: { background: '#ffffff', fontWeight: 500 } },
    ),
    comp('LogoMark', 'Brand mark', 'Black square, 32px.', '◉', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '$radius.md', background: '$color.primary', color: '$color.primaryForeground', fontSize: '16px',
    }),
    comp('Avatar', 'User identity', '32px circle, light grey with a black hairline.', 'KM', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '$radius.full', background: '$color.muted', border: '1px solid $color.border', color: '$color.foreground', ...tstyle('overline'), flexShrink: 0,
    }),
    comp(
      'TableRow',
      'Table row (grid)',
      'border-b 1px black; head variant is bold.',
      'Row',
      { display: 'grid', alignItems: 'center', padding: '12px $space.sm', borderBottom: '1px solid $color.border', ...tstyle('body') },
      { head: { fontWeight: 700 } },
      `import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@relume_io/relume-ui"\n\n<TableRow>\n  <TableCell>Olympus survey</TableCell>\n  <TableCell>Curiosity-X</TableCell>\n</TableRow>`,
    ),
  ],
  page: fleetPage({
    brand: 'Acme',
    logo: '◉',
    iconSide: 'left',
    badge: { neutral: 'outline', up: 'secondary', down: 'destructive' },
    button: { secondary: 'secondary', outline: 'outline', ghost: 'ghost', danger: 'destructive' },
  }),
}

/* ------------------------------------------------------------------ */

const BUILTIN_DATE = '2026-09-19T00:00:00.000Z'

export const BUILTIN_STYLES: SavedStyle[] = [
  { id: 'builtin-shadcn', savedAt: BUILTIN_DATE, system: shadcn, builtin: true },
  { id: 'builtin-relume', savedAt: BUILTIN_DATE, system: relume, builtin: true },
  { id: 'builtin-heroui', savedAt: BUILTIN_DATE, system: heroui, builtin: true },
  { id: 'builtin-halo', savedAt: BUILTIN_DATE, system: halo, builtin: true },
  { id: 'builtin-lunaris', savedAt: BUILTIN_DATE, system: lunaris, builtin: true },
  { id: 'builtin-nitro', savedAt: BUILTIN_DATE, system: nitro, builtin: true },
]
