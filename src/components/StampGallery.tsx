import { useEditor } from '../state/store'
import type { Stamp } from '../types'
import { IconPlus, IconSignature, IconTrash } from './Icons'

export function StampGallery({ onOpenEditor }: { onOpenEditor: () => void }) {
  const stamps = useEditor((s) => s.stamps)
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const removeStamp = useEditor((s) => s.deleteStampFromLibrary)

  return (
    <section className="sidebar-section">
      <h3>Stamps &amp; signatures</h3>
      <button type="button" className="btn" onClick={onOpenEditor}>
        <IconPlus /> <span className="btn-label">New stamp</span>
      </button>
      {stamps.length === 0 ? (
        <p className="sidebar-empty">
          <IconSignature size={28} />
          <span>Draw or type a signature and save it as a stamp for reuse.</span>
        </p>
      ) : (
        <ul className="stamp-list">
          {stamps.map((st: Stamp) => (
            <li
              key={st.id}
              className={`stamp-item ${tool.mode === 'place-stamp' && tool.stampId === st.id ? 'active' : ''}`}
              title="Click, then click on the page to place"
            >
              <button
                type="button"
                className="stamp-thumb"
                onClick={() =>
                  setTool(tool.mode === 'place-stamp' && tool.stampId === st.id ? { mode: 'select' } : { mode: 'place-stamp', stampId: st.id })
                }
              >
                <img src={st.dataUrl} alt={st.name} draggable={false} />
              </button>
              <span className="stamp-name" title={st.name}>
                {st.name}
              </span>
              <button type="button" className="btn btn-icon btn-quiet" title="Delete stamp" onClick={() => removeStamp(st.id)}>
                <IconTrash />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Stamps are saved in this browser only and never uploaded.</p>
    </section>
  )
}