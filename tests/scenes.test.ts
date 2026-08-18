import { describe, expect, it } from 'vitest'
import { buildEnsemble, FIT_FRACTION, SCENES } from '../src/scenes'
import { PRESETS } from '../src/sim/nbody'
import type { AppState } from '../src/state'

const base = (): AppState => {
  const f8 = PRESETS.find((p) => p.id === 'figure8')!
  return {
    tab: 'lorenz',
    lorenz: { rho: 28, y0: [-1.39, -2.47, 11.86], view: { yaw: 0, pitch: 0 } },
    pendulum: { n: 3, thetas: [Math.PI / 2, Math.PI / 2, Math.PI / 2] },
    nbody: { presetId: 'figure8', masses: [...f8.masses], y0: [...f8.y0], selected: 0 },
    shared: { K: 2, epsExp: -6 },
    playback: { playing: false, t: 0, speed: 1 },
    ensemble: { reference: { ts: [], ys: [] }, copies: [] },
    revision: 0,
  }
}

describe('scenes', () => {
  it('SCENES and FIT_FRACTION match the contract', () => {
    expect(FIT_FRACTION).toBe(0.1)
    expect(SCENES.lorenz).toEqual({ dt: 0.005, tMax: 40, maxSamples: 20000, epsScale: 1 })
    expect(SCENES.pendulum).toEqual({ dt: 0.002, tMax: 30, maxSamples: 20000, epsScale: 1 })
    expect(SCENES.nbody.dt).toBe(0.002)
    expect(SCENES.nbody.epsScale).toBe(1)
  })
  it('lorenz: reference starts at y0, copy k offset by k*epsilon in x0, horizon 40', () => {
    const e = buildEnsemble(base())
    expect(e.reference.ys[0]).toEqual([-1.39, -2.47, 11.86])
    expect(e.copies.length).toBe(2)
    e.copies.forEach((c, i) => {
      expect(c.ys[0][0] - (-1.39)).toBeCloseTo((i + 1) * 1e-6, 12)
      expect(c.ys[0][1]).toBe(-2.47)
      expect(c.ys[0][2]).toBe(11.86)
    })
    const last = e.reference.ts[e.reference.ts.length - 1]
    expect(last).toBeGreaterThan(39.9)
    expect(last).toBeLessThan(40.1)
  })
  it('lorenz: rho below 1 collapses the trajectory to the origin', () => {
    const s = base()
    s.lorenz.rho = 0.5
    const e = buildEnsemble(s)
    const last = e.reference.ys[e.reference.ys.length - 1]
    expect(Math.hypot(last[0], last[1], last[2])).toBeLessThan(1e-3)
  })
  it('epsExp sets the perturbation scale', () => {
    const s = base()
    s.shared.epsExp = -3
    const e = buildEnsemble(s)
    expect(e.copies[0].ys[0][0] - (-1.39)).toBeCloseTo(1e-3, 9)
  })
  it('pendulum: y0 is thetas plus zero omegas, tip angle perturbed, horizon 30', () => {
    const s = base()
    s.tab = 'pendulum'
    const e = buildEnsemble(s)
    expect(e.reference.ys[0]).toEqual(
      [Math.PI / 2, Math.PI / 2, Math.PI / 2, 0, 0, 0])
    expect(e.copies[0].ys[0][2] - Math.PI / 2).toBeCloseTo(1e-6, 12)
    expect(e.copies[0].ys[0][0]).toBe(Math.PI / 2)
    expect(e.copies[0].ys[0].slice(3)).toEqual([0, 0, 0])
    const last = e.reference.ts[e.reference.ts.length - 1]
    expect(last).toBeGreaterThan(29.9)
    expect(last).toBeLessThan(30.1)
  })
  it('nbody: preset y0, selected-body x perturbed at index 4*selected', () => {
    const s = base()
    s.tab = 'nbody'
    s.nbody.selected = 1
    const e = buildEnsemble(s)
    expect(e.reference.ys[0]).toEqual(s.nbody.y0)
    expect(e.copies[0].ys[0][4] - s.nbody.y0[4]).toBeCloseTo(1e-6, 12)
    expect(e.copies[0].ys[0][0]).toBe(s.nbody.y0[0])
    const last = e.reference.ts[e.reference.ts.length - 1]
    expect(last).toBeGreaterThan(19.9)
    expect(last).toBeLessThan(20.1)
  })
  it('nbody: tMax and maxSamples come from the active preset, not the scene record', () => {
    const s = base()
    s.tab = 'nbody'
    const p = PRESETS.find((x) => x.id === 'sun2planets')!
    s.nbody.presetId = 'sun2planets'
    s.nbody.masses = [...p.masses]
    s.nbody.y0 = [...p.y0]
    const e = buildEnsemble(s)
    // tMax 40 at dt 0.002 needs > 20000 samples: both the record tMax (20)
    // and the record maxSamples (20000) would truncate this
    expect(e.reference.ts.length).toBeGreaterThan(20000)
    const last = e.reference.ts[e.reference.ts.length - 1]
    expect(last).toBeGreaterThan(39)
    expect(last).toBeLessThan(41)
  })
  it('nbody: a body escaping 3 * halfExtent halts the run before tMax', () => {
    const s = base()
    s.tab = 'nbody'
    const p = PRESETS.find((x) => x.id === 'sun2planets')!
    s.nbody.presetId = 'sun2planets'
    s.nbody.masses = [...p.masses]
    s.nbody.y0 = [...p.y0]
    s.nbody.y0[7] = 30 // planet1 vy: escape velocity, crosses |y| > 12 near t ~ 0.4
    const e = buildEnsemble(s)
    const last = e.reference.ts[e.reference.ts.length - 1]
    expect(last).toBeGreaterThan(0)
    expect(last).toBeLessThan(p.tMax - 1)
  })
})
