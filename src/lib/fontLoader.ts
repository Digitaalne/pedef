/**
 * Lazy web-font loading. Fonts are registered with the browser's FontFace API
 * only when actually needed (a text element using them, the stamp dialog,
 * etc.), and the text-metric caches are flushed afterwards.
 */
import { getFont } from './fonts'
import { clearMetricsCache } from './metrics'

const pending = new Map<string, Promise<void>>()

export function ensureFontFace(fontId: string): Promise<void> {
  const face = getFont(fontId)
  const key = `${face.cssFamily}@${face.weight}@${face.style}`
  let p = pending.get(key)
  if (!p) {
    p = new FontFace(face.cssFamily, `url(${face.url})`, {
      weight: String(face.weight),
      style: face.style,
    })
      .load()
      .then((ff) => {
        document.fonts.add(ff)
        clearMetricsCache()
      })
      .catch((e) => {
        console.warn(`Font "${face.label}" failed to load, falling back to system font`, e)
      })
    pending.set(key, p)
  }
  return p
}

export function ensureFonts(fontIds: string[]): Promise<void> {
  return Promise.all(fontIds.map(ensureFontFace)).then(() => undefined)
}
