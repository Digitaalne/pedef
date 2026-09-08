/**
 * Export: rebuild the PDF with placed text (real, selectable text) and stamp
 * images using pdf-lib, then trigger a download. Runs fully client-side.
 */
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import type { EditorElement, TextElement } from '../types'
import { displayToUser, normalizeRotation } from './coordinates'
import { getFont, loadFontBytes, type FontFace } from './fonts'
import { measureFont, type FontMetrics } from './metrics'

export const LINE_HEIGHT_FACTOR = 1.35

export type BuildOptions = {
  /** fetches raw TTF bytes for a face (injectable for tests) */
  fontLoader?: (face: FontFace) => Promise<Uint8Array>
  /** font metrics provider (injectable for tests) */
  metrics?: (fontId: string, size: number) => FontMetrics
  onProgress?: (done: number, total: number) => void
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = parseInt(m[1], 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

export async function buildPdf(
  originalBytes: ArrayBuffer,
  elements: EditorElement[],
  opts: BuildOptions = {},
): Promise<Uint8Array> {
  const fontLoader: (face: FontFace) => Promise<Uint8Array> =
    opts.fontLoader ?? ((face) => loadFontBytes(face.url))
  const metrics = opts.metrics ?? measureFont
  const onProgress = opts.onProgress

  const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true })
  doc.registerFontkit(fontkit)

  const embeddedFonts = new Map<string, Awaited<ReturnType<typeof doc.embedFont>>>()
  const pages = doc.getPages()

  const textElements = elements.filter((e): e is TextElement => e.kind === 'text')
  for (const el of textElements) {
    const face = getFont(el.fontId)
    if (!embeddedFonts.has(face.id)) {
      const bytes = await fontLoader(face)
      embeddedFonts.set(face.id, await doc.embedFont(bytes, { subset: true }))
    }
  }

  let done = 0
  const total = elements.length
  for (const el of elements) {
    const page = pages[el.pageIndex]
    if (!page) continue
    const crop = page.getCropBox()
    const rotation = normalizeRotation(page.getRotation().angle)
    // pdf.js display space is crop-box relative; pdf-lib draws in absolute user space
    const toUser = (dx: number, dy: number) => {
      const p = displayToUser(crop.width, crop.height, rotation, dx, dy)
      return { x: p.x + crop.x, y: p.y + crop.y }
    }

    if (el.kind === 'text') {
      const font = embeddedFonts.get(el.fontId)!
      const lines = el.text.split('\n')
      const { r, g, b } = hexToRgb(el.color)
      const { ascent, descent } = metrics(el.fontId, el.size)
      const lineHeight = el.size * LINE_HEIGHT_FACTOR
      const firstBaseline = (lineHeight - (ascent + descent)) / 2 + ascent
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length === 0) continue
        const baselineY = el.y + firstBaseline + i * lineHeight
        const p = toUser(el.x, baselineY)
        page.drawText(lines[i], {
          x: p.x,
          y: p.y,
          size: el.size,
          font,
          color: rgb(r, g, b),
          rotate: degrees(rotation),
        })
      }
    } else {
      const image = await doc.embedPng(el.dataUrl)
      const p = toUser(el.x, el.y + el.height)
      page.drawImage(image, {
        x: p.x,
        y: p.y,
        width: el.width,
        height: el.height,
        rotate: degrees(rotation),
        opacity: el.opacity,
      })
    }
    done++
    onProgress?.(done, total)
  }

  return doc.save({ useObjectStreams: false })
}

export function downloadBlob(data: BlobPart, fileName: string, mime: string): void {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function editedFileName(originalName: string): string {
  const base = originalName.replace(/\.pdf$/i, '')
  return `${base}-edited.pdf`
}
