import { describe, expect, it } from 'vitest'
import { CAPTIONS, fmt, formulasFor } from '../src/ui/panel'
import { createStore, type AppState } from '../src/state'
import { FIT_FRACTION } from '../src/scenes'
import { lyapunovFit, separation, stateExtent } from '../src/sim/ensemble'
import { SOFTENING, nbodyAngularMomentum, nbodyEnergy } from '../src/sim/nbody'
import { pendulumEnergy } from '../src/sim/pendulum'
import { sampleAt } from '../src/sim/simulate'

const expectedLambdaLine = (s: AppState): string => {
  const ref = s.ensemble.reference
  const fit = lyapunovFit(separation(ref, s.ensemble.copies[0]), FIT_FRACTION * stateExtent(ref))
  return `δ(t) ≈ δ0·e^(λ·t), λ ≈ ${fmt(fit!.lambda)}`
}

describe('panel formatters', () => {
  it('fmt fixes digits and normalizes negative zero', () => {
    expect(fmt(1.2345)).toBe('1.23')
    expect(fmt(-0.0001)).toBe('0.00')
    expect(fmt(2, 1)).toBe('2.0')
  })
  it('lorenz formulas carry the three ODEs with live rho and the lambda fit', () => {
    const s = createStore().get()
    const lines = formulasFor(s)
    expect(lines[0]).toBe(`x' = σ·(y − x), σ = 10.00`)
    expect(lines[1]).toBe(`y' = x·(ρ − z) − y, ρ = 28.00`)
    expect(lines[2]).toBe(`z' = x·y − β·z, β = 2.67`)
    expect(lines[3]).toBe(expectedLambdaLine(s))
  })
  it('lorenz rho line tracks patchLorenz', () => {
    const store = createStore()
    store.patchLorenz({ rho: 20 })
    expect(formulasFor(store.get())[1]).toBe(`y' = x·(ρ − z) − y, ρ = 20.00`)
  })
  it('lorenz fitted lambda from the on-attractor default lands in (0.6, 1.2)', () => {
    // default y0 [-1.39, -2.47, 11.86]: measured lambda ~ 0.8603 (canonical 0.906)
    const s = createStore().get()
    const fit = lyapunovFit(separation(s.ensemble.reference, s.ensemble.copies[0]),
      FIT_FRACTION * stateExtent(s.ensemble.reference))
    expect(fit).not.toBeNull()
    expect(fit!.lambda).toBeGreaterThan(0.6)
    expect(fit!.lambda).toBeLessThan(1.2)
  })
  it('pendulum lines: n readout, zero energy at the default pose, lambda fit', () => {
    const store = createStore()
    store.setTab('pendulum')
    const s = store.get()
    const lines = formulasFor(s)
    expect(lines[0]).toBe('n = 3 links, m = l = g = 1, ω(0) = 0')
    // default pose: all thetas pi/2, all omegas 0 -> T = 0 and V = 0
    expect(lines[1]).toBe('E = T + V = 0.00')
    expect(lines[2]).toBe(expectedLambdaLine(s))
  })
  it('pendulum energy line matches an independent computation while scrubbed', () => {
    const store = createStore()
    store.setTab('pendulum')
    store.setT(7.5)
    const s = store.get()
    const e = pendulumEnergy(sampleAt(s.ensemble.reference, s.playback.t))
    expect(formulasFor(s)[1]).toBe(`E = T + V = ${fmt(e)}`)
  })
  it('nbody lines match independently computed E and L', () => {
    const store = createStore()
    store.setTab('nbody')
    const s = store.get()
    const p = { masses: s.nbody.masses, softening: SOFTENING }
    const y = sampleAt(s.ensemble.reference, s.playback.t)
    const lines = formulasFor(s)
    expect(lines[0]).toBe('preset: figure8, G = 1, 3 bodies')
    expect(lines[1]).toBe(`E = ${fmt(nbodyEnergy(p, y))}, L = ${fmt(nbodyAngularMomentum(p, y))}`)
    expect(lines[2]).toBe(expectedLambdaLine(s))
  })
  it('figure8 starts bound with zero angular momentum', () => {
    const store = createStore()
    store.setTab('nbody')
    const lines = formulasFor(store.get())
    expect(lines[1]).toContain('L = 0.00')
  })
  it('every tab has a caption and lorenz names the rho ~ 24.74 transition', () => {
    for (const tab of ['lorenz', 'pendulum', 'nbody'] as const)
      expect(CAPTIONS[tab].length).toBeGreaterThan(10)
    expect(CAPTIONS.lorenz).toContain('24.74')
  })
})
