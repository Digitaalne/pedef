import type { ReactNode } from 'react'

type IconProps = { size?: number }

function svg(path: ReactNode, viewBox = '0 0 24 24') {
  return function Icon({ size = 18 }: IconProps) {
    return (
      <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
      </svg>
    )
  }
}

export const IconText = svg(
  <>
    <path d="M4 6V4h16v2" />
    <path d="M12 4v16" />
    <path d="M9 20h6" />
  </>,
)

export const IconSignature = svg(
  <>
    <path d="M3 17c3.5 0 4.5-10 7.5-10S13 17 16 17c2 0 2.5-2 5-2" />
    <path d="M3 21h18" />
  </>,
)

export const IconUndo = svg(
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 6 6v1" />
  </>,
)

export const IconRedo = svg(
  <>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0-6 6v1" />
  </>,
)

export const IconDownload = svg(
  <>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 21h16" />
  </>,
)

export const IconZoomIn = svg(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M11 8v6M8 11h6" />
    <path d="m21 21-4.3-4.3" />
  </>,
)

export const IconZoomOut = svg(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M8 11h6" />
    <path d="m21 21-4.3-4.3" />
  </>,
)

export const IconTrash = svg(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </>,
)

export const IconPlus = svg(
  <>
    <path d="M12 5v14M5 12h14" />
  </>,
)

export const IconClose = svg(
  <>
    <path d="M6 6l12 12M18 6 6 18" />
  </>,
)

export const IconLock = svg(
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </>,
)

export const IconFile = svg(
  <>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5" />
  </>,
)

export const IconPage = svg(
  <>
    <path d="M13 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" />
    <path d="M13 3v5h5" />
    <path d="M9 13h6M9 17h6" />
  </>,
)
