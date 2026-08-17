import { runEnsemble, type Ensemble } from './sim/ensemble'
import { CLASSIC, lorenzDeriv } from './sim/lorenz'
import { nbodyDeriv, PRESETS, SOFTENING } from './sim/nbody'
import { pendulumDeriv } from './sim/pendulum'
import type { AppState, Tab } from './state'

export const FIT_FRACTION = 0.1

export interface SceneDef { dt: number; tMax: number; maxSamples: number; epsScale: number }

export const SCENES: Record<Tab, SceneDef> = {
  lorenz: { dt: 0.005, tMax: 40, maxSamples: 20000, epsScale: 1 },
  pendulum: { dt: 0.002, tMax: 30, maxSamples: 20000, epsScale: 1 },
  // nbody tMax/maxSamples are nominal (figure8); buildEnsemble uses the active preset's
  nbody: { dt: 0.002, tMax: 20, maxSamples: 20000, epsScale: 1 },
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
      const o = { dt: def.dt, tMax: preset.tMax, maxSamples: preset.maxSamples, haltWhen }
      return runEnsemble(f, [...s.nbody.y0], 4 * s.nbody.selected, epsilon, K, o)
    }
  }
}
