import { defineConfig } from 'vite'
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: zenProxy },
  preview: { proxy: zenProxy },
})
