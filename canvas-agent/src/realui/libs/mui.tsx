import { useEffect, type ElementType, type ReactNode } from 'react'
import * as Mui from '@mui/material'
import { fontStack, googleFontsHref } from '../../language'
import type { DesignFonts } from '../../ai'
import { Icon } from './icon'
import type { LoadedLibrary } from './types'

const M = Mui as unknown as Record<string, ElementType>
const NAMES = [
  'Button', 'IconButton', 'Chip', 'Avatar', 'Typography', 'Paper', 'Card', 'CardHeader', 'CardContent', 'CardActions', 'Alert', 'AlertTitle',
  'LinearProgress', 'CircularProgress', 'Switch', 'Checkbox', 'TextField', 'Divider', 'Skeleton', 'Tabs', 'Tab', 'Accordion',
  'AccordionSummary', 'AccordionDetails', 'TableContainer', 'Table', 'TableHead', 'TableBody', 'TableRow', 'TableCell',
] as const

const defaultTheme = Mui.createTheme() // the real default Material theme
const themes = new Map<string, ReturnType<typeof Mui.createTheme>>()

/** The Material theme, with the design's own fonts when it has them. */
function themeFor(fonts: DesignFonts | null | undefined) {
  if (!fonts) return defaultTheme
  const key = `${fonts.heading}|${fonts.body}`
  if (!themes.has(key)) {
    const heading = { fontFamily: fontStack(fonts.heading) }
    themes.set(
      key,
      Mui.createTheme({ typography: { fontFamily: fontStack(fonts.body), h1: heading, h2: heading, h3: heading, h4: heading, h5: heading, h6: heading } }),
    )
  }
  return themes.get(key)!
}

/** Material's type is Roboto. */
function useRoboto(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const href = googleFontsHref([{ role: 'body', family: 'Roboto', weights: [300, 400, 500, 700] }])
    if (!href || document.querySelector(`link[href="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [enabled])
}

function Provider({ children, fonts }: { children: ReactNode; fonts?: DesignFonts | null }) {
  useRoboto(!fonts)
  return <Mui.ThemeProvider theme={themeFor(fonts)}>{children}</Mui.ThemeProvider>
}

const lib: LoadedLibrary = { map: { ...Object.fromEntries(NAMES.map((n) => [n, M[n]])), Icon }, Provider }
export default lib
