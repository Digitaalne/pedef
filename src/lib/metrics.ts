/**
 * Text metrics via canvas measureText. Display rendering and PDF export both
 * use these numbers, so baselines and line spacing stay consistent between
 * preview and output. Units follow whatever size is passed in (we always pass
 * PDF points).
 */
import { fontCss, getFont } from './fonts'

export type FontMetrics = { ascent: number; descent: number }

let ctx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')!
  }
  return ctx
}

const metricsCache = new Map<string, FontMetrics>()

export function measureFont(fontId: string, size: number): FontMetrics {
  const key = `${fontId}@${size}`
  const hit = metricsCache.get(key)
  if (hit) return hit

  const face = getFont(fontId)
  const c = getCtx()
  c.font = fontCss(face, size)
  const m = c.measureText('Mgjpqy')
  let metrics: FontMetrics
  if (m.fontBoundingBoxAscent != null && m.fontBoundingBoxDescent != null) {
    metrics = { ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent }
  } else {
    metrics = { ascent: size * 0.8, descent: size * 0.2 }
  }
  metricsCache.set(key, metrics)
  return metrics
}

const widthCache = new Map<string, number>()

/** Advance width of a single line of text, in the same units as `size`. */
export function measureTextWidth(fontId: string, size: number, text: string): number {
  const key = `${fontId}@${size}@${text}`
  const hit = widthCache.get(key)
  if (hit != null) return hit

  const face = getFont(fontId)
  const c = getCtx()
  c.font = fontCss(face, size)
  const w = c.measureText(text).width
  widthCache.set(key, w)
  return w
}

export function clearMetricsCache() {
  metricsCache.clear()
  widthCache.clear()
}
