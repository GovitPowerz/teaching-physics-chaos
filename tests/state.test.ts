import { describe, expect, it } from 'vitest'
import { PRESETS } from '../src/sim/nbody'
import { duration } from '../src/sim/simulate'
import { createStore } from '../src/state'

describe('store', () => {
  it('defaults match the contract', () => {
    const st = createStore().get()
    const f8 = PRESETS.find((p) => p.id === 'figure8')!
    expect(st.tab).toBe('lorenz')
    expect(st.lorenz).toEqual({ rho: 28, y0: [-1.39, -2.47, 11.86], view: { yaw: 0, pitch: 0 } })
    expect(st.pendulum.n).toBe(3)
    expect(st.pendulum.thetas).toEqual([Math.PI / 2, Math.PI / 2, Math.PI / 2])
    expect(st.nbody.presetId).toBe('figure8')
    expect(st.nbody.selected).toBe(0)
    expect(st.nbody.masses).toEqual(f8.masses)
    expect(st.nbody.masses).not.toBe(f8.masses)
    expect(st.nbody.y0).toEqual(f8.y0)
    expect(st.nbody.y0).not.toBe(f8.y0)
    expect(st.shared).toEqual({ K: 5, epsExp: -6 })
    expect(st.fade).toEqual({ windowScale: 1, strength: 1 })
    expect(st.playback).toEqual({ playing: false, t: 0, speed: 1 })
    expect(st.revision).toBe(0)
    expect(st.ensemble.copies.length).toBe(5)
    expect(st.ensemble.reference.ys[0]).toEqual([-1.39, -2.47, 11.86])
  })
  it('scene mutation rebuilds the ensemble, resets playback, bumps revision, notifies once', () => {
    const s = createStore()
    let n = 0
    s.subscribe(() => n++)
    s.setPlaying(true)
    s.setT(1)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.patchLorenz({ rho: 20 })
    expect(n).toBe(3)
    expect(s.get().lorenz.rho).toBe(20)
    expect(s.get().ensemble).not.toBe(before)
    expect(s.get().revision).toBe(rev + 1)
    expect(s.get().playback.playing).toBe(false)
    expect(s.get().playback.t).toBe(0)
  })
  it('setView updates the view with no recompute', () => {
    const s = createStore()
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.setView({ yaw: 0.5, pitch: 0.2 })
    expect(n).toBe(1)
    expect(s.get().lorenz.view).toEqual({ yaw: 0.5, pitch: 0.2 })
    expect(s.get().ensemble).toBe(before)
    expect(s.get().revision).toBe(rev)
  })
  it('setFade updates fade params with no recompute', () => {
    const s = createStore()
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.setFade({ windowScale: 2, strength: 0.5 })
    expect(n).toBe(1)
    expect(s.get().fade).toEqual({ windowScale: 2, strength: 0.5 })
    expect(s.get().ensemble).toBe(before)
    expect(s.get().revision).toBe(rev)
  })
  it('setFade clamps windowScale to [0.1, 4] and strength to [0, 1]', () => {
    const s = createStore()
    s.setFade({ windowScale: 0.01, strength: -5 })
    expect(s.get().fade.windowScale).toBe(0.1)
    expect(s.get().fade.strength).toBe(0)
    s.setFade({ windowScale: 100, strength: 5 })
    expect(s.get().fade.windowScale).toBe(4)
    expect(s.get().fade.strength).toBe(1)
  })
  it('selectBody on a different body recomputes once (it retargets the perturbation)', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.selectBody(2)
    expect(n).toBe(1)
    expect(s.get().nbody.selected).toBe(2)
    expect(s.get().ensemble).not.toBe(before)
    expect(s.get().revision).toBe(rev + 1)
  })
  it('selectBody on the same body notifies without recompute', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    expect(s.get().nbody.selected).toBe(0)
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.selectBody(0)
    expect(n).toBe(1)
    expect(s.get().nbody.selected).toBe(0)
    expect(s.get().ensemble).toBe(before)
    expect(s.get().revision).toBe(rev)
  })
  it('addBody appends mass 1 and [x,y,0,0.5], selects the new body, recomputes once', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.addBody(1.5, -2)
    expect(n).toBe(1)
    expect(s.get().nbody.masses).toEqual([1, 1, 1, 1])
    expect(s.get().nbody.y0.slice(12, 16)).toEqual([1.5, -2, 0, 0.5])
    expect(s.get().nbody.selected).toBe(3)
    expect(s.get().ensemble).not.toBe(before)
    expect(s.get().revision).toBe(rev + 1)
  })
  it('addBody at 6 bodies is notify-only (revision and ensemble identity unchanged)', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    s.addBody(1, 1)
    s.addBody(2, 2)
    s.addBody(3, 3)
    expect(s.get().nbody.masses.length).toBe(6)
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.addBody(9, 9)
    expect(n).toBe(1)
    expect(s.get().nbody.masses.length).toBe(6)
    expect(s.get().ensemble).toBe(before)
    expect(s.get().revision).toBe(rev)
  })
  it('removeBody splices exactly the selected body\'s mass and 4-slot y0 range', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    const f8 = PRESETS.find((p) => p.id === 'figure8')!
    s.selectBody(1)
    let n = 0
    s.subscribe(() => n++)
    const rev = s.get().revision
    s.removeBody()
    expect(n).toBe(1)
    expect(s.get().nbody.masses).toEqual([f8.masses[0], f8.masses[2]])
    expect(s.get().nbody.y0).toEqual([...f8.y0.slice(0, 4), ...f8.y0.slice(8, 12)])
    // body 2's coords shifted into slot 1
    expect(s.get().nbody.selected).toBe(1)
    expect(s.get().revision).toBe(rev + 1)
  })
  it('removeBody at 2 bodies is notify-only', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    s.removeBody() // 3 -> 2
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    const rev = s.get().revision
    s.removeBody()
    expect(n).toBe(1)
    expect(s.get().nbody.masses.length).toBe(2)
    expect(s.get().ensemble).toBe(before)
    expect(s.get().revision).toBe(rev)
  })
  it('removeBody keeps selected in range when the last body is removed while selected', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    s.selectBody(2) // last of figure8's 3
    s.removeBody()
    expect(s.get().nbody.masses.length).toBe(2)
    expect(s.get().nbody.selected).toBe(1)
  })
  it('playback mutations do not recompute; setT clamps to [0, duration]', () => {
    const s = createStore()
    const before = s.get().ensemble
    const rev = s.get().revision
    s.setPlaying(true)
    s.setSpeed(2)
    s.setT(1e9)
    expect(s.get().ensemble).toBe(before)
    expect(s.get().revision).toBe(rev)
    expect(s.get().playback.playing).toBe(true)
    expect(s.get().playback.speed).toBe(2)
    expect(s.get().playback.t).toBeCloseTo(duration(before.reference), 9)
    s.setT(-5)
    expect(s.get().playback.t).toBe(0)
  })
  it('setTab rebuilds for the new scene', () => {
    const s = createStore()
    const rev = s.get().revision
    s.setTab('pendulum')
    expect(s.get().tab).toBe('pendulum')
    expect(s.get().ensemble.reference.ys[0]).toEqual(
      [Math.PI / 2, Math.PI / 2, Math.PI / 2, 0, 0, 0])
    expect(s.get().revision).toBe(rev + 1)
  })
  it('patchPendulum resizes thetas (keep prefix, pad pi/2) and clamps n to 2..5', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('pendulum')
    s.patchPendulum({ thetas: [0.1, 0.2, 0.3] })
    s.patchPendulum({ n: 5 })
    expect(s.get().pendulum.thetas).toEqual(
      [0.1, 0.2, 0.3, Math.PI / 2, Math.PI / 2])
    expect(s.get().ensemble.reference.ys[0].length).toBe(10)
    s.patchPendulum({ n: 0 })
    expect(s.get().pendulum.n).toBe(2)
    expect(s.get().pendulum.thetas).toEqual([0.1, 0.2])
    s.patchPendulum({ n: 99 })
    expect(s.get().pendulum.n).toBe(5)
    expect(s.get().pendulum.thetas.length).toBe(5)
  })
  it('patchPendulum rounds a non-integer n before clamping', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('pendulum')
    s.patchPendulum({ n: 3.4 })
    expect(s.get().pendulum.n).toBe(3)
    expect(s.get().pendulum.thetas.length).toBe(3)
    s.patchPendulum({ n: 4.6 })
    expect(s.get().pendulum.n).toBe(5)
    expect(s.get().pendulum.thetas.length).toBe(5)
  })
  it('loadPreset copies preset arrays and resets selection', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    s.selectBody(2)
    const p = PRESETS.find((x) => x.id === 'pythagorean')!
    s.loadPreset('pythagorean')
    expect(s.get().nbody.presetId).toBe('pythagorean')
    expect(s.get().nbody.masses).toEqual([3, 4, 5])
    expect(s.get().nbody.y0).toEqual(p.y0)
    expect(s.get().nbody.masses).not.toBe(p.masses)
    expect(s.get().nbody.y0).not.toBe(p.y0)
    expect(s.get().nbody.selected).toBe(0)
    expect(s.get().playback.t).toBe(0)
  })
  it('setShared clamps K and epsExp and resizes the ensemble', () => {
    const s = createStore()
    let n = 0
    s.subscribe(() => n++)
    const before = s.get().ensemble
    s.setShared({ K: 99 })
    expect(s.get().shared.K).toBe(10)
    expect(s.get().ensemble.copies.length).toBe(10)
    expect(s.get().ensemble).not.toBe(before)
    s.setShared({ K: 0 })
    expect(s.get().shared.K).toBe(2)
    expect(s.get().ensemble.copies.length).toBe(2)
    s.setShared({ epsExp: 5 })
    expect(s.get().shared.epsExp).toBe(-2)
    s.setShared({ epsExp: -20 })
    expect(s.get().shared.epsExp).toBe(-9)
    expect(n).toBe(4)
  })
  it('patchNBody rebuilds with the new values', () => {
    const s = createStore()
    s.setShared({ K: 2 })
    s.setTab('nbody')
    s.setPlaying(true)
    const before = s.get().ensemble
    s.patchNBody({ masses: [1, 1, 2] })
    expect(s.get().nbody.masses).toEqual([1, 1, 2])
    expect(s.get().ensemble).not.toBe(before)
    expect(s.get().playback.playing).toBe(false)
    expect(s.get().playback.t).toBe(0)
  })
})
