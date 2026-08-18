import { jointPositions, poseDragThetas } from '../sim/pendulum'
import { duration, sampleAt, type SimResult } from '../sim/simulate'
import { lyapunovFit, separation, stateExtent, type LyapFit, type SepSeries }
  from '../sim/ensemble'
import { FIT_FRACTION, SCENES } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, attachTimelineScrub, sliderRow, type ControlRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'
import { COLORS, decimate, drawDivergenceStrip, drawFadingTrail, drawTrailMap, ensembleColor } from './draw'

// windowed bright trail: decimate the in-window slice to <= TRAIL_MAX_PTS
// (head lag invisible; the exact current tip is drawn as a marker anyway);
// paused-at-t0 map: decimate the whole track to <= MAP_MAX_PTS
const TRAIL_MAX_PTS = 4000
const MAP_MAX_PTS = 10000

interface SceneCache {
  rev: number
  tips: Array<Array<{ x: number; y: number }>> // [reference, ...copies], world coords, full resolution
  series: SepSeries[]
  fit: LyapFit | null
  cutoff: number
}
interface MapCache {
  rev: number; w: number; h: number
  pts: Array<Array<{ x: number; y: number }>> // screen coords, decimated
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
  let mapCache: MapCache | null = null
  // scene-local pose during an active joint drag: rendered immediately, but
  // only committed to the store (one ensemble rebuild) on release - dragging
  // used to patchPendulum per coalesced frame, making posing chunky (~5-10 Hz
  // at n=5, buildEnsemble ~200ms)
  let poseOverride: number[] | null = null

  const vp = (): Viewport => {
    const half = store.get().pendulum.n + 0.5
    return {
      world: { xMin: -half, xMax: half, yMin: -half, yMax: half },
      w: canvas.clientWidth, h: canvas.clientHeight,
    }
  }

  const tipTrack = (r: SimResult, n: number): Array<{ x: number; y: number }> => {
    const out: Array<{ x: number; y: number }> = []
    for (let i = 0; i < r.ys.length; i++) {
      const js = jointPositions(r.ys[i].slice(0, n))
      out.push(js[js.length - 1])
    }
    return out
  }

  const sceneCache = (): SceneCache => {
    const s = store.get()
    if (cache && cache.rev === s.revision) return cache
    const ens = s.ensemble
    const series = ens.copies.map((c) => separation(ens.reference, c))
    const cutoff = FIT_FRACTION * stateExtent(ens.reference)
    cache = {
      rev: s.revision,
      tips: [ens.reference, ...ens.copies].map((r) => tipTrack(r, s.pendulum.n)),
      series,
      fit: series.length > 0 ? lyapunovFit(series[0], cutoff) : null,
      cutoff,
    }
    return cache
  }

  const mapPts = (): Array<Array<{ x: number; y: number }>> => {
    const s = store.get()
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (mapCache && mapCache.rev === s.revision && mapCache.w === w && mapCache.h === h) return mapCache.pts
    const c = sceneCache()
    const pts = c.tips.map((track) => decimate(track, MAP_MAX_PTS).map((p) => toScreen(vp(), p)))
    mapCache = { rev: s.revision, w, h, pts }
    return mapCache.pts
  }

  const displayedThetas = (): number[] => {
    if (poseOverride) return poseOverride
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

    // paused-at-t0: faint full-trajectory map; playing/scrubbed: windowed
    // bright trail sliced [idx - windowPts, idx] on the recorded grid, then
    // decimated for drawing (dtSample: recorded spacing, uniform grid)
    const atStart = !s.playback.playing && s.playback.t === 0
    const ref = s.ensemble.reference
    const dtSample = ref.ts.length > 1
      ? ref.ts[1] - ref.ts[0] : SCENES.pendulum.dt * SCENES.pendulum.stride

    if (atStart) {
      mapPts().forEach((pts, k) =>
        drawTrailMap(ctx, pts, k === 0 ? COLORS.accent : ensembleColor(k - 1), 0.12))
    } else {
      const idx = Math.max(0, Math.min(ref.ts.length - 1, Math.round(s.playback.t / dtSample)))
      const windowPts = Math.max(1,
        Math.round(SCENES.pendulum.fadeWindow * s.fade.windowScale / dtSample))
      const tailAlpha = 0.05 + 0.85 * (1 - s.fade.strength)
      const start = Math.max(0, idx - windowPts)
      c.tips.forEach((track, k) => {
        const win = decimate(track.slice(start, idx + 1), TRAIL_MAX_PTS).map((p) => toScreen(vp(), p))
        if (win.length > 1)
          drawFadingTrail(ctx, win, k === 0 ? COLORS.accent : ensembleColor(k - 1),
            win.length - 1, win.length - 1, tailAlpha)
      })
    }

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
      attachTimelineScrub(strip, (frac) => {
        store.setPlaying(false)
        store.setT(frac * duration(store.get().ensemble.reference))
      })
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
        const base = poseOverride ?? store.get().pendulum.thetas
        poseOverride = poseDragThetas(base, j, w.x, w.y)
      })
      const commitPose = () => {
        if (!poseOverride) return
        const thetas = poseOverride
        poseOverride = null
        store.patchPendulum({ thetas })
      }
      canvas.addEventListener('pointerup', commitPose)
      canvas.addEventListener('pointercancel', commitPose)
    },
    unmount: () => {
      poseOverride = null
      canvas.remove(); strip.remove(); controls.remove()
      rootEl.style.flexDirection = ''
    },
    render,
  }
}
