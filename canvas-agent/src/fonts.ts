import { useEffect } from 'react'
import { catalogFont, fontStack, googleFontsHref } from './language'
import type { DesignFonts } from './ai'

/** Loads Google Fonts for these families (once each) while a design that uses them is on screen. */
export function useGoogleFonts(families: (string | undefined)[]) {
  const key = families.filter(Boolean).join('|')
  useEffect(() => {
    const list = key ? key.split('|') : []
    const href = googleFontsHref(list.filter((f) => catalogFont(f)).map((family) => ({ role: 'body', family, weights: [300, 400, 500, 600, 700, 800] })))
    if (!href || document.querySelector(`link[href="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [key])
}

/** Text at these sizes is a heading: it gets the heading font. */
const HEADING_SIZE = /(?:^|\s)text-(?:2xl|3xl|4xl|5xl|6xl|7xl)(?:\s|$)/
export const isHeadingText = (classes: string) => HEADING_SIZE.test(classes)

export const bodyStack = (fonts: DesignFonts | null | undefined) => (fonts ? fontStack(fonts.body) : undefined)
export const headingStack = (fonts: DesignFonts | null | undefined) => (fonts ? fontStack(fonts.heading) : undefined)
