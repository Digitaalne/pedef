/**
 * Central editor state: loaded document, placed elements, selection, tool,
 * zoom, undo/redo history, toasts.
 */
import { create } from 'zustand'
import type { EditorElement, Stamp, ToastMessage, Tool } from '../types'
import type { LoadedPdf } from '../lib/pdf'
import { loadStamps, saveStamps } from '../lib/stamps'

const DEFAULT_TEXT = {
  text: '',
  fontId: 'noto-sans',
  size: 14,
  color: '#111111',
}

let nextId = 1
function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`
}

export type EditorState = {
  pdf: LoadedPdf | null
  elements: EditorElement[]
  selection: string | null
  editingId: string | null
  tool: Tool
  zoom: number
  currentPage: number
  stamps: Stamp[]
  toasts: ToastMessage[]
  exporting: boolean
  canUndo: boolean
  canRedo: boolean

  setZoom: (z: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setCurrentPage: (i: number) => void
  setTool: (tool: Tool) => void
  setSelection: (id: string | null) => void
  setEditing: (id: string | null) => void
  setExporting: (v: boolean) => void

  loadPdf: (pdf: LoadedPdf) => void
  closePdf: () => void

  pushHistory: () => void
  undo: () => void
  redo: () => void

  addText: (pageIndex: number, x: number, y: number) => string
  addStamp: (stamp: Stamp, pageIndex: number, x: number, y: number, width: number, height: number) => string
  updateElement: (id: string, patch: Partial<EditorElement>, opts?: { history?: boolean }) => void
  deleteElement: (id: string, opts?: { history?: boolean }) => void

  addStampToLibrary: (stamp: Stamp) => void
  deleteStampFromLibrary: (id: string) => void

  toast: (text: string, kind?: 'info' | 'error') => void
  dismissToast: (id: number) => void
}

type Snapshot = EditorElement[]

export const useEditor = create<EditorState>((set, get) => {
  let historyPast: Snapshot[] = []
  let historyFuture: Snapshot[] = []
  let toastId = 1

  const applyElements = (elements: EditorElement[]) => set({ elements })
  const syncHistoryFlags = () => set({ canUndo: historyPast.length > 0, canRedo: historyFuture.length > 0 })

  return {
    pdf: null,
    elements: [],
    selection: null,
    editingId: null,
    tool: { mode: 'select' },
    zoom: 1,
    currentPage: 0,
    stamps: loadStamps(),
    toasts: [],
    exporting: false,
    canUndo: false,
    canRedo: false,

    setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.25, z)) }),
    zoomIn: () => get().setZoom(get().zoom * 1.25),
    zoomOut: () => get().setZoom(get().zoom / 1.25),
    setCurrentPage: (i) => set({ currentPage: i }),
    setTool: (tool) => set({ tool, selection: null }),
    setSelection: (id) => set({ selection: id }),
    setEditing: (id) => set({ editingId: id }),
    setExporting: (v) => set({ exporting: v }),

    loadPdf: (pdf) =>
      set({
        pdf,
        elements: [],
        selection: null,
        editingId: null,
        tool: { mode: 'select' },
        zoom: 1,
        currentPage: 0,
      }),
    closePdf: () => {
      historyPast = []
      historyFuture = []
      set({
        pdf: null,
        elements: [],
        selection: null,
        editingId: null,
        tool: { mode: 'select' },
        currentPage: 0,
      })
      syncHistoryFlags()
    },

    pushHistory: () => {
      historyPast.push([...get().elements])
      if (historyPast.length > 100) historyPast.shift()
      historyFuture = []
      syncHistoryFlags()
    },
    undo: () => {
      const prev = historyPast.pop()
      if (!prev) return
      historyFuture.push([...get().elements])
      applyElements(prev)
      set({ selection: null, editingId: null })
      syncHistoryFlags()
    },
    redo: () => {
      const next = historyFuture.pop()
      if (!next) return
      historyPast.push([...get().elements])
      applyElements(next)
      set({ selection: null, editingId: null })
      syncHistoryFlags()
    },

    addText: (pageIndex, x, y) => {
      get().pushHistory()
      const id = makeId('text')
      const el: EditorElement = {
        kind: 'text',
        id,
        pageIndex,
        x: Math.max(0, x),
        y: Math.max(0, y - DEFAULT_TEXT.size / 2),
        ...DEFAULT_TEXT,
      }
      set((s) => ({
        elements: [...s.elements, el],
        selection: id,
        editingId: id,
        tool: { mode: 'select' },
      }))
      return id
    },
    addStamp: (stamp, pageIndex, x, y, width, height) => {
      get().pushHistory()
      const id = makeId('stamp')
      const el: EditorElement = {
        kind: 'stamp',
        id,
        pageIndex,
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        dataUrl: stamp.dataUrl,
        opacity: 1,
      }
      set((s) => ({ elements: [...s.elements, el], selection: id, tool: { mode: 'select' } }))
      return id
    },
    updateElement: (id, patch, opts) => {
      if (opts?.history !== false) get().pushHistory()
      set((s) => ({
        elements: s.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as EditorElement) : el)),
      }))
    },
    deleteElement: (id, opts) => {
      if (opts?.history !== false) get().pushHistory()
      set((s) => ({
        elements: s.elements.filter((el) => el.id !== id),
        selection: s.selection === id ? null : s.selection,
        editingId: s.editingId === id ? null : s.editingId,
      }))
    },

    addStampToLibrary: (stamp) => {
      const stamps = [...get().stamps, stamp]
      set({ stamps })
      try {
        saveStamps(stamps)
      } catch (e) {
        console.error(e)
        get().toast('Could not save stamp locally (storage full?)', 'error')
      }
    },
    deleteStampFromLibrary: (id) => {
      const stamps = get().stamps.filter((s) => s.id !== id)
      set({ stamps })
      try {
        saveStamps(stamps)
      } catch (e) {
        console.error(e)
      }
    },

    toast: (text, kind = 'info') => {
      const id = toastId++
      set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }))
      window.setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 3000)
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }
})

// debugging convenience in dev
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__useEditor = useEditor
}
