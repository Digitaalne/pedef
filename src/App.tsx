import { useCallback, useEffect, useRef, useState } from 'react'
import { Toolbar } from './components/Toolbar'
import { Viewer } from './components/Viewer'
import { PropertiesPanel } from './components/PropertiesPanel'
import { StampGallery } from './components/StampGallery'
import { StampEditorDialog } from './components/StampEditorDialog'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Toasts } from './components/Toasts'
import { ensureFontFace } from './lib/fontLoader'
import { openPdf } from './lib/pdf'
import { useEditor } from './state/store'

export default function App() {
  const pdf = useEditor((s) => s.pdf)
  const [stampDialogOpen, setStampDialogOpen] = useState(false)
  const stampDialogOpenRef = useRef(stampDialogOpen)
  const onFileRef = useRef<(f: File) => void>(() => {})

  // the default text font is needed as soon as the first element is placed —
  // all other fonts load lazily on demand (see lib/fontLoader.ts)
  useEffect(() => {
    void ensureFontFace('noto-sans')
  }, [])

  const onFile = useCallback(async (file: File) => {
    const st = useEditor.getState()
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      st.toast('Please choose a PDF file', 'error')
      return
    }
    st.toast(`Opening ${file.name}…`)
    try {
      const loaded = await openPdf(file)
      st.loadPdf(loaded)
    } catch (e) {
      console.error(e)
      const name = (e as { name?: string }).name
      st.toast(
        name === 'PasswordException'
          ? 'This PDF is password protected and cannot be opened'
          : 'Could not open this file (not a valid PDF?)',
        'error',
      )
    }
  }, [])
  useEffect(() => {
    onFileRef.current = onFile
  }, [onFile])

  // accept file drops anywhere
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer?.files?.[0]
      if (f) onFileRef.current(f)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  useEffect(() => {
    stampDialogOpenRef.current = stampDialogOpen
  }, [stampDialogOpen])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState()
      if (!st.pdf) {
        if (e.key === 'Escape' && stampDialogOpenRef.current) setStampDialogOpen(false)
        return
      }
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
      if (e.key === 'Escape') {
        if (stampDialogOpenRef.current) {
          setStampDialogOpen(false)
        } else if (!typing) {
          if (st.tool.mode !== 'select') st.setTool({ mode: 'select' })
          else st.setSelection(null)
        }
        return
      }
      if (typing) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        st.undo()
        return
      }
      if ((mod && e.shiftKey && e.key.toLowerCase() === 'z') || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        st.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection) {
          e.preventDefault()
          st.deleteElement(st.selection)
        }
        return
      }
      if (e.key === '+' || e.key === '=') {
        st.zoomIn()
        return
      }
      if (e.key === '-') {
        st.zoomOut()
        return
      }
      if (st.selection && e.key.startsWith('Arrow')) {
        const el = st.elements.find((x) => x.id === st.selection)
        if (!el) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        st.updateElement(el.id, { x: el.x + dx, y: el.y + dy })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])


  return (
    <div className="app">
      {pdf ? (
        <>
          <Toolbar onFile={(f) => onFileRef.current(f)} onOpenStampEditor={() => setStampDialogOpen(true)} />
          <div className="main">
            <Viewer />
            <aside className="sidebar">
              <PropertiesPanel />
              <StampGallery onOpenEditor={() => setStampDialogOpen(true)} />
            </aside>
          </div>
          {stampDialogOpen && <StampEditorDialog onClose={() => setStampDialogOpen(false)} />}
        </>
      ) : (
        <WelcomeScreen onFile={(f) => onFileRef.current(f)} />
      )}
      <Toasts />
    </div>
  )
}
