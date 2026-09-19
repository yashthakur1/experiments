import { useState } from 'react'
import { PROVIDERS, providerMeta, type AIConfig } from './ai'

interface ConfigModalProps {
  config: AIConfig
  onSave: (next: AIConfig) => void
  onClose: () => void
}

export function ConfigModal({ config, onSave, onClose }: ConfigModalProps) {
  const [draft, setDraft] = useState<AIConfig>(config)
  const meta = providerMeta(draft.provider)

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
            onChange={(e) => setDraft({ ...draft, provider: e.target.value as AIConfig['provider'], model: '' })}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Model</span>
          <input
            type="text"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            placeholder={meta.defaultModel || 'model id'}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500"
          />
        </label>

        {meta.needsBaseUrl && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Base URL (OpenAI-compatible)</span>
            <input
              type="text"
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              placeholder={meta.defaultBaseUrl}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500"
            />
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
            onClick={() => onSave(draft)}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Save configuration
          </button>
        </div>
      </div>
    </div>
  )
}
