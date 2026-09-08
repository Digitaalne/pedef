import { useEffect, useRef, useState } from 'react'
import { getFont, signatureFontsOrdered } from '../lib/fonts'
import { ensureFonts } from '../lib/fontLoader'
import { loadLastSignatureFontId, renderTypedStamp, saveLastSignatureFontId, STAMP_CAPTURE_SCALE, trimCanvas } from '../lib/stamps'
import { useEditor } from '../state/store'
import { IconClose } from './Icons'
import type { Stamp } from '../types'

type Point = { x: number; y: number }
type Stroke = { color: string; width: number; points: Point[] }

const CANVAS_W = 560
const CANVAS_H = 220

const SWATCHES = ['#111111', '#1d4ed8', '#b91c1c', '#0d9488', '#7c3aed']

export function StampEditorDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'draw' | 'type'>('draw')
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Create stamp">
        <div className="dialog-header">
          <h2>Create stamp</h2>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className={tab === 'draw' ? 'tab active' : 'tab'} aria-selected={tab === 'draw'} onClick={() => setTab('draw')}>
            Draw
          </button>
          <button type="button" role="tab" className={tab === 'type' ? 'tab active' : 'tab'} aria-selected={tab === 'type'} onClick={() => setTab('type')}>
            Type
          </button>
        </div>
        {tab === 'draw' ? <DrawTab onClose={onClose} /> : <TypeTab onClose={onClose} />}
      </div>
    </div>
  )
}

async function buildStamp(canvas: HTMLCanvasElement, name: string): Promise<Stamp | null> {
  const trimmed = trimCanvas(canvas)
  if (trimmed.width === 0 || trimmed.height === 0) return null
  const stamp: Stamp = {
    id: `stamp-${Date.now().toString(36)}`,
    name,
    dataUrl: trimmed.canvas.toDataURL('image/png'),
    width: trimmed.canvas.width / STAMP_CAPTURE_SCALE,
    height: trimmed.canvas.height / STAMP_CAPTURE_SCALE,
    createdAt: Date.now(),
  }
  return stamp
}

function DrawTab({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef(false)
  const [color, setColor] = useState(SWATCHES[0])
  const [width, setWidth] = useState(2.5)
  const [count, setCount] = useState(0)
  const stamps = useEditor((s) => s.stamps)
  const defaultName = `Signature ${stamps.length + 1}`
  const [name, setName] = useState<string | null>(null)

  const ctxScale = () => {
    const canvas = canvasRef.current!
    canvas.width = CANVAS_W * STAMP_CAPTURE_SCALE
    canvas.height = CANVAS_H * STAMP_CAPTURE_SCALE
    const c = canvas.getContext('2d')!
    c.scale(STAMP_CAPTURE_SCALE, STAMP_CAPTURE_SCALE)
    return c
  }

  // initial paint
  useEffect(() => {
    ctxScale()
  }, [])

  const repaint = () => {
    const c = ctxScale()
    c.lineCap = 'round'
    c.lineJoin = 'round'
    for (const s of strokesRef.current) {
      c.strokeStyle = s.color
      c.lineWidth = s.width
      paintStroke(c, s.points)
    }
  }

  const pos = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    }
  }

  const start = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    drawingRef.current = true
    const p = pos(e)
    strokesRef.current.push({ color, width, points: [p] })
    const c = canvasRef.current!.getContext('2d')!
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.strokeStyle = color
    c.lineWidth = width
    paintStroke(c, [p])
    setCount((n) => n + 1)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return
    const stroke = strokesRef.current[strokesRef.current.length - 1]
    stroke.points.push(pos(e))
    repaint()
  }

  const end = () => {
    drawingRef.current = false
  }

  const undoStroke = () => {
    strokesRef.current.pop()
    repaint()
    setCount((n) => Math.max(0, n - 1))
  }

  const clear = () => {
    strokesRef.current = []
    repaint()
    setCount(0)
  }

  const export_ = async () => {
    if (strokesRef.current.length === 0) return
    const stamp = await buildStamp(canvasRef.current!, name?.trim() || 'Signature')
    if (!stamp) return
    placeStamp(stamp)
    onClose()
  }

  return (
    <div className="draw-tab">
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        style={{ width: CANVAS_W, height: CANVAS_H, touchAction: 'none' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <div className="controls-row">
        <span className="hint">Ink</span>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${color === c ? 'active' : ''}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
          />
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom color" />
        <span className="hint">Width</span>
        <input type="range" min={1} max={8} step={0.5} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        <button type="button" className="btn" onClick={undoStroke} disabled={count === 0}>
          Undo
        </button>
        <button type="button" className="btn" onClick={clear} disabled={count === 0}>
          Clear
        </button>
      </div>
      <SaveRow
        name={name ?? defaultName}
        setName={setName}
        onExport={export_}
        disabled={count === 0}
        hint="Changed ink color or width applies to the next stroke you draw. Exported at print quality (~300 DPI)."
      />
    </div>
  )
}

function TypeTab({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [fontId, setFontId] = useState(() => {
    const last = loadLastSignatureFontId()
    return last && signatureFontsOrdered(null).some((f) => f.id === last) ? last : 'great-vibes'
  })
  const [size, setSize] = useState(48)
  const [color, setColor] = useState(SWATCHES[0])
  const [name, setName] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const face = getFont(fontId)

  // load all signature faces whenever the dialog opens so previews in the
  // font list render correctly
  useEffect(() => {
    let live = true
    void ensureFonts(signatureFontsOrdered(null).map((f) => f.id)).then(() => {
      if (live) setTick((t) => t + 1)
    })
    return () => {
      live = false
    }
  }, [])

  const pickFont = (id: string) => {
    setFontId(id)
    saveLastSignatureFontId(id)
  }

  const export_ = async () => {
    if (text.trim() === '') return
    const rendered = await renderTypedStamp(text, fontId, size, color)
    saveLastSignatureFontId(fontId)
    const stamp: Stamp = {
      id: `stamp-${Date.now().toString(36)}`,
      name: name?.trim() || 'Signature',
      dataUrl: rendered.dataUrl,
      width: rendered.width,
      height: rendered.height,
      createdAt: Date.now(),
    }
    placeStamp(stamp)
    onClose()
  }

  return (
    <div className="type-tab">
      <div className="type-preview checkerboard">
        <span
          style={{
            fontFamily: `"${face.cssFamily}"`,
            fontWeight: face.weight,
            fontStyle: face.style,
            fontSize: size,
            color,
            whiteSpace: 'pre',
          }}
        >
          {text || 'Preview'}
        </span>
      </div>
      <div className="controls-row">
        <input
          type="text"
          placeholder="Your name…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-input"
          autoFocus
        />
        <select value={fontId} onChange={(e) => pickFont(e.target.value)} aria-label="Font">
          {signatureFontsOrdered(fontId).map((f) => (
            <option key={f.id} value={f.id} style={{ fontFamily: `"${f.cssFamily}"` }}>
              {f.label}
            </option>
          ))}
        </select>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${color === c ? 'active' : ''}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
          />
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom color" />
        <span className="hint">Size</span>
        <input type="range" min={24} max={96} value={size} onChange={(e) => setSize(Number(e.target.value))} />
      </div>
      <SaveRow name={name ?? ''} setName={setName} onExport={export_} disabled={text.trim() === ''} hint="Exported losslessly at ~300 DPI." />
    </div>
  )
}

function SaveRow({
  name,
  setName,
  onExport,
  disabled,
  hint,
}: {
  name: string | null
  setName: (v: string) => void
  onExport: () => void
  disabled: boolean
  hint: string
}) {
  return (
    <div className="save-row">
      <input
        type="text"
        className="text-input"
        value={name ?? ''}
        placeholder="Stamp name"
        onChange={(e) => setName(e.target.value)}
        aria-label="Stamp name"
      />
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={onExport}>
        Save &amp; place
      </button>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

function paintStroke(c: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length === 0) return
  if (pts.length === 1) {
    c.beginPath()
    c.arc(pts[0].x, pts[0].y, Math.max(c.lineWidth / 2, 0.6), 0, Math.PI * 2)
    c.fillStyle = c.strokeStyle as string
    c.fill()
    return
  }
  c.beginPath()
  c.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
  }
  c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
  c.stroke()
}

function placeStamp(stamp: Stamp) {
  const st = useEditor.getState()
  st.addStampToLibrary(stamp)
  st.setTool({ mode: 'place-stamp', stampId: stamp.id })
  st.toast('Stamp saved — click on a page to place it')
}
