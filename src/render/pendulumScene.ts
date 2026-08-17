import { jointPositions, poseDragThetas } from '../sim/pendulum'
import { duration, sampleAt, type SimResult } from '../sim/simulate'
import { lyapunovFit, separation, stateExtent, type LyapFit, type SepSeries }
  from '../sim/ensemble'
import { FIT_FRACTION } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, sliderRow, type ControlRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'
import { COLORS, drawDivergenceStrip, drawFadingTrail, ensembleColor } from './draw'

// cap trail polylines: with dt = 0.002 over tMax = 30 a full-resolution trail is
// 15001 points per copy; decimate to <= TRAIL_MAX points (head lag <= stride*dt,
// invisible; the exact current tip is drawn as a marker anyway)
const TRAIL_MAX = 600

interface SceneCache {
  rev: number
  stride: number
  tips: Array<Array<{ x: number; y: number }>> // [reference, ...copies], world coords
  series: SepSeries[]
  fit: LyapFit | null
  cutoff: number
}

export const createPendulumScene = (store: Store): SceneRenderer => {
  let rootEl: HTMLElement
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let strip: HTMLCanvasElement
  let sctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let rows: ControlRow[] = []
  let cache: SceneCache | null = null

  const vp = (): Viewport => {
    const half = store.get().pendulum.n + 0.5
    return {
      world: { xMin: -half, xMax: half, yMin: -half, yMax: half },
      w: canvas.clientWidth, h: canvas.clientHeight,
    }
  }

  const tipTrack = (r: SimResult, n: number, stride: number): Array<{ x: number; y: number }> => {
    const out: Array<{ x: number; y: number }> = []
    for (let i = 0; i < r.ys.length; i += stride) {
      const js = jointPositions(r.ys[i].slice(0, n))
      out.push(js[js.length - 1])
    }
    return out
  }

  const sceneCache = (): SceneCache => {
    const s = store.get()
    if (cache && cache.rev === s.revision) return cache
    const ens = s.ensemble
    const stride = Math.max(1, Math.ceil(ens.reference.ts.length / TRAIL_MAX))
    const series = ens.copies.map((c) => separation(ens.reference, c))
    const cutoff = FIT_FRACTION * stateExtent(ens.reference)
    cache = {
      rev: s.revision,
      stride,
      tips: [ens.reference, ...ens.copies].map((r) => tipTrack(r, s.pendulum.n, stride)),
      series,
      fit: series.length > 0 ? lyapunovFit(series[0], cutoff) : null,
      cutoff,
    }
    return cache
  }

  const displayedThetas = (): number[] => {
    const s = store.get()
    const y = sampleAt(s.ensemble.reference, s.playback.t)
    return y.length >= s.pendulum.n ? y.slice(0, s.pendulum.n) : s.pendulum.thetas
  }

  const handles = (): Handle[] =>
    jointPositions(displayedThetas()).map((p, i) =>
      ({ id: `joint:${i}`, pos: toScreen(vp(), p), radius: 14 }))

  const render = () => {
    const s = store.get()
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    if (strip.width !== strip.clientWidth || strip.height !== strip.clientHeight) {
      strip.width = strip.clientWidth; strip.height = strip.clientHeight
    }
    rows.forEach((r) => r.refresh())
    const c = sceneCache()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // trail cutoff index at the current playback time (uniform sample grid)
    const ref = s.ensemble.reference
    const dtSample = ref.ts.length > 1 ? ref.ts[1] - ref.ts[0] : 1
    const idx = Math.max(0, Math.min(ref.ts.length - 1, Math.round(s.playback.t / dtSample)))
    const upTo = Math.floor(idx / c.stride)

    c.tips.forEach((track, k) => {
      const pts = track.slice(0, upTo + 1).map((p) => toScreen(vp(), p))
      if (pts.length > 1)
        drawFadingTrail(ctx, pts, k === 0 ? COLORS.accent : ensembleColor(k - 1), pts.length - 1)
    })

    // ceiling tick + arms + joints of the reference copy at the current time
    const joints = jointPositions(displayedThetas())
    const pivot = toScreen(vp(), { x: 0, y: 0 })

    ctx.strokeStyle = COLORS.muted
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pivot.x - 24, pivot.y); ctx.lineTo(pivot.x + 24, pivot.y)
    ctx.stroke()

    ctx.strokeStyle = COLORS.fg
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(pivot.x, pivot.y)
    for (const p of joints) {
      const q = toScreen(vp(), p)
      ctx.lineTo(q.x, q.y)
    }
    ctx.stroke()

    ctx.fillStyle = COLORS.fg
    ctx.beginPath(); ctx.arc(pivot.x, pivot.y, 4, 0, 2 * Math.PI); ctx.fill()
    joints.forEach((p, i) => {
      const q = toScreen(vp(), p)
      const isTip = i === joints.length - 1
      ctx.fillStyle = isTip ? COLORS.accent : COLORS.fg
      ctx.beginPath(); ctx.arc(q.x, q.y, isTip ? 8 : 6, 0, 2 * Math.PI); ctx.fill()
    })

    // current tip of every perturbed copy (the decimated trail head lags slightly)
    s.ensemble.copies.forEach((copy, k) => {
      const y = sampleAt(copy, s.playback.t)
      if (y.length < s.pendulum.n) return
      const tj = jointPositions(y.slice(0, s.pendulum.n))
      const q = toScreen(vp(), tj[tj.length - 1])
      ctx.fillStyle = ensembleColor(k)
      ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 2 * Math.PI); ctx.fill()
    })

    sctx.clearRect(0, 0, strip.width, strip.height)
    drawDivergenceStrip(sctx, strip.width, strip.height,
      c.series, c.fit, c.cutoff, s.playback.t, duration(ref))
  }

  return {
    mount: (root) => {
      rootEl = root
      root.style.flexDirection = 'column'
      canvas = document.createElement('canvas')
      canvas.className = 'main'
      canvas.style.cssText = 'flex:1;min-height:0;width:100%'
      ctx = canvas.getContext('2d')!
      strip = document.createElement('canvas')
      strip.className = 'strip'
      strip.style.cssText = 'flex:0 0 120px;height:120px;width:100%'
      sctx = strip.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      controls.style.cssText =
        'width:100%;border-left:none;flex-direction:row;flex-wrap:wrap;align-items:flex-end;gap:16px'
      const nRow = sliderRow('links n', 2, 5, 1,
        () => store.get().pendulum.n,
        (n) => store.patchPendulum({ n }))
      nRow.el.style.minWidth = '220px'
      rows = [nRow]
      const hint = document.createElement('label')
      hint.textContent = 'drag a joint to pose the chain; release starts it from rest'
      controls.append(nRow.el, hint)
      root.append(canvas, strip, controls)
      attachDrag(canvas, handles, (id, p) => {
        const w = toWorld(vp(), p)
        const j = Number(id.slice(6))
        store.patchPendulum({
          thetas: poseDragThetas(store.get().pendulum.thetas, j, w.x, w.y),
        })
      })
    },
    unmount: () => {
      canvas.remove(); strip.remove(); controls.remove()
      rootEl.style.flexDirection = ''
    },
    render,
  }
}
