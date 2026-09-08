import { describe, expect, it } from 'vitest'
import { displaySize, displayToUser, normalizeRotation, uprightRotation, userToDisplay, type Rotation } from './coordinates'

const W = 612
const H = 792

describe('normalizeRotation', () => {
  it('normalizes arbitrary angles', () => {
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(90)).toBe(90)
    expect(normalizeRotation(180)).toBe(180)
    expect(normalizeRotation(270)).toBe(270)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(123)).toBe(0)
  })
})

describe('displaySize', () => {
  it('swaps dimensions for 90/270', () => {
    expect(displaySize(W, H, 0)).toEqual({ width: W, height: H })
    expect(displaySize(W, H, 180)).toEqual({ width: W, height: H })
    expect(displaySize(W, H, 90)).toEqual({ width: H, height: W })
    expect(displaySize(W, H, 270)).toEqual({ width: H, height: W })
  })
})

describe('corner mappings (display top-left origin, y down → PDF user space)', () => {
  it('R=0: display bottom-left is user origin', () => {
    expect(displayToUser(W, H, 0, 0, H)).toEqual({ x: 0, y: 0 })
    expect(displayToUser(W, H, 0, 0, 0)).toEqual({ x: 0, y: H })
  })
  it('R=90 (clockwise display): display top-left is user origin', () => {
    expect(displayToUser(W, H, 90, 0, 0)).toEqual({ x: 0, y: 0 })
    expect(displayToUser(W, H, 90, 0, W)).toEqual({ x: W, y: 0 })
  })
  it('R=180: display top-left is raw bottom-right', () => {
    expect(displayToUser(W, H, 180, 0, 0)).toEqual({ x: W, y: 0 })
  })
  it('R=270 (counter-clockwise display): display top-left is raw top-right', () => {
    expect(displayToUser(W, H, 270, 0, 0)).toEqual({ x: W, y: H })
  })
})

describe('roundtrip display ↔ user', () => {
  const rotations: Rotation[] = [0, 90, 180, 270]
  for (const rot of rotations) {
    for (const x of [0, 10, W / 2, W - 10, W]) {
      for (const y of [0, 10, H / 2, H - 10, H]) {
        it(`roundtrips (${x}, ${y}) at rotation ${rot}`, () => {
          const user = displayToUser(W, H, rot, x, y)
          const back = userToDisplay(W, H, rot, user.x, user.y)
          expect(back.x).toBeCloseTo(x, 10)
          expect(back.y).toBeCloseTo(y, 10)
        })
      }
    }
  }
})

describe('uprightRotation', () => {
  it('equals the page rotation', () => {
    for (const rot of [0, 90, 180, 270] as Rotation[]) {
      expect(uprightRotation(rot)).toBe(rot)
    }
  })
})
