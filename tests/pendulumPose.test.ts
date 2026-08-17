import { describe, expect, it } from 'vitest'
import { poseDragThetas } from '../src/sim/pendulum'

// Convention reminder: theta is the ABSOLUTE angle from the DOWNWARD vertical,
// joint k sits at x = sum sin(theta_i), y = -sum cos(theta_i), pivot at origin, y up.
describe('poseDragThetas', () => {
  it('aims link 0 at the pointer and shifts the whole chain rigidly', () => {
    // pointer straight right of the pivot -> link 0 horizontal (theta = pi/2);
    // link 1 keeps its relative angle (0), so it shifts by the same delta
    const out = poseDragThetas([0, 0], 0, 1, 0)
    expect(out[0]).toBeCloseTo(Math.PI / 2, 12)
    expect(out[1]).toBeCloseTo(Math.PI / 2, 12)
  })

  it('leaves links above the dragged joint untouched', () => {
    // chain horizontal: joint 0 at (1, 0); drag joint 1 straight below joint 0
    const out = poseDragThetas([Math.PI / 2, Math.PI / 2], 1, 1, -1)
    expect(out[0]).toBeCloseTo(Math.PI / 2, 12)
    expect(out[1]).toBeCloseTo(0, 12)
  })

  it('preserves relative angles below the dragged joint', () => {
    const thetas = [0.3, 0.5, 0.9]
    const bx = Math.sin(0.3)
    const by = -Math.cos(0.3)
    // aim link 1 straight right from its base (joint 0)
    const out = poseDragThetas(thetas, 1, bx + 2, by)
    expect(out[0]).toBeCloseTo(0.3, 12)
    expect(out[1]).toBeCloseTo(Math.PI / 2, 12)
    expect(out[2] - out[1]).toBeCloseTo(0.9 - 0.5, 12)
  })

  it('keeps theta at 0 for a target straight below the base', () => {
    const out = poseDragThetas([0, 0], 0, 0, -2)
    expect(out[0]).toBeCloseTo(0, 12)
    expect(out[1]).toBeCloseTo(0, 12)
  })

  it('depends only on the pointer direction from the base joint', () => {
    const a = poseDragThetas([0, 0], 0, 0.5, 0.5)
    const b = poseDragThetas([0, 0], 0, 5, 5)
    expect(a[0]).toBeCloseTo(b[0], 12)
    expect(a[1]).toBeCloseTo(b[1], 12)
  })

  it('does not mutate its input', () => {
    const thetas = [1, 2]
    poseDragThetas(thetas, 0, 1, 1)
    expect(thetas).toEqual([1, 2])
  })
})
