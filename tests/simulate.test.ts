import { describe, expect, it } from 'vitest'
import { type Deriv } from '../src/sim/ode'
import { duration, sampleAt, simulate } from '../src/sim/simulate'

const rate2: Deriv = () => [2]
const oscillator: Deriv = (_t, y) => [y[1], -y[0]]

describe('simulate', () => {
  it('records y0 as the first sample and stops at tMax', () => {
    const r = simulate(rate2, [0], { dt: 0.1, tMax: 1 })
    expect(r.ts[0]).toBe(0)
    expect(r.ys[0]).toEqual([0])
    expect(r.ts.length).toBe(11)
    expect(r.ys.length).toBe(11)
    expect(r.ts[10]).toBeCloseTo(1, 9)
    expect(r.ys[10][0]).toBeCloseTo(2, 9)
  })

  it('tracks the harmonic oscillator (integration wiring)', () => {
    const r = simulate(oscillator, [1, 0], { dt: Math.PI / 1000, tMax: Math.PI })
    expect(r.ts.length).toBe(1001)
    const last = r.ys[r.ys.length - 1]
    expect(last[0]).toBeCloseTo(Math.cos(Math.PI), 8)
    expect(last[1]).toBeCloseTo(-Math.sin(Math.PI), 8)
  })

  it('stops at an explicit sample cap', () => {
    const r = simulate(rate2, [0], { dt: 0.01, tMax: 1000, maxSamples: 50 })
    expect(r.ts.length).toBe(50)
    expect(r.ys.length).toBe(50)
    expect(r.ts[49]).toBeCloseTo(0.49, 9)
  })

  it('defaults the sample cap to 20000', () => {
    const r = simulate(rate2, [0], { dt: 0.001, tMax: 1000 })
    expect(r.ts.length).toBe(20000)
  })

  it('truncates at the last good sample when the state goes nonfinite', () => {
    const f: Deriv = (_t, y) => [y[0] >= 3.5 ? Number.NaN : 1]
    const r = simulate(f, [0], { dt: 1, tMax: 100 })
    expect(r.ts).toEqual([0, 1, 2, 3])
    expect(r.ys.map((s) => s[0])).toEqual([0, 1, 2, 3])
  })

  it('keeps only y0 when the first step is nonfinite', () => {
    const r = simulate(() => [Number.NaN], [1, 2], { dt: 0.01, tMax: 1 })
    expect(r.ts).toEqual([0])
    expect(r.ys).toEqual([[1, 2]])
  })

  it('treats Infinity as nonfinite', () => {
    const r = simulate(() => [Number.POSITIVE_INFINITY], [0], { dt: 0.1, tMax: 1 })
    expect(r.ts).toEqual([0])
  })

  it('haltWhen stops without recording the halting sample', () => {
    // y[0] grows by 0.2 per step; the sample that first reaches >= 0.95 (y = 1.0
    // at t = 0.5) is dropped, so the run ends at the last good sample y = 0.8.
    const r = simulate(rate2, [0], { dt: 0.1, tMax: 1, haltWhen: (y) => y[0] >= 0.95 })
    expect(r.ts.length).toBe(5)
    expect(r.ts[4]).toBeCloseTo(0.4, 9)
    expect(r.ys[4][0]).toBeCloseTo(0.8, 9)
    expect(r.ys.every((s) => s[0] < 0.95)).toBe(true)
    expect(r.ts.length).toBeLessThan(11) // shorter than the full tMax grid
  })

  it('never throws: tMax = 0 still records the initial sample', () => {
    const r = simulate(rate2, [3], { dt: 0.1, tMax: 0 })
    expect(r.ts).toEqual([0])
    expect(r.ys).toEqual([[3]])
  })

  it('does not alias y0 into the result', () => {
    const y0 = [1, 2]
    const r = simulate(oscillator, y0, { dt: 0.1, tMax: 0 })
    y0[0] = 99
    expect(r.ys[0][0]).toBe(1)
  })

  it('sampleAt interpolates linearly and clamps to [t0, tEnd]', () => {
    const r = simulate(rate2, [0], { dt: 0.1, tMax: 1 })
    expect(sampleAt(r, 0.25)[0]).toBeCloseTo(0.5, 9)
    expect(sampleAt(r, 99)[0]).toBeCloseTo(2, 9)
    expect(sampleAt(r, -5)[0]).toBeCloseTo(0, 9)
  })

  it('sampleAt interpolates every component', () => {
    const r = { ts: [0, 1], ys: [[0, 10], [2, 20]] }
    expect(sampleAt(r, 0.5)).toEqual([1, 15])
  })

  it('sampleAt returns [] on empty; duration is 0 below 2 samples', () => {
    expect(sampleAt({ ts: [], ys: [] }, 1)).toEqual([])
    expect(duration({ ts: [], ys: [] })).toBe(0)
    expect(duration({ ts: [0], ys: [[1]] })).toBe(0)
    expect(duration(simulate(rate2, [0], { dt: 0.1, tMax: 1 }))).toBeCloseTo(1, 9)
  })

  it('stride records y0 then every stride-th integrated step, spacing dt*stride', () => {
    const r = simulate(rate2, [0], { dt: 0.1, tMax: 1, stride: 2 })
    expect(r.ts.length).toBe(6)
    for (let i = 0; i < r.ts.length; i++) {
      expect(r.ts[i]).toBeCloseTo(i * 0.2, 9)
      expect(r.ys[i][0]).toBeCloseTo(2 * i * 0.2, 9)
    }
  })

  it('stride combined with maxSamples caps recorded rows, not integrated steps', () => {
    const r = simulate(rate2, [0], { dt: 0.01, tMax: 1000, stride: 10, maxSamples: 50 })
    expect(r.ts.length).toBe(50)
    expect(r.ys.length).toBe(50)
    expect(r.ts[49]).toBeCloseTo(4.9, 9)
    expect(r.ys[49][0]).toBeCloseTo(9.8, 9)
  })

  it('stride with haltWhen: a halt between recording points truncates at the last recorded row', () => {
    // y grows 0.2/step; haltWhen fires at step 5 (y=1.0, y>=0.95), not a
    // multiple of stride 3, so the last recorded row is step 3 (t=0.3, y=0.6)
    const r = simulate(rate2, [0], { dt: 0.1, tMax: 1, stride: 3, haltWhen: (y) => y[0] >= 0.95 })
    expect(r.ts).toEqual([0, 0.30000000000000004])
    expect(r.ys.map((y) => y[0])).toEqual([0, 0.6000000000000001])
  })

  it('stride defaults to 1: byte-equivalent to the pre-stride behavior', () => {
    const withDefault = simulate(rate2, [0], { dt: 0.1, tMax: 1 })
    const withStride1 = simulate(rate2, [0], { dt: 0.1, tMax: 1, stride: 1 })
    expect(withStride1).toEqual(withDefault)
  })
})
