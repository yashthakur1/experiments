import { useEffect, type ElementType, type ReactNode } from 'react'
import * as Mui from '@mui/material'
import { googleFontsHref } from '../../language'
import { Icon } from './icon'
import type { LoadedLibrary } from './types'

const M = Mui as unknown as Record<string, ElementType>
const NAMES = [
  'Button', 'IconButton', 'Chip', 'Avatar', 'Typography', 'Paper', 'Card', 'CardHeader', 'CardContent', 'CardActions', 'Alert', 'AlertTitle',
  'LinearProgress', 'CircularProgress', 'Switch', 'Checkbox', 'TextField', 'Divider', 'Skeleton', 'Tabs', 'Tab', 'Accordion',
  'AccordionSummary', 'AccordionDetails', 'TableContainer', 'Table', 'TableHead', 'TableBody', 'TableRow', 'TableCell',
] as const

const theme = Mui.createTheme() // the real default Material theme

/** Material's type is Roboto. */
function useRoboto() {
  useEffect(() => {
    const href = googleFontsHref([{ role: 'body', family: 'Roboto', weights: [300, 400, 500, 700] }])
    if (!href || document.querySelector(`link[href="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [])
}

function Provider({ children }: { children: ReactNode }) {
  useRoboto()
  return <Mui.ThemeProvider theme={theme}>{children}</Mui.ThemeProvider>
}

const lib: LoadedLibrary = { map: { ...Object.fromEntries(NAMES.map((n) => [n, M[n]])), Icon }, Provider }
export default lib
