import { describe, expect, it } from 'vitest'
import { type Deriv } from '../src/sim/ode'
import { lyapunovFit, perturb, runEnsemble, separation, stateExtent } from '../src/sim/ensemble'
import { CLASSIC, lorenzDeriv } from '../src/sim/lorenz'

const still: Deriv = (_t, y) => y.map(() => 0)

describe('perturb', () => {
  it('returns a copy with only y0[index] shifted by delta', () => {
    const y0 = [1, 2, 3]
    const p = perturb(y0, 1, 0.5)
    expect(p).toEqual([1, 2.5, 3])
    expect(y0).toEqual([1, 2, 3])
    expect(p).not.toBe(y0)
  })
})

describe('runEnsemble', () => {
  it('builds a reference plus K copies, copy k shifted by +k*epsilon', () => {
    const e = runEnsemble(still, [1, 2], 0, 0.25, 4, { dt: 0.1, tMax: 1 })
    expect(e.copies.length).toBe(4)
    expect(e.reference.ys[0]).toEqual([1, 2])
    for (let k = 1; k <= 4; k++) expect(e.copies[k - 1].ys[0]).toEqual([1 + k * 0.25, 2])
  })
  it('copies share the reference time grid', () => {
    const e = runEnsemble(still, [0, 0], 1, 0.5, 2, { dt: 0.25, tMax: 1 })
    for (const c of e.copies) expect(c.ts).toEqual(e.reference.ts)
  })
})

describe('separation', () => {
  it('is the full-state L2 distance at shared sample times', () => {
    const ref = { ts: [0, 1], ys: [[0, 0], [1, 0]] }
    const copy = { ts: [0, 1], ys: [[3, 4], [1, 1]] }
    const s = separation(ref, copy)
    expect(s.ts).toEqual([0, 1])
    expect(s.ds[0]).toBeCloseTo(5, 12)
    expect(s.ds[1]).toBeCloseTo(1, 12)
  })
  it('truncates to the shorter run, whichever side it is', () => {
    const long = { ts: [0, 1, 2], ys: [[0], [0], [0]] }
    const short = { ts: [0, 1], ys: [[1], [2]] }
    expect(separation(long, short).ds).toEqual([1, 2])
    expect(separation(short, long).ts).toEqual([0, 1])
  })
  it('initial separation of copy k is exactly k*epsilon', () => {
    const e = runEnsemble(still, [1, 2, 3], 2, 0.25, 3, { dt: 0.1, tMax: 0.5 })
    for (let k = 1; k <= 3; k++) {
      const s = separation(e.reference, e.copies[k - 1])
      for (const d of s.ds) expect(d).toBe(k * 0.25)
    }
  })
})

describe('stateExtent', () => {
  it('is the RMS L2 deviation of states from their time-mean', () => {
    expect(stateExtent({ ts: [0, 1], ys: [[0, 0], [2, 0]] })).toBeCloseTo(1, 12)
    expect(stateExtent({ ts: [0, 1, 2], ys: [[1], [3], [5]] })).toBeCloseTo(Math.sqrt(8 / 3), 12)
  })
  it('is 0 for an empty result', () => {
    expect(stateExtent({ ts: [], ys: [] })).toBe(0)
  })
})

describe('lyapunovFit', () => {
  it('recovers lambda and delta0 from an exact exponential', () => {
    const ts: number[] = []
    const ds: number[] = []
    for (let i = 0; i <= 50; i++) {
      ts.push(i * 0.1)
      ds.push(1e-6 * Math.exp(0.9 * i * 0.1))
    }
    const fit = lyapunovFit({ ts, ds }, 1)
    expect(fit).not.toBeNull()
    expect(fit!.lambda).toBeCloseTo(0.9, 8)
    expect(fit!.delta0 / 1e-6).toBeCloseTo(1, 8)
  })
  it('cutoff excludes the saturated tail; without it the slope is biased low', () => {
    const ts: number[] = []
    const ds: number[] = []
    for (let i = 0; i <= 20; i++) {
      ts.push(i * 0.5)
      ds.push(Math.min(1e-6 * Math.exp(i * 0.5), 1e-3))
    }
    const pre = lyapunovFit({ ts, ds }, 1e-3)
    expect(pre!.lambda).toBeCloseTo(1, 8)
    const all = lyapunovFit({ ts, ds }, Number.POSITIVE_INFINITY)
    expect(all!.lambda).toBeLessThan(0.8)
  })
  it('ignores zero distances', () => {
    const s = { ts: [0, 1, 2, 3], ds: [0, Math.exp(-4), Math.exp(-2), 0] }
    const fit = lyapunovFit(s, 1)
    expect(fit!.lambda).toBeCloseTo(2, 12)
    expect(fit!.delta0).toBeCloseTo(Math.exp(-6), 12)
  })
  it('returns null with fewer than 2 usable samples', () => {
    expect(lyapunovFit({ ts: [], ds: [] }, 1)).toBeNull()
    expect(lyapunovFit({ ts: [0, 1], ds: [5, 6] }, 1)).toBeNull()
    expect(lyapunovFit({ ts: [0, 1], ds: [0.5, 6] }, 1)).toBeNull()
  })
})

describe('ensemble on Lorenz (integration)', () => {
  it('classic parameters: fitted lambda lands in [0.6, 1.2]', () => {
    // On-attractor start. From [1, 1, 1] the trajectory spirals around the
    // weakly unstable fixed point C+ for ~12 time units with near-zero
    // divergence, which flattens the fit; tMax 16 ends near first saturation
    // so the fit window is dominated by clean exponential growth.
    const y0 = [-1.39, -2.47, 11.86]
    const e = runEnsemble(lorenzDeriv(CLASSIC), y0, 0, 1e-6, 3,
      { dt: 0.005, tMax: 16, maxSamples: 20000 })
    const cutoff = 0.1 * stateExtent(e.reference)
    for (let k = 1; k <= 3; k++) {
      const s = separation(e.reference, e.copies[k - 1])
      expect(s.ds[0]).toBeCloseTo(k * 1e-6, 12)
      const fit = lyapunovFit(s, cutoff)
      expect(fit).not.toBeNull()
      expect(fit!.lambda).toBeGreaterThan(0.6)
      expect(fit!.lambda).toBeLessThan(1.2)
    }
  })
})
