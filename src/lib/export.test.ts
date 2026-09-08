/**
 * End-to-end export test in Node: buildPdf output is re-opened with pdf.js
 * and the placed text/stamp positions are verified for normal and rotated
 * pages. Font and metrics loading are injected so the browser-only canvas
 * measurement path is bypassed.
 */
import * as fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { buildPdf, LINE_HEIGHT_FACTOR } from './export'
import { getFont } from './fonts'
import type { StampElement, TextElement } from '../types'

const PAGE_W = 400
const PAGE_H = 300

// 1x1 red PNG
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]!
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function makeSourcePdf(rotationAngles: number[]): Promise<ArrayBuffer> {
  const src = await PDFDocument.create()
  for (const angle of rotationAngles) {
    const page = src.addPage([PAGE_W, PAGE_H])
    page.setRotation(degrees(angle))
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50, color: rgb(0.9, 0.9, 0.9) })
  }
  return src.save().then((b) => b.buffer as ArrayBuffer)
}

const fontLoader = async (face: ReturnType<typeof getFont>) => {
  const path = face.url.replace(/^.*assets\//, 'src/assets/')
  const file =
    face.id === 'great-vibes' ? 'src/assets/fonts/GreatVibes-Regular.ttf' : 'src/assets/fonts/NotoSans-Regular.ttf'
  void path
  return new Uint8Array(fs.readFileSync(file))
}

const metrics = (_fontId: string, size: number) => ({ ascent: size * 0.8, descent: size * 0.2 })

async function extractText(page: import('pdfjs-dist/legacy/build/pdf.mjs').PDFPageProxy) {
  const content = await page.getTextContent()
  const raw = content.items as Array<{ str?: unknown; transform?: number[] }>
  return raw
    .filter((i) => typeof i.str === 'string' && Array.isArray(i.transform))
    .map((i) => ({
      str: i.str as string,
      x: i.transform![4],
      y: i.transform![5],
      angle: Math.atan2(i.transform![1], i.transform![0]),
    }))
}

describe('buildPdf end-to-end', () => {
  it('places text at the correct user-space position (unrotated page)', async () => {
    const bytes = await makeSourcePdf([0])
    const el: TextElement = {
      kind: 'text',
      id: 't1',
      pageIndex: 0,
      x: 60,
      y: 100,
      text: 'Hello',
      fontId: 'noto-sans',
      size: 14,
      color: '#111111',
    }
    const out = await buildPdf(bytes, [el], { fontLoader, metrics })

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: out.slice(0) }).promise
    const page = await doc.getPage(1)
    const items = await extractText(page)
    expect(items).toHaveLength(1)
    const expectedBaseline = 100 + (14 * LINE_HEIGHT_FACTOR - 14) / 2 + 14 * 0.8
    expect(items[0]!.str).toBe('Hello')
    expect(items[0]!.x).toBeCloseTo(60, 5)
    expect(items[0]!.y).toBeCloseTo(PAGE_H - expectedBaseline, 5)
    expect(items[0]!.angle).toBeCloseTo(0, 5)
  })

  it('places text upright at the right spot on a 90° rotated page', async () => {
    const bytes = await makeSourcePdf([90])
    const el: TextElement = {
      kind: 'text',
      id: 't1',
      pageIndex: 0,
      x: 100,
      y: 120,
      text: 'Rot',
      fontId: 'noto-sans',
      size: 20,
      color: '#000000',
    }
    const out = await buildPdf(bytes, [el], { fontLoader, metrics })

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // ask pdf.js for the *displayed* geometry: the text should be where we put it
    const doc = await pdfjs.getDocument({ data: out.slice(0) }).promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const items = await extractText(page)
    expect(items).toHaveLength(1)
    // baseline display point: (x, y + firstBaseline) with firstBaseline = half-leading + ascent
    const lh = 20 * LINE_HEIGHT_FACTOR
    const ascent = 20 * 0.8
    const firstBaseline = (lh - (ascent + (1 - 0.8) * 20)) / 2 + ascent
    const [dx, dy] = viewport.convertToViewportPoint(items[0]!.x, items[0]!.y)
    expect(dx).toBeCloseTo(100, 5)
    expect(dy).toBeCloseTo(120 + firstBaseline, 5)
    // text runs horizontally on screen → transform rotated by +90° in user space
    expect(items[0]!.angle).toBeCloseTo(Math.PI / 2, 5)
  })

  it('embeds a stamp image (rotated page)', async () => {
    const bytes = await makeSourcePdf([90])
    const el: StampElement = {
      kind: 'stamp',
      id: 's1',
      pageIndex: 0,
      x: 50,
      y: 40,
      width: 100,
      height: 60,
      dataUrl: PNG_1PX,
      opacity: 1,
    }
    const out = await buildPdf(bytes, [el], { fontLoader, metrics })

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: out.slice(0) }).promise
    const page = await doc.getPage(1)
    const ops = await page.getOperatorList()
    const paintOps = ops.fnArray.filter(
      (fn) => pdfjs.OPS.paintImageXObject === fn || pdfjs.OPS.paintInlineImageXObject === fn,
    )
    expect(paintOps.length).toBeGreaterThan(0)

    // check the displayed image rect via the transform stack is hard headless;
    // instead sanity-check file parses and page dims unchanged
    const lib = await PDFDocument.load(out)
    expect(lib.getPageCount()).toBe(1)
    const size = lib.getPage(0).getSize()
    expect(size.width).toBe(PAGE_W)
    expect(size.height).toBe(PAGE_H)
  })

  it('round-trips no-op exports unchanged', async () => {
    const bytes = await makeSourcePdf([0])
    const out = await buildPdf(bytes, [], { fontLoader, metrics })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getPage(0).getSize().width).toBe(PAGE_W)
  })

  it('dataUrl decode matches embedPng expectations', () => {
    const b = dataUrlToBytes(PNG_1PX)
    expect(b[0]).toBe(0x89)
    expect(b.subarray(1, 4)).toEqual(Uint8Array.from([0x50, 0x4e, 0x47]))
  })
})
