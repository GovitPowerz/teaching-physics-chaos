import type { Ensemble } from './sim/ensemble'
import type { View3 } from './sim/projection'

export type Tab = 'lorenz' | 'pendulum' | 'nbody'

export interface AppState {
  tab: Tab
  lorenz: { rho: number; y0: [number, number, number]; view: View3 }
  pendulum: { n: number; thetas: number[] }
  nbody: { presetId: string; masses: number[]; y0: number[]; selected: number }
  shared: { K: number; epsExp: number }
  playback: { playing: boolean; t: number; speed: number }
  ensemble: Ensemble
  revision: number
}

export interface Store {
  get: () => AppState
  subscribe: (fn: () => void) => void
  setTab: (tab: Tab) => void
  patchLorenz: (p: Partial<AppState['lorenz']>) => void
  patchPendulum: (p: Partial<AppState['pendulum']>) => void
  patchNBody: (p: Partial<Pick<AppState['nbody'], 'masses' | 'y0'>>) => void
  loadPreset: (id: string) => void
  selectBody: (i: number) => void
  setShared: (p: Partial<AppState['shared']>) => void
  setView: (v: View3) => void
  setPlaying: (p: boolean) => void
  setT: (t: number) => void
  setSpeed: (s: number) => void
}
