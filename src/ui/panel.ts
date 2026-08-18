import { FIT_FRACTION } from '../scenes'
import { lyapunovFit, separation, stateExtent } from '../sim/ensemble'
import { CLASSIC } from '../sim/lorenz'
import { SOFTENING, nbodyAngularMomentum, nbodyEnergy } from '../sim/nbody'
import { pendulumEnergy } from '../sim/pendulum'
import { sampleAt } from '../sim/simulate'
import type { AppState, Store, Tab } from '../state'

export const fmt = (x: number, digits = 2): string => {
  const s = x.toFixed(digits)
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s
}

export const CAPTIONS: Record<Tab, string> = {
  lorenz:
    'Same equations, same integrator: copies one part in a million apart ' +
    'still split. Drop \u03c1 below ~24.74 and the strange attractor dies.',
  pendulum:
    'Pose the chain, release from rest. The copies obey identical equations, ' +
    'yet the tips fly apart. Normalized units, m = l = g = 1.',
  nbody:
    'Planar gravity with a softened kernel, G = 1. Nudge the selected body ' +
    'by \u03b5 and the ghost systems drift into different futures.',
}

const lambdaLine = (s: AppState): string => {
  const ref = s.ensemble.reference
  const cutoff = FIT_FRACTION * stateExtent(ref)
  const fit = lyapunovFit(separation(ref, s.ensemble.copies[0]), cutoff)
  const lam = fit ? fmt(fit.lambda) : 'n/a'
  return `\u03b4(t) \u2248 \u03b40\u00b7e^(\u03bb\u00b7t), \u03bb \u2248 ${lam}`
}

export const formulasFor = (s: AppState): string[] => {
  switch (s.tab) {
    case 'lorenz':
      return [
        `x' = \u03c3\u00b7(y \u2212 x), \u03c3 = ${fmt(CLASSIC.sigma)}`,
        `y' = x\u00b7(\u03c1 \u2212 z) \u2212 y, \u03c1 = ${fmt(s.lorenz.rho)}`,
        `z' = x\u00b7y \u2212 \u03b2\u00b7z, \u03b2 = ${fmt(CLASSIC.beta)}`,
        lambdaLine(s),
      ]
    case 'pendulum': {
      const y = sampleAt(s.ensemble.reference, s.playback.t)
      return [
        `n = ${s.pendulum.n} links, m = l = g = 1, \u03c9(0) = 0`,
        `E = T + V = ${fmt(pendulumEnergy(y))}`,
        lambdaLine(s),
      ]
    }
    case 'nbody': {
      const p = { masses: s.nbody.masses, softening: SOFTENING }
      const y = sampleAt(s.ensemble.reference, s.playback.t)
      return [
        `preset: ${s.nbody.presetId}, G = 1, ${s.nbody.masses.length} bodies`,
        `E = ${fmt(nbodyEnergy(p, y))}, L = ${fmt(nbodyAngularMomentum(p, y))}`,
        lambdaLine(s),
      ]
    }
  }
}

export const createPanel = (store: Store) => {
  const el = document.createElement('div')
  let lastKey: string | null = null
  const render = () => {
    const s = store.get()
    const lines = formulasFor(s)
    const key = s.tab + '|' + lines.join('\n')
    if (key === lastKey) return
    lastKey = key
    el.innerHTML = ''
    for (const line of lines) {
      const div = document.createElement('div')
      div.className = 'formula'
      div.textContent = line
      el.appendChild(div)
    }
    const cap = document.createElement('div')
    cap.className = 'caption'
    cap.textContent = CAPTIONS[s.tab]
    el.appendChild(cap)
  }
  return { el, render }
}
