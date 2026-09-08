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

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  layout: PageLayout,
  zoom: number,
): Promise<RenderTask> {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const viewport = page.getViewport({ scale: zoom * dpr })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${Math.floor(layout.width * zoom)}px`
  canvas.style.height = `${Math.floor(layout.height * zoom)}px`
  const task = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport })
  await task.promise
  return task
}
