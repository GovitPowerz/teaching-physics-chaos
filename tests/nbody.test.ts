import { describe, expect, it } from 'vitest'
import {
  nbodyAngularMomentum, nbodyDeriv, nbodyEnergy, PRESETS, SOFTENING,
} from '../src/sim/nbody'
import { sampleAt, simulate } from '../src/sim/simulate'

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

describe('PRESETS', () => {
  it('exposes the four preset ids in order', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'figure8', 'pythagorean', 'sun2planets', 'binaryPlanet',
    ])
  })
  it('y0 length is 4 per body', () => {
    for (const p of PRESETS) {
      expect(p.y0.length).toBe(4 * p.masses.length)
    }
  })
  it('every preset has zero net momentum', () => {
    for (const p of PRESETS) {
      let px = 0
      let py = 0
      p.masses.forEach((m, i) => {
        px += m * p.y0[4 * i + 2]
        py += m * p.y0[4 * i + 3]
      })
      // preset velocities are rounded to 8 decimals, hence 1e-6 not exact zero
      expect(Math.abs(px)).toBeLessThan(1e-6)
      expect(Math.abs(py)).toBeLessThan(1e-6)
    }
  })
  it('every preset has finite negative energy (bound system)', () => {
    for (const p of PRESETS) {
      const e = nbodyEnergy({ masses: p.masses, softening: SOFTENING }, p.y0)
      expect(Number.isFinite(e)).toBe(true)
      expect(e).toBeLessThan(0)
    }
  })
})

describe('integration', () => {
  // equal unit masses at (+-0.5, 0): force 1/d^2 = 1, circular speed about the
  // barycenter v = sqrt(a r) = sqrt(0.5), analytic period 2 pi r / v = pi sqrt(2)
  const circ = () => {
    const p = { masses: [1, 1], softening: SOFTENING }
    const v = Math.sqrt(0.5)
    const y0 = [0.5, 0, 0, v, -0.5, 0, 0, -v]
    const T = Math.PI * Math.SQRT2
    const r = simulate(nbodyDeriv(p), y0, { dt: 0.002, tMax: T, maxSamples: 20000 })
    return { p, y0, T, r }
  }
  it('two-body circular orbit closes after one analytic period', () => {
    const { T, r } = circ()
    const yT = sampleAt(r, T)
    // softening (r^2 + 0.05^2) shifts the period off the analytic Kepler
    // value, so closure is loose by design (measured error ~0.024)
    expect(Math.hypot(yT[0] - 0.5, yT[1])).toBeLessThan(0.05)
    expect(Math.hypot(yT[4] + 0.5, yT[5])).toBeLessThan(0.05)
  })
  it('conserves E and L along the two-body orbit', () => {
    const { p, y0, r } = circ()
    const e0 = nbodyEnergy(p, y0)
    const l0 = nbodyAngularMomentum(p, y0)
    for (const y of r.ys) {
      expect(Math.abs(nbodyEnergy(p, y) - e0)).toBeLessThan(1e-9)
      expect(Math.abs(nbodyAngularMomentum(p, y) - l0)).toBeLessThan(1e-9)
    }
  })
  const fig8 = () => {
    const preset = PRESETS[0]
    const p = { masses: preset.masses, softening: SOFTENING }
    const T = 6.32591398 // choreography period for the unsoftened problem
    const r = simulate(nbodyDeriv(p), preset.y0, { dt: 0.002, tMax: T, maxSamples: 20000 })
    return { preset, p, T, r }
  }
  it('figure-8 returns near its start after one period', () => {
    const { preset, T, r } = fig8()
    const yT = sampleAt(r, T)
    for (let i = 0; i < 3; i++) {
      const err = Math.hypot(
        yT[4 * i] - preset.y0[4 * i],
        yT[4 * i + 1] - preset.y0[4 * i + 1],
      )
      // softening perturbs the choreography (measured error <= 0.043)
      expect(err).toBeLessThan(0.1)
    }
  })
  it('conserves E and L along the figure-8', () => {
    const { preset, p, r } = fig8()
    const e0 = nbodyEnergy(p, preset.y0)
    const l0 = nbodyAngularMomentum(p, preset.y0)
    for (const y of r.ys) {
      expect(Math.abs(nbodyEnergy(p, y) - e0)).toBeLessThan(1e-9)
      expect(Math.abs(nbodyAngularMomentum(p, y) - l0)).toBeLessThan(1e-9)
    }
  })
})
