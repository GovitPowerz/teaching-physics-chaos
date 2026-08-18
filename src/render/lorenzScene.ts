import { FIT_FRACTION, SCENES } from '../scenes'
import { lyapunovFit, separation, stateExtent, type LyapFit, type SepSeries } from '../sim/ensemble'
import { project, unprojectDelta } from '../sim/projection'
import { duration } from '../sim/simulate'
import type { AppState, Store } from '../state'
import type { SceneRenderer } from '../main'
import { hitTest, numRow, sliderRow, type Handle, type Pt } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'
import {
  COLORS, decimate, drawDivergenceStrip, drawFadingTrail, drawTrailMap, ensembleColor,
} from './draw'

const MAP_MAX_PTS = 2000
const TRAIL_MAX_PTS = 600

const ROT_PER_PX = 0.01
const MARGIN = 1.1

interface GeomCache { rev: number; c: [number, number, number]; r: number }
interface TrailCache {
  rev: number; yaw: number; pitch: number; w: number; h: number
  pts: Array<Array<{ x: number; y: number }>>
}
interface MapCache {
  rev: number; yaw: number; pitch: number; w: number; h: number
  pts: Array<Array<{ x: number; y: number }>>
}
interface DivCache { rev: number; series: SepSeries[]; fit: LyapFit | null; cutoff: number }

export const createLorenzScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let strip: HTMLCanvasElement
  let sctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}
  let geomCache: GeomCache | null = null
  let trailCache: TrailCache | null = null
  let mapCache: MapCache | null = null
  let divCache: DivCache | null = null
  let dragMode: 'ic' | 'view' | null = null
  let lastRot: Pt | null = null
  let pendingIc: Pt | null = null
  let rafId: number | null = null

  const geom = (s: AppState): GeomCache => {
    if (geomCache && geomCache.rev === s.revision) return geomCache
    const ys = s.ensemble.reference.ys
    let cx = 0
    let cy = 0
    let cz = 0
    for (const y of ys) { cx += y[0]; cy += y[1]; cz += y[2] }
    const n = Math.max(1, ys.length)
    const c: [number, number, number] = [cx / n, cy / n, cz / n]
    let r = 0
    for (const y of ys) r = Math.max(r, Math.hypot(y[0] - c[0], y[1] - c[1], y[2] - c[2]))
    geomCache = { rev: s.revision, c, r: Math.max(r, 1) }
    return geomCache
  }

  const vp = (): Viewport => {
    const s = store.get()
    const g = geom(s)
    const pc = project(s.lorenz.view, g.c)
    const m = g.r * MARGIN
    return {
      world: { xMin: pc[0] - m, xMax: pc[0] + m, yMin: pc[1] - m, yMax: pc[1] + m },
      w: canvas.clientWidth, h: canvas.clientHeight,
    }
  }

  const trails = (s: AppState): Array<Array<{ x: number; y: number }>> => {
    const view = s.lorenz.view
    const c = trailCache
    if (c && c.rev === s.revision && c.yaw === view.yaw && c.pitch === view.pitch
      && c.w === canvas.width && c.h === canvas.height) return c.pts
    const vport = vp()
    const pts = [s.ensemble.reference, ...s.ensemble.copies].map((r) =>
      r.ys.map((y) => {
        const p = project(view, y as [number, number, number])
        return toScreen(vport, { x: p[0], y: p[1] })
      }))
    trailCache = {
      rev: s.revision, yaw: view.yaw, pitch: view.pitch,
      w: canvas.width, h: canvas.height, pts,
    }
    return pts
  }

  const mapPts = (s: AppState): Array<Array<{ x: number; y: number }>> => {
    const view = s.lorenz.view
    const c = mapCache
    if (c && c.rev === s.revision && c.yaw === view.yaw && c.pitch === view.pitch
      && c.w === canvas.width && c.h === canvas.height) return c.pts
    const pts = trails(s).map((track) => decimate(track, MAP_MAX_PTS))
    mapCache = {
      rev: s.revision, yaw: view.yaw, pitch: view.pitch,
      w: canvas.width, h: canvas.height, pts,
    }
    return mapCache.pts
  }

  const divergence = (s: AppState): DivCache => {
    if (divCache && divCache.rev === s.revision) return divCache
    const ref = s.ensemble.reference
    const series = s.ensemble.copies.map((copy) => separation(ref, copy))
    const cutoff = FIT_FRACTION * stateExtent(ref)
    divCache = { rev: s.revision, series, cutoff, fit: lyapunovFit(series[0], cutoff) }
    return divCache
  }

  const icHandle = (): Handle => {
    const s = store.get()
    const p = project(s.lorenz.view, s.lorenz.y0)
    return { id: 'ic', pos: toScreen(vp(), { x: p[0], y: p[1] }), radius: 12 }
  }

  const applyIcDrag = (): void => {
    rafId = null
    if (!pendingIc) return
    const s = store.get()
    const w = toWorld(vp(), pendingIc)
    pendingIc = null
    const pr = project(s.lorenz.view, s.lorenz.y0)
    const d = unprojectDelta(s.lorenz.view, w.x - pr[0], w.y - pr[1])
    const y0 = s.lorenz.y0
    store.patchLorenz({ y0: [y0[0] + d[0], y0[1] + d[1], y0[2] + d[2]] })
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    if (strip.width !== strip.clientWidth || strip.height !== strip.clientHeight) {
      strip.width = strip.clientWidth; strip.height = strip.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const atStart = !s.playback.playing && s.playback.t === 0
    const ref = s.ensemble.reference
    const recordedDt = ref.ts.length > 1
      ? ref.ts[1] - ref.ts[0] : SCENES.lorenz.dt * SCENES.lorenz.stride
    if (atStart) {
      mapPts(s).forEach((pts, i) =>
        drawTrailMap(ctx, pts, i === 0 ? COLORS.accent : ensembleColor(i - 1), 0.12))
    } else {
      const windowPts = Math.max(1, Math.round(SCENES.lorenz.fadeWindow / recordedDt))
      trails(s).forEach((pts, i) => {
        const upToIdx = Math.max(0, Math.min(pts.length - 1, Math.round(s.playback.t / recordedDt)))
        const start = Math.max(0, upToIdx - windowPts)
        const win = decimate(pts.slice(start, upToIdx + 1), TRAIL_MAX_PTS)
        drawFadingTrail(ctx, win, i === 0 ? COLORS.accent : ensembleColor(i - 1),
          win.length - 1, win.length - 1)
      })
    }

    const pr = project(s.lorenz.view, s.lorenz.y0)
    const dot = toScreen(vp(), { x: pr[0], y: pr[1] })
    ctx.fillStyle = COLORS.fg
    ctx.beginPath(); ctx.arc(dot.x, dot.y, 5, 0, 2 * Math.PI); ctx.fill()

    const d = divergence(s)
    sctx.clearRect(0, 0, strip.width, strip.height)
    drawDivergenceStrip(sctx, strip.width, strip.height, d.series, d.fit, d.cutoff,
      s.playback.t, duration(s.ensemble.reference))
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      canvas.className = 'main'
      canvas.style.flex = '1 1 0'
      canvas.style.minHeight = '0'
      canvas.style.width = '100%'
      ctx = canvas.getContext('2d')!
      strip = document.createElement('canvas')
      strip.className = 'strip'
      strip.style.flex = '0 0 120px'
      strip.style.width = '100%'
      strip.style.height = '120px'
      sctx = strip.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        sliderRow('rho \u03c1 (sigma, beta fixed)', 0, 40, 0.1,
          () => store.get().lorenz.rho, (rho) => store.patchLorenz({ rho })),
        numRow('x0', () => store.get().lorenz.y0[0],
          (v) => { const [, y, z] = store.get().lorenz.y0; store.patchLorenz({ y0: [v, y, z] }) },
          { min: -50, max: 50 }),
        numRow('y0', () => store.get().lorenz.y0[1],
          (v) => { const [x, , z] = store.get().lorenz.y0; store.patchLorenz({ y0: [x, v, z] }) },
          { min: -50, max: 50 }),
        numRow('z0', () => store.get().lorenz.y0[2],
          (v) => { const [x, y] = store.get().lorenz.y0; store.patchLorenz({ y0: [x, y, v] }) },
          { min: -50, max: 50 }),
      ]
      controls.append(...rows.map((r) => r.el))
      refreshRows = () => rows.forEach((r) => r.refresh())
      const hint = document.createElement('label')
      hint.textContent = 'drag the dot to move the start point; drag empty space to rotate'
      controls.appendChild(hint)
      root.append(canvas, strip, controls)

      const local = (ev: PointerEvent): Pt => {
        const r = canvas.getBoundingClientRect()
        return { x: ev.clientX - r.left, y: ev.clientY - r.top }
      }
      canvas.addEventListener('pointerdown', (ev) => {
        const p = local(ev)
        dragMode = hitTest([icHandle()], p) === 'ic' ? 'ic' : 'view'
        lastRot = p
        canvas.setPointerCapture(ev.pointerId)
        canvas.style.cursor = 'grabbing'
      })
      canvas.addEventListener('pointermove', (ev) => {
        const p = local(ev)
        if (!dragMode) {
          canvas.style.cursor = hitTest([icHandle()], p) ? 'grab' : 'default'
          return
        }
        if (dragMode === 'ic') {
          pendingIc = p
          if (rafId === null) rafId = requestAnimationFrame(applyIcDrag)
        } else {
          const s = store.get()
          const yaw = s.lorenz.view.yaw + (p.x - lastRot!.x) * ROT_PER_PX
          const pitch = Math.min(Math.PI / 2, Math.max(-Math.PI / 2,
            s.lorenz.view.pitch + (p.y - lastRot!.y) * ROT_PER_PX))
          store.setView({ yaw, pitch })
        }
        lastRot = p
      })
      const endDrag = (): void => {
        dragMode = null
        lastRot = null
        pendingIc = null
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
        canvas.style.cursor = 'default'
      }
      canvas.addEventListener('pointerup', endDrag)
      canvas.addEventListener('pointercancel', endDrag)
    },
    unmount: () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
      dragMode = null; lastRot = null; pendingIc = null
      canvas.remove(); strip.remove(); controls.remove()
    },
    render,
  }
}
