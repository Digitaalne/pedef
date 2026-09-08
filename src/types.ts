export type TextElement = {
  kind: 'text'
  id: string
  pageIndex: number
  /** top-left corner in PDF points, page display space (origin top-left, y down, unrotated viewport at scale 1) */
  x: number
  y: number
  text: string
  fontId: string
  size: number
  color: string
}

export type StampElement = {
  kind: 'stamp'
  id: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  /** PNG data URL */
  dataUrl: string
  /** 0..1 */
  opacity: number
}

export type EditorElement = TextElement | StampElement

export type Stamp = {
  id: string
  name: string
  /** PNG data URL, transparent background */
  dataUrl: string
  width: number
  height: number
  createdAt: number
}

export type Tool =
  | { mode: 'select' }
  | { mode: 'place-text' }
  | { mode: 'place-stamp'; stampId: string }

export type ToastMessage = { id: number; text: string; kind: 'info' | 'error' }
