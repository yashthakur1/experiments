import { useState } from 'react'
import { EFFORTS, PROVIDERS, commitProfile, defaultModel, providerHasEffort, providerMeta, switchProvider, type AIConfig } from './ai'

interface ConfigModalProps {
  config: AIConfig
  onSave: (next: AIConfig) => void
  onClose: () => void
}

export function ConfigModal({ config, onSave, onClose }: ConfigModalProps) {
  const [draft, setDraft] = useState<AIConfig>(config)
  const meta = providerMeta(draft.provider)
  const fallbackModel = defaultModel(draft.provider)
  const known = meta.models.some((m) => m.id === draft.model)
  // "Custom" stays selected while the user types, even if the text is empty or matches nothing
  const [customFor, setCustomFor] = useState<string | null>(() => (config.model && !meta.models.some((m) => m.id === config.model) ? config.provider : null))
  const custom = customFor === draft.provider || (!!draft.model && !known)
  const selectValue = custom ? '__custom' : draft.model || fallbackModel

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-[440px] flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-zinc-100">Model configuration</h2>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Your key is stored in this browser (localStorage) and sent directly to the provider — no server in between.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Provider</span>
          <select
            value={draft.provider}
            onChange={(e) => setDraft(switchProvider(draft, e.target.value as AIConfig['provider']))}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p, i) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {i === 0 ? ' — default' : i === 1 ? ' — second default' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model-select" className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            Model
          </label>
          <select
            id="model-select"
            value={selectValue}
            onChange={(e) => {
              if (e.target.value === '__custom') {
                setCustomFor(draft.provider)
                setDraft({ ...draft, model: known ? '' : draft.model })
              } else {
                setCustomFor(null)
                setDraft({ ...draft, model: e.target.value })
              }
            }}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-blue-500"
          >
            {meta.models.map((m, i) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {i === 0 ? ' — default' : ''}
              </option>
            ))}
            <option value="__custom">Custom model id…</option>
          </select>
          {custom && (
            <input
              type="text"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder={fallbackModel}
              aria-label="Custom model id"
              autoFocus
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500"
            />
          )}
        </div>

        {providerHasEffort(draft.provider) && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Thinking effort</span>
            <select
              value={draft.effort}
              onChange={(e) => setDraft({ ...draft, effort: e.target.value as AIConfig['effort'] })}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-blue-500"
            >
              {EFFORTS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] leading-relaxed text-zinc-500">
              {EFFORTS.find((e) => e.id === draft.effort)?.hint} Applies to Claude, GPT and other reasoning models.
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">API key</span>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder={meta.keyHint}
            autoComplete="off"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500"
          />
        </label>

        {meta.note && <p className="text-[11px] leading-relaxed text-amber-500/80">{meta.note}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(commitProfile(draft))}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Save configuration
          </button>
        </div>
      </div>
    </div>
  )
}
