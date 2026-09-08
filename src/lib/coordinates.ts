/**
 * Coordinate transforms between "display space" and PDF user space.
 *
 * Display space (what the user sees and what we store for elements):
 *   - origin at the top-left corner of the *displayed* page (rotation applied)
 *   - y grows downward
 *   - units are PDF points (the page viewport at scale = 1)
 *
 * PDF user space:
 *   - origin at the bottom-left corner of the *raw* (unrotated) page
 *   - y grows upward
 *
 * For a page with /Rotate R, pdf.js viewport at scale 1 gives the displayed
 * size; these functions convert between the two, matching pdf.js behavior.
 */

export type Rotation = 0 | 90 | 180 | 270

export function normalizeRotation(angle: number): Rotation {
  const a = ((angle % 360) + 360) % 360
  return (a === 90 || a === 180 || a === 270 ? a : 0) as Rotation
}

/** Size of the page as displayed to the user (rotation applied). */
export function displaySize(rawWidth: number, rawHeight: number, rotation: Rotation): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: rawHeight, height: rawWidth }
    : { width: rawWidth, height: rawHeight }
}

/**
 * Convert a point from display space to PDF user space.
 * (x, y) = display point (top-left origin, y down, in points).
 * rawWidth/rawHeight = the unrotated page size in points.
 */
export function displayToUser(
  rawWidth: number,
  rawHeight: number,
  rotation: Rotation,
  x: number,
  y: number,
): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: y, y: x }
    case 180:
      return { x: rawWidth - x, y }
    case 270:
      return { x: rawWidth - y, y: rawHeight - x }
    case 0:
    default:
      return { x, y: rawHeight - y }
  }
}

/**
 * Convert a point from PDF user space to display space (inverse of
 * displayToUser).
 */
export function userToDisplay(
  rawWidth: number,
  rawHeight: number,
  rotation: Rotation,
  x: number,
  y: number,
): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: y, y: x }
    case 180:
      return { x: rawWidth - x, y }
    case 270:
      return { x: rawHeight - y, y: rawWidth - x }
    case 0:
    default:
      return { x, y: rawHeight - y }
  }
}

/**
 * Rotation (CCW, degrees) that content must be drawn with in PDF user space
 * so that it appears upright on a page displayed with /Rotate R.
 */
export function uprightRotation(rotation: Rotation): Rotation {
  return rotation
}
