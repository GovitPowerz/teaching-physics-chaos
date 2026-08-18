import { runEnsemble, type Ensemble } from './sim/ensemble'
import { CLASSIC, lorenzDeriv } from './sim/lorenz'
import { nbodyDeriv, PRESETS, SOFTENING } from './sim/nbody'
import { pendulumDeriv } from './sim/pendulum'
import type { AppState, Tab } from './state'

export const FIT_FRACTION = 0.1

export interface SceneDef {
  dt: number; tMax: number; maxSamples: number; epsScale: number
  stride: number; fadeWindow: number
}

export const SCENES: Record<Tab, SceneDef> = {
  lorenz: { dt: 0.005, tMax: 400, maxSamples: 45000, epsScale: 1, stride: 2, fadeWindow: 40 },
  pendulum: { dt: 0.002, tMax: 300, maxSamples: 35000, epsScale: 1, stride: 5, fadeWindow: 30 },
  // nbody tMax/maxSamples/fadeWindow are nominal (figure8); buildEnsemble uses the active preset's
  nbody: { dt: 0.002, tMax: 200, maxSamples: 25000, epsScale: 1, stride: 5, fadeWindow: 20 },
}

export const buildEnsemble = (s: AppState): Ensemble => {
  const def = SCENES[s.tab]
  const epsilon = Math.pow(10, s.shared.epsExp) * def.epsScale
  const K = s.shared.K
  switch (s.tab) {
    case 'lorenz': {
      const f = lorenzDeriv({ ...CLASSIC, rho: s.lorenz.rho })
      return runEnsemble(f, [...s.lorenz.y0], 0, epsilon, K, def)
    }
    case 'pendulum': {
      const n = s.pendulum.n
      const y0 = [...s.pendulum.thetas, ...new Array<number>(n).fill(0)]
      return runEnsemble(pendulumDeriv(n), y0, n - 1, epsilon, K, def)
    }
    case 'nbody': {
      const preset = PRESETS.find((p) => p.id === s.nbody.presetId)!
      const f = nbodyDeriv({ masses: s.nbody.masses, softening: SOFTENING })
      const bound = 3 * preset.halfExtent
      const haltWhen = (y: number[]): boolean => {
        for (let i = 0; i < y.length; i += 4) {
          if (Math.abs(y[i]) > bound || Math.abs(y[i + 1]) > bound) return true
        }
        return false
      }
      const o = {
        dt: def.dt, tMax: preset.tMax, maxSamples: preset.maxSamples, stride: def.stride, haltWhen,
      }
      return runEnsemble(f, [...s.nbody.y0], 4 * s.nbody.selected, epsilon, K, o)
    }
  }
}
