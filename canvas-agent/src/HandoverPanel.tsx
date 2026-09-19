import { useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasNode } from './ai'
import { componentSpec, getLibrary } from './realui/catalog'
import {
  collectTokens,
  componentName,
  copyText,
  downloadText,
  groupClasses,
  pageTokensToCss,
  readSpec,
  toHtml,
  toReact,
  toSnippet,
  type ElementSpec,
  type PageTokens,
} from './handover'

/* ================================================================== *
 *  Handover panel — what a developer needs from the finished design.
 *    Inspect: Tailwind classes + real computed values for the selection
 *    Code:    React + Tailwind component, or a standalone HTML page
 *    Tokens:  the palette, type, spacing and radii the page uses
 * ================================================================== */

type Tab = 'inspect' | 'code' | 'tokens'

interface Props {
  tree: CanvasNode
  selected: CanvasNode | null
  /** The element that wraps the rendered artboard (values are read from it). */
  artboard: React.RefObject<HTMLElement | null>
  onClose: () => void
}

export function HandoverPanel({ tree, selected, artboard, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('inspect')
  const [note, setNote] = useState<string | null>(null)
  const noteTimer = useRef<number | undefined>(undefined)

  const flash = (text: string) => {
    setNote(text)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), 1600)
  }
  useEffect(() => () => window.clearTimeout(noteTimer.current), [])

  const copy = async (text: string, what: string) => flash((await copyText(text)) ? `Copied ${what}` : 'Copy was blocked by the browser')

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-zinc-800/80 bg-zinc-950">
      <header className="flex items-center gap-2 border-b border-zinc-800/80 px-4 py-3">
        <h2 className="text-[12px] font-semibold tracking-tight">Handover</h2>
        <div className="ml-2 flex items-center gap-0.5 rounded-lg border border-zinc-800 p-0.5 font-mono text-[10.5px]">
          {(['inspect', 'code', 'tokens'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 transition-colors ${tab === t ? 'bg-fuchsia-600/90 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close handover panel"
          className="ml-auto rounded-md px-1.5 py-0.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
        >
          ✕
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === 'inspect' && <InspectTab tree={tree} selected={selected} artboard={artboard} copy={copy} />}
        {tab === 'code' && <CodeTab tree={tree} copy={copy} />}
        {tab === 'tokens' && <TokensTab tree={tree} artboard={artboard} copy={copy} />}
      </div>

      <footer className="h-8 shrink-0 border-t border-zinc-800/80 px-4 py-2 font-mono text-[10px] text-emerald-400" aria-live="polite">
        {note}
      </footer>
    </aside>
  )
}

type CopyFn = (text: string, what: string) => void

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 pt-4 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">{children}</p>
)

/* ------------------------------ Inspect ------------------------------ */

function InspectTab({ tree, selected, artboard, copy }: { tree: CanvasNode; selected: CanvasNode | null; artboard: Props['artboard']; copy: CopyFn }) {
  const [spec, setSpec] = useState<ElementSpec | null>(null)

  useEffect(() => {
    if (!selected) {
      setSpec(null)
      return
    }
    const el = artboard.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(selected.id)}"]`)
    setSpec(el ? readSpec(el, selected.classes) : null)
  }, [selected, artboard])

  if (!selected) {
    return (
      <p className="px-4 py-6 text-[12px] leading-relaxed text-zinc-500">
        Click any element on the canvas. You get its Tailwind classes, its real sizes and colors in pixels and hex, a CSS block, and a
        code snippet to copy.
      </p>
    )
  }

  return (
    <div className="pb-4">
      <div className="flex items-baseline gap-2 px-4 pt-4">
        <span className="text-[13px] font-semibold text-zinc-100">{selected.label}</span>
        <span className="font-mono text-[10px] text-zinc-500">{`<${selected.type}>`}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        <button type="button" onClick={() => copy(toSnippet(selected, tree.library ?? null), 'JSX snippet')} className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-600">
          Copy JSX
        </button>
        <button type="button" onClick={() => copy(selected.classes, 'Tailwind classes')} className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-600">
          Copy classes
        </button>
        {spec && (
          <button type="button" onClick={() => copy(spec.css, 'CSS')} className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-600">
            Copy CSS
          </button>
        )}
      </div>

      {selected.type === 'component' && tree.library && (() => {
        const spec = componentSpec(tree.library, selected.component)
        if (!spec) return null
        const props = Object.entries({ ...spec.fixed, ...selected.props })
        return (
          <>
            <SectionTitle>Real component · {getLibrary(tree.library)?.label}</SectionTitle>
            <dl className="mx-4 divide-y divide-zinc-800/70 rounded-lg border border-zinc-800 bg-zinc-900/40">
              {[
                { label: 'Component', value: spec.name === 'Icon' ? String(selected.props?.name ?? 'Icon') : spec.name },
                { label: 'Import', value: `import { ${spec.name === 'Icon' ? String(selected.props?.name ?? 'Icon') : spec.name} } from "${spec.module}"` },
                ...(props.length ? [{ label: 'Props', value: props.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') }] : []),
              ].map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => copy(row.value, row.label.toLowerCase())}
                  className="flex w-full items-start gap-3 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/50"
                >
                  <dt className="w-20 shrink-0 pt-px font-mono text-[10.5px] text-zinc-500">{row.label}</dt>
                  <dd className="min-w-0 flex-1 break-words font-mono text-[11px] text-zinc-200">{row.value}</dd>
                </button>
              ))}
            </dl>
          </>
        )
      })()}

      {selected.content && (
        <>
          <SectionTitle>Text</SectionTitle>
          <button
            type="button"
            onClick={() => copy(selected.content ?? '', 'text')}
            className="mx-4 block w-[calc(100%-2rem)] rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left text-[12px] leading-relaxed text-zinc-300 transition-colors hover:border-zinc-600"
          >
            {selected.content}
          </button>
        </>
      )}

      {spec?.sections.map((section) => (
        <div key={section.title}>
          <SectionTitle>{section.title}</SectionTitle>
          <dl className="mx-4 divide-y divide-zinc-800/70 rounded-lg border border-zinc-800 bg-zinc-900/40">
            {section.rows.map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => copy(row.value, row.label.toLowerCase())}
                className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/50"
              >
                <dt className="w-20 shrink-0 font-mono text-[10.5px] text-zinc-500">{row.label}</dt>
                <dd className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[11px] text-zinc-200">
                  {row.swatch && <span className="size-3 shrink-0 rounded-sm border border-white/20" style={{ background: row.swatch }} />}
                  <span className="min-w-0 break-words">{row.value}</span>
                </dd>
              </button>
            ))}
          </dl>
        </div>
      ))}

      <SectionTitle>Tailwind classes</SectionTitle>
      <div className="flex flex-col gap-2.5 px-4">
        {groupClasses(selected.classes).map(({ group, items }) => (
          <div key={group}>
            <p className="pb-1 font-mono text-[10px] text-zinc-600">{group}</p>
            <div className="flex flex-wrap gap-1">
              {items.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => copy(c, c)}
                  className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[10.5px] text-sky-300/90 transition-colors hover:border-sky-500/50"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <details className="mx-4 mt-4 rounded-lg border border-zinc-800/70">
        <summary className="cursor-pointer px-3 py-2 font-mono text-[10.5px] text-zinc-500">Raw node JSON</summary>
        <pre className="thin-scroll max-h-56 overflow-auto px-3 pb-3 font-mono text-[10.5px] leading-relaxed text-zinc-400">{JSON.stringify(selected, null, 2)}</pre>
      </details>
    </div>
  )
}

/* -------------------------------- Code -------------------------------- */

function CodeTab({ tree, copy }: { tree: CanvasNode; copy: CopyFn }) {
  const real = getLibrary(tree.library)
  const [pickedFormat, setFormat] = useState<'react' | 'html'>('react')
  const format = real ? 'react' : pickedFormat // real components cannot be flattened to standalone HTML
  const code = useMemo(() => (format === 'react' ? toReact(tree) : toHtml(tree)), [tree, format])
  const name = componentName(tree.label)
  const filename = format === 'react' ? `${name}.tsx` : `${name}.html`

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 p-0.5 font-mono text-[10.5px]">
          {(real ? (['react'] as const) : (['react', 'html'] as const)).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-md px-2.5 py-1 transition-colors ${format === f ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {f === 'react' ? (real ? `React + ${real.label}` : 'React + Tailwind') : 'HTML'}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">{code.split('\n').length} lines</span>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => copy(code, filename)} className="flex-1 rounded-lg bg-fuchsia-600 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-fuchsia-500">
          Copy code
        </button>
        <button
          type="button"
          onClick={() => downloadText(filename, code, format === 'html' ? 'text/html' : 'text/plain')}
          className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-zinc-900"
        >
          Download {filename}
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        {real
          ? `Real ${real.label} components with their real imports. The comment block at the top lists what to install. No HTML export: real components need their library.`
          : format === 'react'
          ? 'Needs Tailwind CSS in your project. The 1200px artboard becomes a fluid, centered page, and top-level sections use semantic tags (nav, header, section, footer).'
          : 'Opens by itself in a browser. It loads Tailwind from a CDN, which is fine for previews. Build with Tailwind for production.'}
      </p>

      <pre className="thin-scroll max-h-[calc(100vh-330px)] min-h-40 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-[10.5px] leading-relaxed text-zinc-300">
        {code}
      </pre>
    </div>
  )
}

/* ------------------------------- Tokens ------------------------------- */

function TokensTab({ tree, artboard, copy }: { tree: CanvasNode; artboard: Props['artboard']; copy: CopyFn }) {
  const [tokens, setTokens] = useState<PageTokens | null>(null)

  useEffect(() => {
    const root = artboard.current
    setTokens(root ? collectTokens(root, tree) : null)
  }, [tree, artboard])

  if (!tokens) return <p className="px-4 py-6 text-[12px] text-zinc-500">Reading the design…</p>

  return (
    <div className="pb-4">
      <div className="flex gap-2 px-4 pt-4">
        <button type="button" onClick={() => copy(pageTokensToCss(tokens), 'CSS variables')} className="flex-1 rounded-lg bg-fuchsia-600 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-fuchsia-500">
          Copy as CSS variables
        </button>
        <button type="button" onClick={() => copy(JSON.stringify(tokens, null, 2), 'tokens as JSON')} className="rounded-lg border border-zinc-700 px-3 py-2 text-[12px] text-zinc-200 transition-colors hover:bg-zinc-900">
          JSON
        </button>
      </div>

      <SectionTitle>Colors · {tokens.colors.length}</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5 px-4">
        {tokens.colors.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => copy(c.hex, c.hex)}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1.5 text-left transition-colors hover:border-zinc-600"
          >
            <span className="size-7 shrink-0 rounded-md border border-white/15" style={{ background: c.hex }} />
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-[11px] text-zinc-200">{c.hex}</span>
              <span className="truncate font-mono text-[9.5px] text-zinc-500">{c.name ?? 'custom'} · ×{c.count}</span>
            </span>
          </button>
        ))}
      </div>

      <SectionTitle>Type</SectionTitle>
      <div className="mx-4 divide-y divide-zinc-800/70 rounded-lg border border-zinc-800 bg-zinc-900/40">
        {tokens.fonts.map((f) => (
          <p key={f.family} className="px-3 py-1.5 font-mono text-[11px] text-zinc-300">
            {f.family} <span className="text-zinc-600">· ×{f.count}</span>
          </p>
        ))}
        {tokens.type.map((t) => (
          <p key={`${t.size}-${t.weight}-${t.lineHeight}`} className="flex items-baseline justify-between px-3 py-1.5 font-mono text-[11px] text-zinc-300">
            <span>{t.size}px · {t.weight}</span>
            <span className="text-zinc-600">line {t.lineHeight === 'normal' ? 'normal' : `${t.lineHeight}px`} · ×{t.count}</span>
          </p>
        ))}
      </div>

      <SectionTitle>Spacing</SectionTitle>
      <div className="flex flex-wrap gap-1 px-4">
        {tokens.spacing.map((s) => (
          <button key={s.px} type="button" onClick={() => copy(`${s.px}px`, `${s.px}px`)} className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-600">
            {s.px}
          </button>
        ))}
      </div>

      {tokens.radii.length > 0 && (
        <>
          <SectionTitle>Radius</SectionTitle>
          <div className="flex flex-wrap gap-1 px-4">
            {tokens.radii.map((r) => (
              <button key={r.px} type="button" onClick={() => copy(`${r.px}px`, `${r.px}px`)} className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-600">
                {r.px}
              </button>
            ))}
          </div>
        </>
      )}

      {tokens.shadows.length > 0 && (
        <>
          <SectionTitle>Shadows</SectionTitle>
          <div className="flex flex-col gap-1 px-4">
            {tokens.shadows.map((s) => (
              <button key={s.value} type="button" onClick={() => copy(s.value, 'shadow')} className="break-words rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-left font-mono text-[10px] text-zinc-400 transition-colors hover:border-zinc-600">
                {s.value}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
