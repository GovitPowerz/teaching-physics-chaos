import { buildEnsemble } from './scenes'
import type { Ensemble } from './sim/ensemble'
import { PRESETS } from './sim/nbody'
import type { View3 } from './sim/projection'
import { duration } from './sim/simulate'

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

export const createStore = (): Store => {
  const f8 = PRESETS.find((p) => p.id === 'figure8')!
  const state: AppState = {
    tab: 'lorenz',
    // on-attractor IC: butterfly visible on load, fitted lambda ~ 0.86
    lorenz: { rho: 28, y0: [-1.39, -2.47, 11.86], view: { yaw: 0, pitch: 0 } },
    pendulum: { n: 3, thetas: [Math.PI / 2, Math.PI / 2, Math.PI / 2] },
    nbody: { presetId: 'figure8', masses: [...f8.masses], y0: [...f8.y0], selected: 0 },
    shared: { K: 5, epsExp: -6 },
    playback: { playing: false, t: 0, speed: 1 },
    ensemble: { reference: { ts: [], ys: [] }, copies: [] },
    revision: 0,
  }
  state.ensemble = buildEnsemble(state)

  const subs: Array<() => void> = []
  const notify = () => subs.forEach((f) => f())
  const recompute = () => {
    state.ensemble = buildEnsemble(state)
    state.playback.t = 0
    state.playback.playing = false
    state.revision++
    notify()
  }

  return {
    get: () => state,
    subscribe: (fn) => { subs.push(fn) },
    setTab: (tab) => { state.tab = tab; recompute() },
    patchLorenz: (p) => { Object.assign(state.lorenz, p); recompute() },
    patchPendulum: (p) => {
      Object.assign(state.pendulum, p)
      const n = Math.min(5, Math.max(2, Math.round(state.pendulum.n)))
      state.pendulum.n = n
      const old = state.pendulum.thetas
      state.pendulum.thetas = Array.from({ length: n }, (_, i) =>
        i < old.length ? old[i] : Math.PI / 2)
      recompute()
    },
    patchNBody: (p) => { Object.assign(state.nbody, p); recompute() },
    loadPreset: (id) => {
      const p = PRESETS.find((x) => x.id === id)
      if (!p) return
      state.nbody.presetId = id
      state.nbody.masses = [...p.masses]
      state.nbody.y0 = [...p.y0]
      state.nbody.selected = 0
      recompute()
    },
    selectBody: (i) => {
      if (i === state.nbody.selected) { notify(); return }
      state.nbody.selected = i
      recompute()
    },
    setShared: (p) => {
      Object.assign(state.shared, p)
      state.shared.K = Math.min(10, Math.max(2, state.shared.K))
      state.shared.epsExp = Math.min(-2, Math.max(-9, state.shared.epsExp))
      recompute()
    },
    setView: (v) => { state.lorenz.view = v; notify() },
    setPlaying: (p) => { state.playback.playing = p; notify() },
    setT: (t) => {
      state.playback.t = Math.min(duration(state.ensemble.reference), Math.max(0, t))
      notify()
    },
    setSpeed: (s) => { state.playback.speed = s; notify() },
  }
}
