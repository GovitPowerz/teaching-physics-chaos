import { FIT_FRACTION } from '../scenes'
import { lyapunovFit, separation, stateExtent, type LyapFit, type SepSeries }
  from '../sim/ensemble'
import { PRESETS } from '../sim/nbody'
import { duration, sampleAt, type SimResult } from '../sim/simulate'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, buttonRow, numRow, sliderRow, type ControlRow, type Handle }
  from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'
import { COLORS, drawDivergenceStrip, drawFadingTrail, ensembleColor } from './draw'

// cap on screen points per trail: 40000-sample runs stride down to ~1500 pts
// so K copies x N bodies of fading trails stay cheap to stroke every frame
const TRAIL_POINTS = 1500

const bodyRadius = (m: number): number => Math.max(3, 5 * Math.cbrt(m))

// largest index with ts[i] <= t (binary search); clamps past-the-end times to
// the last sample, so truncated copies freeze at their last good sample
const sampleIndex = (ts: number[], t: number): number => {
  let lo = 0
  let hi = ts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ts[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

const arrow = (
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number }, to: { x: number; y: number }, color: string,
): void => {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
  ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
  ctx.closePath()
  ctx.fill()
}

interface TrailCache {
  rev: number
  w: number
  h: number
  stride: number
  ref: Array<Array<{ x: number; y: number }>>
  copies: Array<Array<Array<{ x: number; y: number }>>>
}

interface SepCache {
  rev: number
  series: SepSeries[]
  fit: LyapFit | null
  cutoff: number
}

export const createNbodyScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let strip: HTMLCanvasElement
  let sctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let lastSelected = -1
  let rows: ControlRow[] = []
  let trails: TrailCache | null = null
  let sep: SepCache | null = null

  const preset = () =>
    PRESETS.find((p) => p.id === store.get().nbody.presetId) ?? PRESETS[0]

  const vp = (): Viewport => {
    const he = preset().halfExtent
    return {
      world: { xMin: -he, xMax: he, yMin: -he, yMax: he },
      w: canvas.clientWidth,
      h: canvas.clientHeight,
    }
  }

  // bodies listed before velocity tips: on an exact hit-distance tie (a preset
  // at rest puts the arrow tip on the body) the body wins, matching the
  // sibling's testPos-before-testVel priority
  const handles = (): Handle[] => {
    const nb = store.get().nbody
    const hs: Handle[] = []
    for (let i = 0; i < nb.masses.length; i++) {
      hs.push({
        id: `body:${i}`,
        pos: toScreen(vp(), { x: nb.y0[4 * i], y: nb.y0[4 * i + 1] }),
        radius: Math.max(12, bodyRadius(nb.masses[i]) + 4),
      })
    }
    for (let i = 0; i < nb.masses.length; i++) {
      hs.push({
        id: `vel:${i}`,
        pos: toScreen(vp(), {
          x: nb.y0[4 * i] + nb.y0[4 * i + 2],
          y: nb.y0[4 * i + 1] + nb.y0[4 * i + 3],
        }),
        radius: 10,
      })
    }
    return hs
  }

  // paired IC text field for one component of the SELECTED body; get/set read
  // the live selection so refresh() reflects selection changes
  const icRow = (label: string, d: number, min: number, max: number): ControlRow =>
    numRow(label,
      () => store.get().nbody.y0[4 * store.get().nbody.selected + d],
      (v) => {
        const nb = store.get().nbody
        const y0 = nb.y0.slice()
        y0[4 * nb.selected + d] = v
        store.patchNBody({ y0 })
      },
      { min, max })

  const rebuildControls = () => {
    const sel = store.get().nbody.selected
    controls.innerHTML = ''
    rows = []
    controls.appendChild(
      buttonRow(PRESETS.map((p) => p.label), (i) => store.loadPreset(PRESETS[i].id)))
    const massRow = sliderRow(`mass of body ${sel + 1}`, 0.01, 20, 0.01,
      () => store.get().nbody.masses[sel],
      (m) => {
        const masses = store.get().nbody.masses.slice()
        masses[sel] = m
        store.patchNBody({ masses })
      })
    rows.push(massRow)
    controls.appendChild(massRow.el)
    for (const r of [icRow('x', 0, -20, 20), icRow('y', 1, -20, 20),
      icRow('vx', 2, -10, 10), icRow('vy', 3, -10, 10)]) {
      rows.push(r)
      controls.appendChild(r.el)
    }
    const hint = document.createElement('label')
    hint.textContent = 'tap a body to select it, drag bodies and arrow tips'
    controls.appendChild(hint)
  }

  const buildTrails = (): TrailCache => {
    const s = store.get()
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (trails && trails.rev === s.revision && trails.w === w && trails.h === h)
      return trails
    const view = vp()
    const n = s.nbody.masses.length
    const stride =
      Math.max(1, Math.floor(s.ensemble.reference.ts.length / TRAIL_POINTS))
    const projectBody = (r: SimResult, i: number) => {
      const pts: Array<{ x: number; y: number }> = []
      for (let k = 0; k < r.ys.length; k += stride)
        pts.push(toScreen(view, { x: r.ys[k][4 * i], y: r.ys[k][4 * i + 1] }))
      return pts
    }
    const bodies = Array.from({ length: n }, (_, i) => i)
    trails = {
      rev: s.revision, w, h, stride,
      ref: bodies.map((i) => projectBody(s.ensemble.reference, i)),
      copies: s.ensemble.copies.map((c) => bodies.map((i) => projectBody(c, i))),
    }
    return trails
  }

  const divergence = (): SepCache => {
    const s = store.get()
    if (sep && sep.rev === s.revision) return sep
    const series = s.ensemble.copies.map((c) => separation(s.ensemble.reference, c))
    const cutoff = FIT_FRACTION * stateExtent(s.ensemble.reference)
    const fit = series.length > 0 ? lyapunovFit(series[0], cutoff) : null
    sep = { rev: s.revision, series, fit, cutoff }
    return sep
  }

  const render = () => {
    const s = store.get()
    if (lastSelected !== s.nbody.selected) {
      lastSelected = s.nbody.selected
      rebuildControls()
    }
    rows.forEach((r) => r.refresh())
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    if (strip.width !== strip.clientWidth || strip.height !== strip.clientHeight) {
      strip.width = strip.clientWidth; strip.height = strip.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const view = vp()
    const nb = s.nbody
    const n = nb.masses.length
    const t = s.playback.t
    const tc = buildTrails()

    // trail reveal: full trail when paused at t=0, truncated to the current
    // sample index otherwise (precompute + scrub invariant), mirroring the
    // atStart branch in lorenzScene/pendulumScene
    const atStart = !s.playback.playing && t === 0

    s.ensemble.copies.forEach((c, k) => {
      if (c.ts.length < 2) return
      const upTo = atStart
        ? tc.copies[k][0].length - 1
        : Math.floor(sampleIndex(c.ts, t) / tc.stride)
      for (let i = 0; i < n; i++)
        drawFadingTrail(ctx, tc.copies[k][i], ensembleColor(k), upTo)
    })
    const ref = s.ensemble.reference
    if (ref.ts.length >= 2) {
      const upTo = atStart
        ? tc.ref[0].length - 1
        : Math.floor(sampleIndex(ref.ts, t) / tc.stride)
      for (let i = 0; i < n; i++) drawFadingTrail(ctx, tc.ref[i], COLORS.fg, upTo)
    }

    s.ensemble.copies.forEach((c, k) => {
      const y = sampleAt(c, t)
      if (y.length === 0) return
      ctx.fillStyle = ensembleColor(k)
      for (let i = 0; i < n; i++) {
        const p = toScreen(view, { x: y[4 * i], y: y[4 * i + 1] })
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI); ctx.fill()
      }
    })

    const cur = sampleAt(ref, t)
    if (cur.length > 0) {
      for (let i = 0; i < n; i++) {
        const p = toScreen(view, { x: cur[4 * i], y: cur[4 * i + 1] })
        ctx.fillStyle = COLORS.fg
        ctx.beginPath()
        ctx.arc(p.x, p.y, bodyRadius(nb.masses[i]), 0, 2 * Math.PI)
        ctx.fill()
        if (nb.selected === i) {
          ctx.strokeStyle = COLORS.accent
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(p.x, p.y, bodyRadius(nb.masses[i]) + 3, 0, 2 * Math.PI)
          ctx.stroke()
        }
      }
    }

    // initial-condition markers: ring at y0 position, arrow to y0 velocity tip
    // (the drag targets; the filled bodies above follow playback time)
    for (let i = 0; i < n; i++) {
      const a = toScreen(view, { x: nb.y0[4 * i], y: nb.y0[4 * i + 1] })
      const b = toScreen(view, {
        x: nb.y0[4 * i] + nb.y0[4 * i + 2],
        y: nb.y0[4 * i + 1] + nb.y0[4 * i + 3],
      })
      if (Math.hypot(b.x - a.x, b.y - a.y) > 1) arrow(ctx, a, b, COLORS.accent)
      ctx.strokeStyle = COLORS.muted
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(a.x, a.y, bodyRadius(nb.masses[i]) + 1, 0, 2 * Math.PI)
      ctx.stroke()
    }

    sctx.clearRect(0, 0, strip.width, strip.height)
    const d = divergence()
    drawDivergenceStrip(sctx, strip.width, strip.height, d.series, d.fit, d.cutoff,
      t, duration(ref))
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
      trails = null
      sep = null
      lastSelected = store.get().nbody.selected
      rebuildControls()
      root.append(canvas, strip, controls)
      attachDrag(canvas, handles,
        (id, screenPos) => {
          const w = toWorld(vp(), screenPos)
          const nb = store.get().nbody
          const i = Number(id.slice(id.indexOf(':') + 1))
          const y0 = nb.y0.slice()
          if (id.startsWith('body:')) {
            if (nb.selected !== i) store.selectBody(i)
            y0[4 * i] = w.x; y0[4 * i + 1] = w.y
          } else {
            y0[4 * i + 2] = w.x - y0[4 * i]; y0[4 * i + 3] = w.y - y0[4 * i + 1]
          }
          store.patchNBody({ y0 })
        },
        undefined,
        (id) => {
          if (id.startsWith('body:')) store.selectBody(Number(id.slice(5)))
        })
    },
    unmount: () => { canvas.remove(); strip.remove(); controls.remove() },
    render,
  }
}
