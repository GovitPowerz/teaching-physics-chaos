import { describe, expect, it } from 'vitest'
import { CLASSIC, fixedPoints, lorenzDeriv } from '../src/sim/lorenz'
import { simulate } from '../src/sim/simulate'

describe('lorenzDeriv', () => {
  it('matches hand-computed values at classic parameters', () => {
    const f = lorenzDeriv(CLASSIC)
    // x' = 10*(2-1) = 10, y' = 1*(28-3) - 2 = 23, z' = 1*2 - (8/3)*3 = -6
    expect(f(0, [1, 2, 3])).toEqual([10, 23, -6])
  })
  it('is autonomous: t is ignored', () => {
    const f = lorenzDeriv(CLASSIC)
    expect(f(123.456, [1, 2, 3])).toEqual(f(0, [1, 2, 3]))
  })
})

describe('fixedPoints', () => {
  it('returns origin plus C+/- for rho > 1', () => {
    const pts = fixedPoints(CLASSIC)
    const s = Math.sqrt((8 / 3) * 27)
    expect(pts).toHaveLength(3)
    expect(pts[0]).toEqual([0, 0, 0])
    expect(pts[1][0]).toBeCloseTo(s, 12)
    expect(pts[1][1]).toBeCloseTo(s, 12)
    expect(pts[1][2]).toBeCloseTo(27, 12)
    expect(pts[2][0]).toBeCloseTo(-s, 12)
    expect(pts[2][1]).toBeCloseTo(-s, 12)
    expect(pts[2][2]).toBeCloseTo(27, 12)
  })
  it('returns only the origin for rho <= 1', () => {
    expect(fixedPoints({ sigma: 10, rho: 0.5, beta: 8 / 3 })).toEqual([[0, 0, 0]])
    expect(fixedPoints({ sigma: 10, rho: 1, beta: 8 / 3 })).toEqual([[0, 0, 0]])
  })
  it('every fixed point is stationary under the flow', () => {
    const f = lorenzDeriv(CLASSIC)
    for (const p of fixedPoints(CLASSIC)) {
      const d = f(0, p)
      expect(Math.abs(d[0])).toBeLessThan(1e-12)
      expect(Math.abs(d[1])).toBeLessThan(1e-12)
      expect(Math.abs(d[2])).toBeLessThan(1e-12)
    }
  })
})

describe('rho < 1 dynamics', () => {
  it('decays to the origin (globally stable regime)', () => {
    const f = lorenzDeriv({ sigma: 10, rho: 0.5, beta: 8 / 3 })
    const r = simulate(f, [1, 1, 1], { dt: 0.01, tMax: 50 })
    const last = r.ys[r.ys.length - 1]
    expect(Math.hypot(last[0], last[1], last[2])).toBeLessThan(1e-6)
  })
})
