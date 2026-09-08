import { useEditor } from '../state/store'
import { makeMoveHandler, makeResizeHandler } from './useElementInteractions'
import type { StampElement } from '../types'

export function StampElementView({ el, zoom }: { el: StampElement; zoom: number }) {
  const selected = useEditor((s) => s.selection) === el.id

  return (
    <div
      className={`el-stamp ${selected ? 'selected' : ''}`}
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.width * zoom,
        height: el.height * zoom,
      }}
      onPointerDown={makeMoveHandler(el, zoom)}
    >
      <img
        src={el.dataUrl}
        alt="stamp"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          opacity: el.opacity,
        }}
      />
      {selected && (
        <div
          className="el-stamp-resize"
          title="Resize"
          onPointerDown={makeResizeHandler(el, zoom)}
        />
      )}
    </div>
  )
}
