import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../state/store'
import type { PageLayout } from '../lib/pdf'
import { renderPageToCanvas } from '../lib/pdf'
import { TextElementView } from './TextElementView'
import { StampElementView } from './StampElementView'
import type { EditorElement, Stamp } from '../types'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'

/** Default max width (in points) a stamp is placed with. */
export const STAMP_PLACE_WIDTH = 200

export function stampPlacementSize(stamp: Stamp): { width: number; height: number } {
  const width = Math.min(stamp.width, STAMP_PLACE_WIDTH)
  return { width, height: stamp.height * (width / stamp.width) }
}

export function Viewer() {
  const pdf = useEditor((s) => s.pdf)!

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div className="viewer" id="viewer-scroll">
      <div className="pages">
        {pdf.pages.map((layout) => (
          <PageView key={layout.index} layout={layout} />
        ))}
      </div>
    </div>
  )
}

function PageView({ layout }: { layout: PageLayout }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const nearViewport = useNearViewport(frameRef)
  const s = useEditor()
  const pageIndex = layout.index
  const zoom = s.zoom

  // lazily render the page raster when near the viewport
  useEffect(() => {
    if (!nearViewport) return
    let cancelled = false
    const run = async () => {
      const doc = useEditor.getState().pdf?.doc
      if (!doc || !canvasRef.current) return
      try {
        const page: PDFPageProxy = await doc.getPage(pageIndex + 1)
        if (cancelled) return
        renderTaskRef.current = await renderPageToCanvas(page, canvasRef.current, layout, zoom)
      } catch (e) {
        if (!cancelled && (e as { name?: string }).name !== 'RenderingCancelledException') {
          console.error(`Failed to render page ${pageIndex + 1}`, e)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [nearViewport, zoom, pageIndex, layout])

  const pageElements: EditorElement[] = s.elements.filter((el) => el.pageIndex === pageIndex)
  const placingText = s.tool.mode === 'place-text'
  const tool = s.tool
  const stamp = tool.mode === 'place-stamp' ? s.stamps.find((st) => st.id === tool.stampId) ?? null : null
  const placingStamp = tool.mode === 'place-stamp' && !!stamp

  return (
    <div
      className="page-frame"
      ref={frameRef}
      style={{ width: layout.width * zoom, height: layout.height * zoom }}
    >
      {nearViewport ? (
        <canvas ref={canvasRef} className="page-canvas" />
      ) : (
        <div className="page-placeholder" />
      )}
      <div
        className={`page-overlay ${placingText ? 'cursor-crosshair' : ''} ${placingStamp ? 'cursor-copy' : ''}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left) / zoom
          const y = (e.clientY - rect.top) / zoom
          if (s.tool.mode === 'place-text') {
            s.addText(pageIndex, x, y)
          } else if (s.tool.mode === 'place-stamp' && stamp) {
            const size = stampPlacementSize(stamp)
            s.addStamp(stamp, pageIndex, x, y, size.width, size.height)
          } else {
            s.setSelection(null)
            s.setEditing(null)
          }
        }}
        onDoubleClick={(e) => {
          if (s.tool.mode !== 'select') return
          const rect = e.currentTarget.getBoundingClientRect()
          s.addText(pageIndex, (e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom)
        }}
      >
        {pageElements.map((el) =>
          el.kind === 'text' ? (
            <TextElementView key={el.id} el={el} zoom={zoom} />
          ) : (
            <StampElementView key={el.id} el={el} zoom={zoom} />
          ),
        )}
        {placingStamp && stamp && <GhostStamp stamp={stamp} zoom={zoom} />}
      </div>
    </div>
  )
}

function GhostStamp({ stamp, zoom }: { stamp: Stamp; zoom: number }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const { width, height } = stampPlacementSize(stamp)
    const w = width * zoom
    const h = height * zoom
    const onMove = (e: PointerEvent) => {
      const rect = frame.getBoundingClientRect()
      const ghost = ghostRef.current
      if (!ghost) return
      ghost.hidden = false
      ghost.style.left = `${e.clientX - rect.left - w / 2}px`
      ghost.style.top = `${e.clientY - rect.top - h / 2}px`
    }
    const onLeave = () => {
      if (ghostRef.current) ghostRef.current.hidden = true
    }
    frame.addEventListener('pointermove', onMove)
    frame.addEventListener('pointerleave', onLeave)
    return () => {
      frame.removeEventListener('pointermove', onMove)
      frame.removeEventListener('pointerleave', onLeave)
    }
  }, [stamp, zoom])

  const { width, height } = stampPlacementSize(stamp)
  return (
    <div ref={frameRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <img
        ref={ghostRef}
        hidden
        src={stamp.dataUrl}
        className="ghost-stamp"
        style={{ width: width * zoom, height: height * zoom }}
        alt=""
      />
    </div>
  )
}

/** True while the element is close enough to the viewport to need its raster. */
function useNearViewport(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setNear(entry.isIntersecting)
      },
      { root: document.getElementById('viewer-scroll'), rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return near
}
