/**
 * Stamp persistence (localStorage) + helpers to turn drawings/typed text into
 * tightly-cropped transparent PNG data URLs.
 */
import { getFont } from './fonts'
import { ensureFontFace } from './fontLoader'
import type { Stamp } from '../types'

const KEY = 'pdfstamp.stamps.v1'
const LAST_FONT_KEY = 'pdfstamp.lastSignatureFont'

/**
 * Raster density for captured stamps: 300/72 pixels per point ≈ 300 DPI.
 * Export embeds the PNG bytes 1:1 (pdf-lib never re-encodes them), so this is
 * the print quality of every stamp.
 */
export const STAMP_CAPTURE_SCALE = 300 / 72

export function loadStamps(): Stamp[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Stamp[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStamps(stamps: Stamp[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stamps))
  } catch (e) {
    // most likely quota exceeded with huge stamps
    console.error('Failed to persist stamps', e)
    throw e
  }
}

export function loadLastSignatureFontId(): string | null {
  try {
    return localStorage.getItem(LAST_FONT_KEY)
  } catch {
    return null
  }
}

export function saveLastSignatureFontId(fontId: string): void {
  try {
    localStorage.setItem(LAST_FONT_KEY, fontId)
  } catch {
    // ignore persistence failures for this preference
  }
}

/** Remove fully transparent margins so stamps place without dead space. */
export function trimCanvas(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; width: number; height: number } {
  const c = canvas.getContext('2d')!
  const { width, height } = canvas
  let minX = width, minY = height, maxX = -1, maxY = -1
  if (width > 0 && height > 0) {
    const data = c.getImageData(0, 0, width, height).data
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] !== 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
  }
  if (maxX < 0) return { canvas, width: canvas.width, height: canvas.height }
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h)
  return { canvas: out, width: w, height: h }
}

/**
 * Render typed signature text onto a transparent canvas at the given pixel
 * scale (for crisp output when the stamp is scaled in the PDF).
 */
export async function renderTypedStamp(
  text: string,
  fontId: string,
  sizePx: number,
  color: string,
  scale = STAMP_CAPTURE_SCALE,
): Promise<{ dataUrl: string; width: number; height: number }> {
  await ensureFontFace(fontId)
  const face = getFont(fontId)
  const canvas = document.createElement('canvas')
  const c = canvas.getContext('2d')!
  c.font = `${face.style} ${face.weight} ${sizePx * scale}px "${face.cssFamily}"`
  const m = c.measureText(text)
  const ascent = m.fontBoundingBoxAscent ?? sizePx * scale * 0.8
  const descent = m.fontBoundingBoxDescent ?? sizePx * scale * 0.2
  canvas.width = Math.max(1, Math.ceil(m.width + sizePx * scale * 0.2))
  canvas.height = Math.max(1, Math.ceil(ascent + descent + sizePx * scale * 0.2))
  const c2 = canvas.getContext('2d')!
  c2.font = `${face.style} ${face.weight} ${sizePx * scale}px "${face.cssFamily}"`
  c2.fillStyle = color
  c2.textBaseline = 'alphabetic'
  c2.fillText(text, (sizePx * scale * 0.2) / 2, ascent + (sizePx * scale * 0.2) / 2)
  const trimmed = trimCanvas(canvas)
  return {
    dataUrl: trimmed.canvas.toDataURL('image/png'),
    width: trimmed.width / scale,
    height: trimmed.height / scale,
  }
}
