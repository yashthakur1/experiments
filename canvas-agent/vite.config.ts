import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// OpenCode Zen sends no CORS headers on its inference routes, so the browser
// cannot call it directly. Dev and preview servers forward /zen-proxy/* to it.
const zenProxy = {
  '/zen-proxy': {
    target: 'https://opencode.ai',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/zen-proxy/, '/zen'),
  },
}

// Mirrors the browser's [canvas-agent] diagnostics into the dev-server terminal,
// so a stalled or failing generation is visible without opening DevTools.
function agentLog(): Plugin {
  const color = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' } as const
  return {
    name: 'agent-log',
    configureServer(server) {
      server.middlewares.use('/__agent-log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          if (body.length < 20_000) body += chunk
        })
        req.on('end', () => {
          try {
            const { level, scope, msg } = JSON.parse(body) as { level: keyof typeof color; scope: string; msg: string }
            const time = new Date().toISOString().slice(11, 23)
            const tone = color[level] ?? color.info
            server.config.logger.info(`${tone}[agent]\x1b[0m \x1b[2m${time}\x1b[0m ${scope} — ${msg}`, { timestamp: false })
          } catch {
            /* ignore malformed log lines */
          }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), agentLog()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: zenProxy },
  preview: { proxy: zenProxy },
})
