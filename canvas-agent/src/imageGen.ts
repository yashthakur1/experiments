/* ================================================================== *
 *  Real pictures for image nodes, made by Gemini's image model with
 *  the user's own key. Only runs when the user clicks: each picture
 *  is billed by Google. The drawn scene (imageArt.ts) is the free
 *  default that shows without any click.
 * ================================================================== */

import type { AIConfig } from './ai'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type Aspect = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3'
const ASPECTS: [Aspect, number][] = [['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16], ['3:2', 3 / 2], ['2:3', 2 / 3]]

/** Tailwind size steps in px (w-80 = 320). */
const px = (n: number) => n * 4

/** The nearest supported aspect ratio for a node, read from its w-/h-/size- classes. */
export function aspectFromClasses(classes: string): Aspect {
  const size = /(?:^|\s)size-(\d+(?:\.\d+)?)(?=\s|$)/.exec(classes)
  if (size) return '1:1'
  const w = /(?:^|\s)w-(\d+(?:\.\d+)?)(?=\s|$)/.exec(classes)
  const h = /(?:^|\s)h-(\d+(?:\.\d+)?)(?=\s|$)/.exec(classes)
  if (w && h) {
    const ratio = px(Number(w[1])) / px(Number(h[1]))
    return ASPECTS.reduce((best, cur) => (Math.abs(Math.log(cur[1] / ratio)) < Math.abs(Math.log(best[1] / ratio)) ? cur : best))[0]
  }
  return /(?:^|\s)w-full(?=\s|$)/.test(classes) ? '16:9' : '4:3'
}

let modelPromise: Promise<string> | null = null

/** The newest Gemini model on this key that draws pictures. Cached for the session. */
function findImageModel(apiKey: string): Promise<string> {
  modelPromise ??= (async () => {
    const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } })
    if (!res.ok) throw new Error(`Gemini model list failed (${res.status}): ${(await res.text()).slice(0, 160)}`)
    const json = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
    const usable = (json.models ?? []).filter((m) => /image/i.test(m.name) && !/imagen/i.test(m.name) && m.supportedGenerationMethods?.includes('generateContent'))
    if (usable.length === 0) throw new Error('This Gemini key has no image model. Enable one in Google AI Studio, or keep the drawn pictures.')
    const flash = usable.filter((m) => /flash/i.test(m.name))
    return (flash.length ? flash : usable).map((m) => m.name.replace(/^models\//, '')).sort().reverse()[0]
  })().catch((e) => {
    modelPromise = null
    throw e
  })
  return modelPromise
}

/** Scales a picture down (long side ≤ 960px) and re-encodes it as JPEG, so a project stays small in localStorage. */
function shrink(dataUrl: string, maxSide = 960, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not shrink the picture'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('The picture from Gemini could not be read'))
    img.src = dataUrl
  })
}

export interface PictureRequest {
  /** What the picture shows. */
  prompt: string
  aspect: Aspect
  /** The design brief, so the picture matches the page. */
  context?: string
}

/** Makes one picture. Returns a small JPEG data URL. */
export async function generatePicture(config: AIConfig, req: PictureRequest, signal?: AbortSignal): Promise<string> {
  if (config.provider !== 'gemini') throw new Error('Real pictures use Gemini. Switch the provider to Gemini in settings, or keep the drawn pictures.')
  if (!config.apiKey.trim()) throw new Error('Add your Gemini key in settings first.')
  const model = await findImageModel(config.apiKey)
  const text = `${req.prompt}. ${req.context ? `It is for a website: ${req.context}. ` : ''}Photographic or illustrative, well composed, natural light. No text, no letters, no logos, no watermarks.`
  const body = (withAspect: boolean) =>
    JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(withAspect ? { imageConfig: { aspectRatio: req.aspect } } : {}) },
    })
  const call = (withAspect: boolean) =>
    fetch(`${BASE}/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey }, body: body(withAspect), signal })
  let res = await call(true)
  if (res.status === 400) res = await call(false) // some models do not take an aspect ratio
  if (!res.ok) throw new Error(`Gemini image error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }[] } }[] }
  const parts = json.candidates?.[0]?.content?.parts ?? []
  const inline = parts.map((p) => p.inlineData ?? (p.inline_data ? { mimeType: p.inline_data.mime_type, data: p.inline_data.data } : undefined)).find((d) => d?.data)
  if (!inline?.data) {
    const said = parts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 160)
    throw new Error(`Gemini returned no picture${said ? `: ${said}` : ' (a safety filter may have blocked it)'}`)
  }
  return shrink(`data:${inline.mimeType ?? 'image/png'};base64,${inline.data}`)
}
