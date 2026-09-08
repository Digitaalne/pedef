/**
 * Cross-checks our hand-rolled display↔user mapping against pdf.js's own
 * viewport transform (convertToPdfPoint), which is authoritative.
 *
 * Generates a test PDF with pdf-lib (normal and rotated pages), opens it with
 * pdf.js in Node (legacy build), and compares the two mappings.
 */
import { describe, expect, it } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'
import { displayToUser, type Rotation } from './coordinates'

const W = 400
const H = 300

async function makePdf(rotation: Rotation): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([W, H])
  page.setRotation(degrees(rotation))
  return doc.save()
}

describe.concurrent.each([0, 90, 180, 270] as Rotation[])('pdf.js cross-check (rotation %i)', (rotation) => {
  it('displayToUser matches pdf.js convertToPdfPoint', async () => {
    const bytes = await makePdf(rotation)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })

    for (const [dx, dy] of [
      [0, 0],
      [100, 50],
      [199, 299],
      [42.5, 17.25],
    ] as const) {
      const mine = displayToUser(W, H, rotation, dx, dy)
      const [px, py] = viewport.convertToPdfPoint(dx, dy)
      expect(mine.x).toBeCloseTo(px, 5)
      expect(mine.y).toBeCloseTo(py, 5)
    }
  })

  it('display size matches pdf.js viewport', async () => {
    const bytes = await makePdf(rotation)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    expect(viewport.width).toBeCloseTo(rotation === 90 || rotation === 270 ? H : W, 5)
    expect(viewport.height).toBeCloseTo(rotation === 90 || rotation === 270 ? W : H, 5)
  })
})
