/* App theme: dark (default) or light (cream / egg-white). Applied as data-theme on <html>.
   The palette itself lives in index.css. */

export type Theme = 'dark' | 'light'

const KEY = 'canvas-agent-theme'

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark' // storage blocked: fall back without failing
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* the theme still applies for this session */
  }
}
