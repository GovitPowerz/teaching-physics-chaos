import { describe, expect, it } from 'vitest'
import { pxPerUnit, toScreen, toWorld } from '../src/render/viewport'

describe('viewport', () => {
  const vp = { world: { xMin: 0, xMax: 60, yMin: 0, yMax: 30 }, w: 800, h: 600 }

  it('uniform scale is the min fit', () => {
    expect(pxPerUnit(vp)).toBeCloseTo(800 / 60, 9) // 13.33 < 600/30 = 20
    const tall = { world: { xMin: -2, xMax: 2, yMin: -8, yMax: 8 }, w: 400, h: 400 }
    expect(pxPerUnit(tall)).toBeCloseTo(400 / 16, 9) // height side wins here
  })

  it('world y up, screen y down, box centered', () => {
    const center = toScreen(vp, { x: 30, y: 15 })
    expect(center.x).toBeCloseTo(400, 9)
    expect(center.y).toBeCloseTo(300, 9)
    const origin = toScreen(vp, { x: 0, y: 0 })
    expect(origin.y).toBeGreaterThan(300) // world origin is below center on screen
  })

  it('toWorld inverts toScreen', () => {
    const back = toWorld(vp, toScreen(vp, { x: 12.3, y: 4.56 }))
    expect(back.x).toBeCloseTo(12.3, 9)
    expect(back.y).toBeCloseTo(4.56, 9)
  })

  it('off-center world box maps its center to the canvas center', () => {
    const off = { world: { xMin: -3, xMax: 1, yMin: 2, yMax: 6 }, w: 300, h: 200 }
    const c = toScreen(off, { x: -1, y: 4 })
    expect(c.x).toBeCloseTo(150, 9)
    expect(c.y).toBeCloseTo(100, 9)
  })
})
