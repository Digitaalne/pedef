/**
 * pdf.js document loading and page rendering.
 * Everything happens in the browser; the file is never sent anywhere.
 */
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { displaySize, normalizeRotation, type Rotation } from './coordinates'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PageLayout = {
  index: number
  /** displayed width/height in PDF points (rotation applied) */
  width: number
  height: number
  /** raw page size in points (as stored in the PDF) */
  rawWidth: number
  rawHeight: number
  rotation: Rotation
}

export type LoadedPdf = {
  doc: PDFDocumentProxy
  fileName: string
  /** untouched original file bytes, used for export */
  bytes: ArrayBuffer
  pages: PageLayout[]
}

export async function openPdf(file: File): Promise<LoadedPdf> {
  const bytes = await file.arrayBuffer()
  // pdf.js may transfer/detach the buffer to the worker, so hand it a copy
  const view = bytes.slice(0)
  const doc = await pdfjs.getDocument({ data: view }).promise

  const pages: PageLayout[] = []
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const rotation = normalizeRotation(page.rotate)
    const rawWidth = page.view[2] - page.view[0]
    const rawHeight = page.view[3] - page.view[1]
    const size = displaySize(rawWidth, rawHeight, rotation)
    pages.push({
      index: i,
      width: size.width,
      height: size.height,
      rawWidth,
      rawHeight,
      rotation,
    })
  }
  return { doc, fileName: file.name, bytes, pages }
}

export function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  zoom: number,
): RenderTask {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const viewport = page.getViewport({ scale: zoom * dpr })
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = `${viewport.width / dpr}px`
  canvas.style.height = `${viewport.height / dpr}px`
  // Return the task immediately so callers can cancel an in-flight render;
  // awaiting here would make cancellation a no-op and two render tasks would
  // paint the same canvas concurrently, producing artifacts near glyphs.
  return page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport })
}
