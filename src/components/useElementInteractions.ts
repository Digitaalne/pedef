import { useEditor } from '../state/store'
import type { StampElement } from '../types'

function findElement(id: string) {
  return useEditor.getState().elements.find((x) => x.id === id)
}

/** Pointer-drag handler that moves an element. Attach to the element root. */
export function makeMoveHandler(el: { id: string; x: number; y: number }, zoom: number) {
  return (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const st = useEditor.getState()
    if (st.editingId === el.id) return
    e.stopPropagation()
    st.setSelection(el.id)
    if (st.editingId !== el.id && st.editingId) st.setEditing(null)
    st.pushHistory()

    const base = findElement(el.id)
    if (!base) return
    const baseX = base.x
    const baseY = base.y
    const startX = e.clientX
    const startY = e.clientY

    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      useEditor.getState().updateElement(
        el.id,
        {
          x: baseX + (ev.clientX - startX) / zoom,
          y: baseY + (ev.clientY - startY) / zoom,
        },
        { history: false },
      )
    }
    const onUp = () => {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }
}

/** Pointer-drag handler that resizes a stamp from its bottom-right corner
 * (aspect ratio preserved). */
export function makeResizeHandler(el: StampElement, zoom: number) {
  return (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const st = useEditor.getState()
    st.setSelection(el.id)
    st.pushHistory()

    const base = findElement(el.id)
    if (!base || base.kind !== 'stamp') return
    const startX = e.clientX
    const startY = e.clientY
    const baseW = base.width
    const baseH = base.height

    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom
      const dy = (ev.clientY - startY) / zoom
      // scale by the larger delta so either direction grows the stamp
      const scale = Math.max(
        (baseW + dx) / baseW,
        (baseH + dy) / baseH,
      )
      const width = Math.max(12, baseW * scale)
      const height = Math.max(6, baseH * scale)
      useEditor.getState().updateElement(el.id, { width, height }, { history: false })
    }
    const onUp = () => {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }
}
