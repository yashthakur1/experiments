/* ================================================================== *
 *  Diagnostics — one place for everything the model layer reports.
 *
 *  - Browser console: every entry, prefixed [canvas-agent].
 *  - Dev-server terminal: the same entries, forwarded to /__agent-log
 *    (see the agentLog plugin in vite.config.ts). Only in `vite dev`.
 *  - UI: subscribers (the canvas pages) turn `ui` entries into feed rows.
 *
 *  Never pass API keys or prompt text in here — only status, timing and sizes.
 * ================================================================== */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  /** e.g. "zen · claude-sonnet-5" */
  scope: string
  msg: string
  /**
   * 'step' adds a row to the agent feed; 'tick' updates the note on the
   * active row in place (elapsed time, chars received, …).
   */
  ui?: 'step' | 'tick'
}

const listeners = new Set<(entry: LogEntry) => void>()

export function subscribeLog(fn: (entry: LogEntry) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const stamp = () => new Date().toISOString().slice(11, 23)

function toTerminal(entry: LogEntry) {
  if (!import.meta.env.DEV) return
  fetch('/__agent-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => {
    /* the terminal mirror is best-effort */
  })
}

export function log(level: LogLevel, scope: string, msg: string, ui?: LogEntry['ui']) {
  const entry: LogEntry = { level, scope, msg, ui }
  const method = level === 'info' ? 'log' : level
  console[method](`%c[canvas-agent]%c ${stamp()} ${scope} — ${msg}`, 'color:#d946ef;font-weight:600', 'color:inherit')
  toTerminal(entry)
  listeners.forEach((fn) => fn(entry))
}

/** Progress for the UI only: too chatty for the console or the terminal. */
export function tick(scope: string, msg: string) {
  const entry: LogEntry = { level: 'info', scope, msg, ui: 'tick' }
  listeners.forEach((fn) => fn(entry))
}
