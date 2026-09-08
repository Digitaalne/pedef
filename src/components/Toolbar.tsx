import { useRef } from 'react'
import { useEditor } from '../state/store'
import { buildPdf, downloadBlob, editedFileName } from '../lib/export'
import {
  IconClose,
  IconDownload,
  IconFile,
  IconLock,
  IconRedo,
  IconSignature,
  IconText,
  IconTrash,
  IconUndo,
  IconZoomIn,
  IconZoomOut,
} from './Icons'

export function OpenPdfButton({
  onFile,
  children,
  compact,
}: {
  onFile: (file: File) => void
  children: React.ReactNode
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      <button type="button" className={`btn ${compact ? '' : 'btn-primary'}`} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
    </>
  )
}

function toBlobPart(data: Uint8Array): BlobPart {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

export function Toolbar({ onOpenStampEditor }: { onFile: (file: File) => void; onOpenStampEditor: () => void }) {
  const s = useEditor()
  const pdf = useEditor((st) => st.pdf)!
  const canUndo = useEditor((st) => st.canUndo)
  const canRedo = useEditor((st) => st.canRedo)

  const download = async () => {
    if (!pdf || s.exporting) return
    s.setExporting(true)
    try {
      const bytes = await buildPdf(pdf.bytes, s.elements)
      downloadBlob(toBlobPart(bytes), editedFileName(pdf.fileName), 'application/pdf')
      s.toast('PDF downloaded')
    } catch (e) {
      console.error(e)
      s.toast(`Export failed: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      s.setExporting(false)
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-group" title={pdf.fileName}>
        <IconFile />
        <span className="file-name">{pdf.fileName}</span>
        <button type="button" className="btn btn-icon" title="Close document" onClick={() => s.closePdf()}>
          <IconClose />
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" className="btn btn-icon" disabled={!canUndo} onClick={s.undo} title="Undo (Ctrl+Z)">
          <IconUndo />
        </button>
        <button type="button" className="btn btn-icon" disabled={!canRedo} onClick={s.redo} title="Redo (Ctrl+Shift+Z)">
          <IconRedo />
        </button>
        <span className="sep" />
        <button
          type="button"
          className={`btn ${s.tool.mode === 'place-text' ? 'btn-active' : ''}`}
          onClick={() => s.setTool(s.tool.mode === 'place-text' ? { mode: 'select' } : { mode: 'place-text' })}
          title="Add text — then click anywhere on a page"
        >
          <IconText /> <span className="btn-label">Text</span>
        </button>
        <button type="button" className="btn" onClick={onOpenStampEditor} title="Create a signature or stamp">
          <IconSignature /> <span className="btn-label">Signature</span>
        </button>
        <button
          type="button"
          className="btn btn-icon"
          title="Delete selected"
          disabled={!s.selection}
          onClick={() => s.selection && s.deleteElement(s.selection)}
        >
          <IconTrash />
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" className="btn btn-icon" onClick={s.zoomOut} title="Zoom out">
          <IconZoomOut />
        </button>
        <span className="zoom-value">{Math.round(s.zoom * 100)}%</span>
        <button type="button" className="btn btn-icon" onClick={s.zoomIn} title="Zoom in">
          <IconZoomIn />
        </button>
        <span className="page-indicator">
          Page {s.currentPage + 1} / {pdf.pages.length}
        </span>
      </div>

      <div className="toolbar-group">
        <span className="privacy-chip" title="This app runs entirely in your browser. Your PDF is never uploaded.">
          <IconLock size={14} /> 100% local
        </span>
        <button type="button" className="btn btn-primary" onClick={download} disabled={s.exporting}>
          <IconDownload />
          <span className="btn-label">{s.exporting ? 'Exporting…' : 'Download PDF'}</span>
        </button>
      </div>
    </header>
  )
}
