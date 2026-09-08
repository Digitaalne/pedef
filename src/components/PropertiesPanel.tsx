import { FONTS } from '../lib/fonts'
import { useEditor } from '../state/store'

export function PropertiesPanel() {
  const el = useEditor((s) => s.elements.find((e) => e.id === s.selection))
  const update = useEditor((s) => s.updateElement)
  const remove = useEditor((s) => s.deleteElement)
  if (!el) return null

  const textFonts = FONTS.filter((f) => f.category === 'text')
  const signatureFonts = FONTS.filter((f) => f.category === 'signature')

  return (
    <section className="sidebar-section">
      <h3>Properties</h3>
      {el.kind === 'text' && (
        <div className="props-grid">
          <label htmlFor="prop-font">Font</label>
          <select
            id="prop-font"
            value={el.fontId}
            onChange={(e) => update(el.id, { fontId: e.target.value })}
          >
            <optgroup label="Text">
              {textFonts.map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: `"${f.cssFamily}"`, fontStyle: f.style, fontWeight: f.weight }}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Signature / handwriting">
              {signatureFonts.map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: `"${f.cssFamily}"` }}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          </select>

          <label htmlFor="prop-size">Size</label>
          <input
            id="prop-size"
            type="number"
            min={4}
            max={200}
            value={Math.round(el.size)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v >= 4 && v <= 200) update(el.id, { size: v })
            }}
          />

          <label htmlFor="prop-color">Color</label>
          <input
            id="prop-color"
            type="color"
            value={el.color}
            onChange={(e) => update(el.id, { color: e.target.value })}
          />
        </div>
      )}
      {el.kind === 'stamp' && (
        <div className="props-grid">
          <label htmlFor="prop-w">Width (pt)</label>
          <input
            id="prop-w"
            type="number"
            min={10}
            max={600}
            value={Math.round(el.width)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v >= 10 && v <= 600) update(el.id, { width: v, height: (el.height / el.width) * v })
            }}
          />
          <label htmlFor="prop-h">Height (pt)</label>
          <input
            id="prop-h"
            type="number"
            min={6}
            max={400}
            value={Math.round(el.height)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v >= 6 && v <= 400) update(el.id, { height: v, width: (el.width / el.height) * v })
            }}
          />
          <label htmlFor="prop-opacity">Opacity</label>
          <input
            id="prop-opacity"
            type="range"
            min={20}
            max={100}
            value={Math.round(el.opacity * 100)}
            onChange={(e) => update(el.id, { opacity: Number(e.target.value) / 100 })}
          />
        </div>
      )}
      <button type="button" className="btn btn-danger" onClick={() => remove(el.id)}>
        Delete element
      </button>
    </section>
  )
}