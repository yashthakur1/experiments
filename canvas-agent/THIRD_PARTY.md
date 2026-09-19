# Third-party components and licences

This project uses **free components only**. Nothing here needs a paid plan, a key or a subscription.

| Library | Used for | Licence |
|---|---|---|
| shadcn/ui (component source in `src/components/ui`) | Real components for the shadcn/ui style | MIT |
| Radix UI (`radix-ui`) | Behaviour under the shadcn/ui components | MIT |
| lucide-react | Icons | ISC |
| class-variance-authority | Variant classes | Apache-2.0 |
| tailwind-merge, clsx | Class merging | MIT |
| tw-animate-css | Open/close animations | MIT |
| @relume_io/relume-ui 1.3.1 | Real components for the Relume style | **No licence declared** (see below) |
| @relume_io/relume-tailwind 1.3.0 | Relume design tokens (read once; values copied into `src/index.css` and `src/systems.ts`) | **No licence declared** (see below) |

## Relume

Relume's free-components page tells you to install `@relume_io/relume-ui` and `@relume_io/relume-tailwind`, and
both are public on npm with no login. This app uses only the base parts of `relume-ui` (Button, Badge, Input,
Textarea, Label, Checkbox, Switch, Separator, Skeleton, Tabs, Accordion, Table). It does **not** use or copy the paid
Relume Library (the 1,000+ section components).

Neither package ships a licence file, so the terms are Relume's, not an open-source licence. If this app is
shipped to customers, confirm the terms with Relume first, or remove Relume from `LIBRARIES` in
`src/realui/catalog.ts`. The style itself then still works as a Tailwind approximation.

## Relume sections: NOT added, on purpose

Relume's free-components page offers 30 free section components (Navbar, Header, Layout, CTA, FAQ, Pricing, Footer…).
They are **not** in this app because:

- Relume's Licensing Agreement (relume.ai/legal/licensing-agreement) says the components may not be re-distributed
  ("Under no circumstances should the Item be re-distributed, regardless of any modifications"), and that end
  products for sale or free distribution must not include editable source files. This app bundles components and
  exports code for other people, which is redistribution.
- Their source is only visible after signing up for a Relume account.

A person can still download the free sections with their own account and use them in their own client projects.
Do not commit them here.

## Light theme

`html[data-theme="light"]` in `src/index.css` redefines Tailwind's zinc scale as cream / egg-white / beige and
deepens the accent colors. `.design-surface` restores the original palette inside generated designs, so a design
looks the same in both themes. Regenerate both blocks from `node_modules/tailwindcss/theme.css` if Tailwind changes.

## Design-language extras (fonts, icons, art)

| Part | Source | Licence |
|---|---|---|
| Web fonts in a language's font pairing | Google Fonts (`fonts.googleapis.com`), only the families listed in `FONT_CATALOG` in `src/language.ts` | SIL Open Font License / Apache-2.0 |
| Icons in a language's icon set | lucide-react (the names in `ICON_POOL`) | ISC |
| Image art (petals, blobs, waves…) | Generated in the app, from the language's own palette | none needed |

Google Fonts are loaded from Google's servers when a language with web fonts is shown. That sends the visitor's IP
to Google, like any site that uses Google Fonts. If that matters, self-host the fonts instead.
No stock photos are bundled. The `bit-graphics` image tool was not used: it needs a paid image API.

## Rules for adding a library

1. Check the licence on npm and in the repository. MIT, ISC, BSD and Apache-2.0 are fine.
2. Never add a paid tier (for example HeroUI Pro, Relume paid sections, Tailwind Plus).
3. Add its import path to `FREE_MODULES` in `src/realui/catalog.ts` with the licence. The catalog test fails for any
   component whose module is not listed.
