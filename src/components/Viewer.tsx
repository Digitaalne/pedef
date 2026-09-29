import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

/** A page box in scroll-content coordinates (stable across scrolling). */
type PageGeom = { left: number; top: number; width: number; height: number }

/**
 * Where a zoom is anchored: a fractional position inside one page (fractions
 * are zoom-invariant) — the cursor position for wheel zoom, the viewport
 * center for toolbar/keyboard zoom. `index: -1` means "no adjustment".
 */
type ZoomAnchor = { index: number; fx: number; fy: number }

export function Viewer() {
  const pdf = useEditor((s) => s.pdf)!
  const zoom = useEditor((s) => s.zoom)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<ZoomAnchor | null>(null)
  // page geometry as of the last committed zoom, used as the pre-zoom reference
  const geomRef = useRef<{ zoom: number; pages: PageGeom[] } | null>(null)

  // Ctrl/Cmd + wheel (also trackpad pinch) zooms around the cursor
  useEffect(() => {
    const scroll = scrollRef.current
    const pages = pagesRef.current
    if (!scroll || !pages) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      // Capture the anchor BEFORE setZoom: the store update may flush the
      // React render synchronously, so the layout effect must see it already.
      const frame = (e.target as HTMLElement).closest?.('.page-frame')
      const index = frame ? Array.prototype.indexOf.call(pages.children, frame) : -1
      if (index < 0) {
        anchorRef.current = { index: -1, fx: 0, fy: 0 }
      } else {
        const r = (frame as HTMLElement).getBoundingClientRect()
        anchorRef.current = { index, fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height }
      }
      const st = useEditor.getState()
      // deltaMode 1 = lines (Firefox), 0 = pixels; exp() keeps steps proportional
      st.setZoom(st.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002)))
      // state snapshots are immutable: re-read to tell whether zoom was clamped
      if (useEditor.getState().zoom === st.zoom) anchorRef.current = null // no render will consume the anchor
    }
    scroll.addEventListener('wheel', onWheel, { passive: false })
    return () => scroll.removeEventListener('wheel', onWheel)
  }, [])

  // new document: forget old geometry, start at the top (declared before the
  // zoom effect below so a document change never anchors against stale rects)
  useLayoutEffect(() => {
    geomRef.current = null
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [pdf])

  // After a zoom change, scroll so the anchored content point stays where it
  // was on screen; then remember the geometry for the next zoom.
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const pages = pagesRef.current
    if (!scroll || !pages) return
    const prev = geomRef.current
    if (prev && prev.zoom !== zoom && prev.pages.length === pages.children.length) {
      let anchor = anchorRef.current
      anchorRef.current = null
      if (!anchor) {
        // toolbar/keyboard zoom: anchor at the viewport center
        const docX = scroll.scrollLeft + scroll.clientWidth / 2
        const docY = scroll.scrollTop + scroll.clientHeight / 2
        anchor = centerAnchor(prev.pages, docX, docY)
      }
      const g = prev.pages[anchor.index]
      const frame = g ? (pages.children[anchor.index] as HTMLElement) : null
      if (g && frame) {
        // scroll by the anchored point's displacement in viewport coordinates
        const r = frame.getBoundingClientRect()
        const sRect = scroll.getBoundingClientRect()
        scroll.scrollLeft += r.left - sRect.left + anchor.fx * r.width - (g.left - scroll.scrollLeft + anchor.fx * g.width)
        scroll.scrollTop += r.top - sRect.top + anchor.fy * r.height - (g.top - scroll.scrollTop + anchor.fy * g.height)
      }
    }
    geomRef.current = { zoom, pages: measurePages(scroll, pages) }
  }, [zoom])

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div className="viewer" id="viewer-scroll" ref={scrollRef}>
      <div className="pages" ref={pagesRef}>
        {pdf.pages.map((layout) => (
          <PageView key={layout.index} layout={layout} />
        ))}
      </div>
    </div>
  )
}

function measurePages(scroll: HTMLDivElement, pages: HTMLDivElement): PageGeom[] {
  const sRect = scroll.getBoundingClientRect()
  return Array.from(pages.children, (el) => {
    const r = (el as HTMLElement).getBoundingClientRect()
    return {
      left: r.left - sRect.left + scroll.scrollLeft,
      top: r.top - sRect.top + scroll.scrollTop,
      width: r.width,
      height: r.height,
    }
  })
}

/** Anchor for the viewport center: the page under it (or the nearest one). */
function centerAnchor(pages: PageGeom[], docX: number, docY: number): ZoomAnchor {
  let best = 0
  let bestDist = Infinity
  pages.forEach((g, i) => {
    const dy = docY < g.top ? g.top - docY : docY > g.top + g.height ? docY - g.top - g.height : 0
    if (dy < bestDist) {
      bestDist = dy
      best = i
    }
  })
  const g = pages[best]
  return {
    index: best,
    fx: g.width > 0 ? (docX - g.left) / g.width : 0,
    fy: g.height > 0 ? (docY - g.top) / g.height : 0,
  }
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
        // store the task before awaiting so cleanup can cancel an in-flight render
        const task = renderPageToCanvas(page, canvasRef.current, zoom)
        renderTaskRef.current = task
        await task.promise
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
