import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useEditor } from '../state/store'
import { getFont } from '../lib/fonts'
import { ensureFontFace } from '../lib/fontLoader'
import { measureFont, measureTextWidth } from '../lib/metrics'
import { LINE_HEIGHT_FACTOR } from '../lib/export'
import { makeMoveHandler } from './useElementInteractions'
import type { TextElement } from '../types'

export function TextElementView({ el, zoom }: { el: TextElement; zoom: number }) {
  const editing = useEditor((s) => s.editingId) === el.id
  const selected = useEditor((s) => s.selection) === el.id
  const face = getFont(el.fontId)
  const [, setTick] = useState(0)

  // load the face lazily, then re-render once true metrics are available
  useEffect(() => {
    let live = true
    void ensureFontFace(el.fontId).then(() => {
      if (live) setTick((t) => t + 1)
    })
    return () => {
      live = false
    }
  }, [el.fontId])

  const lineHeight = el.size * LINE_HEIGHT_FACTOR
  const { ascent, descent } = measureFont(el.fontId, el.size)
  const halfLeading = (lineHeight - (ascent + descent)) / 2

  const lines = el.text.split('\n')
  const contentWidth = Math.max(
    ...lines.map((l) => measureTextWidth(el.fontId, el.size, l)),
    el.size * 2,
  )

  return (
    <div
      className={`el-text ${selected && !editing ? 'selected' : ''} ${editing ? 'editing' : ''}`}
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: contentWidth * zoom,
        height: editing ? undefined : lines.length * lineHeight * zoom,
      }}
      onPointerDown={makeMoveHandler(el, zoom)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        useEditor.getState().setEditing(el.id)
      }}
    >
      {editing ? (
        <EditableText el={el} zoom={zoom} />
      ) : (
        lines.map((line, i) => (
          <div
            key={i}
            className="el-text-line"
            style={{
              top: (halfLeading + i * lineHeight) * zoom,
              fontSize: el.size * zoom,
              lineHeight: `${(ascent + descent) * zoom}px`,
              fontFamily: `"${face.cssFamily}"`,
              fontStyle: face.style,
              fontWeight: face.weight,
              color: el.color,
            }}
          >
            {line.length > 0 ? line : '\u200b'}
          </div>
        ))
      )}
    </div>
  )
}

function EditableText({ el, zoom }: { el: TextElement; zoom: number }) {
  const textRef = useRef(el.text)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const everFocusedRef = useRef(false)
  const face = getFont(el.fontId)
  const lineHeight = el.size * LINE_HEIGHT_FACTOR

  // enter editing once; focus deferred (setTimeout 0) so that the pointerdown
  // that placed this element cannot steal focus back via its default action —
  // that would blur immediately and delete the empty element again
  useEffect(() => {
    const st = useEditor.getState()
    const ta = taRef.current
    if (ta) {
      const focus = () => {
        everFocusedRef.current = true
        ta.focus()
        if (el.text !== '') ta.select()
      }
      if (el.text !== '') st.pushHistory()
      const t = window.setTimeout(focus, 0)
      return () => window.clearTimeout(t)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the textarea sized to its content
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    const lines = ta.value.split('\n')
    const w = Math.max(
      ...lines.map((l) => measureTextWidth(el.fontId, el.size, l)),
      el.size * 2,
    )
    ta.style.width = `${w * zoom + 28}px`
    ta.style.height = `${lines.length * lineHeight * zoom + 6}px`
  })

  const finish = () => {
    const st = useEditor.getState()
    // ignore blur if the textarea never actually got focus (e.g. focus lost
    // during the very click that created this element)
    if (!everFocusedRef.current) return
    const value = textRef.current
    if (value.trim() === '') {
      st.deleteElement(el.id, { history: false })
    } else {
      st.setEditing(null)
    }
  }

  return (
    <textarea
      ref={taRef}
      className="el-text-edit"
      defaultValue={el.text}
      placeholder="Type text…"
      spellCheck={false}
      style={{
        fontSize: el.size * zoom,
        lineHeight: `${lineHeight * zoom}px`,
        fontFamily: `"${face.cssFamily}"`,
        fontStyle: face.style,
        fontWeight: face.weight,
        color: el.color,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        textRef.current = e.target.value
        useEditor.getState().updateElement(el.id, { text: e.target.value }, { history: false })
      }}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
    />
  )
}
