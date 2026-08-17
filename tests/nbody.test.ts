import { describe, expect, it } from 'vitest'
import { nbodyAngularMomentum, nbodyDeriv, nbodyEnergy } from '../src/sim/nbody'

describe('nbodyDeriv', () => {
  it('two unit masses, unsoftened: unit accelerations toward each other', () => {
    const f = nbodyDeriv({ masses: [1, 1], softening: 0 })
    const d = f(0, [0, 0, 0, 0, 1, 0, 0, 0])
    expect(d).toEqual([0, 0, 1, 0, 0, 0, -1, 0])
  })
  it('passes velocities through and applies the softened kernel', () => {
    const f = nbodyDeriv({ masses: [2, 3], softening: 0.05 })
    const d = f(0, [0, 0, 0.3, -0.2, 1, 0, 0, 0.1])
    expect(d[0]).toBe(0.3)
    expect(d[1]).toBe(-0.2)
    expect(d[4]).toBe(0)
    expect(d[5]).toBe(0.1)
    // d2 = 1 + 0.05^2 = 1.0025; a1x = m2 / d2^1.5, a2x = -m1 / d2^1.5
    expect(d[2]).toBeCloseTo(3 / Math.pow(1.0025, 1.5), 12)
    expect(d[3]).toBe(0)
    expect(d[6]).toBeCloseTo(-2 / Math.pow(1.0025, 1.5), 12)
    expect(d[7]).toBe(0)
  })
  it('three bodies: accelerations are pairwise sums', () => {
    const f = nbodyDeriv({ masses: [1, 1, 1], softening: 0 })
    const d = f(0, [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0])
    const s = 1 / Math.pow(2, 1.5) // kernel at distance sqrt(2), per axis
    expect(d[2]).toBeCloseTo(1, 12)
    expect(d[3]).toBeCloseTo(1, 12)
    expect(d[6]).toBeCloseTo(-1 - s, 12)
    expect(d[7]).toBeCloseTo(s, 12)
    expect(d[10]).toBeCloseTo(s, 12)
    expect(d[11]).toBeCloseTo(-1 - s, 12)
  })
})

describe('nbodyEnergy / nbodyAngularMomentum', () => {
  const p = { masses: [2, 3], softening: 0.05 }
  const y = [0, 0, 0.3, -0.2, 1, 0, 0, 0.1]
  it('kinetic plus softened pair potential', () => {
    const expected =
      0.5 * 2 * (0.09 + 0.04) + 0.5 * 3 * 0.01 - 6 / Math.sqrt(1.0025)
    expect(nbodyEnergy(p, y)).toBeCloseTo(expected, 12)
  })
  it('sum of mi * (xi vyi - yi vxi)', () => {
    expect(nbodyAngularMomentum(p, y)).toBeCloseTo(0.3, 12)
  })
})
