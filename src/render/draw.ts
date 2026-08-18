import type { LyapFit, SepSeries } from '../sim/ensemble'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const COLORS = {
  bg: css('--bg'),
  grid: css('--grid'),
  fg: css('--fg'),
  accent: css('--accent'),
  muted: css('--muted'),
  ensemble: Array.from({ length: 10 }, (_, i) => css('--ensemble-' + i)),
}

export const ensembleColor = (k: number): string =>
  COLORS.ensemble[k % COLORS.ensemble.length]

// One stroke() per segment cannot hold 60fps on 8000-sample trails; batch
// segments into alpha buckets so each trail costs at most BUCKETS strokes.
const BUCKETS = 24

// even-stride decimation to at most maxPts points; always keeps the last
// point so a decimated trail's head still lands on the true current sample
export const decimate = <T,>(pts: T[], maxPts: number): T[] => {
  if (pts.length <= maxPts) return pts
  const stride = Math.ceil(pts.length / maxPts)
  const out: T[] = []
  for (let i = 0; i < pts.length; i += stride) out.push(pts[i])
  const last = pts[pts.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

export const drawFadingTrail = (
  ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, color: string, upTo: number,
  windowPts?: number, tailAlpha: number = 0.05,
): void => {
  const end = Math.min(Math.floor(upTo), pts.length - 1)
  if (end < 1) return
  const start = windowPts !== undefined ? Math.max(0, end - windowPts) : 0
  const span = end - start
  if (span < 1) return
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  const per = Math.max(1, Math.ceil(span / BUCKETS))
  for (let s0 = start; s0 < end; s0 += per) {
    const stop = Math.min(s0 + per, end)
    ctx.globalAlpha = tailAlpha + (0.9 - tailAlpha) * ((stop - start) / span)
    ctx.beginPath()
    ctx.moveTo(pts[s0].x, pts[s0].y)
    for (let i = s0 + 1; i <= stop; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// paused-at-t0 preview: the whole trajectory at a uniform faint alpha, no ramp
export const drawTrailMap = (
  ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, color: string, alpha: number,
): void => {
  if (pts.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.globalAlpha = alpha
  ctx.beginPath()
  let pen = false
  for (const p of pts) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      if (pen) ctx.lineTo(p.x, p.y)
      else ctx.moveTo(p.x, p.y)
      pen = true
    } else {
      pen = false
    }
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

export const drawDivergenceStrip = (
  ctx: CanvasRenderingContext2D, w: number, h: number,
  series: SepSeries[], fit: LyapFit | null, cutoff: number, tCurrent: number, tMax: number,
): void => {
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, w, h)
  if (tMax <= 0) return
  const xOf = (t: number) => (t / tMax) * w
  // walk at most ~2 samples per pixel per series; long horizons can carry
  // tens of thousands of points and this strip redraws every frame
  const strideOf = (n: number): number => Math.max(1, Math.ceil(n / (2 * w)))
  let lo = Infinity
  let hi = -Infinity
  const grow = (v: number) => {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  for (const s of series) {
    const stride = strideOf(s.ds.length)
    for (let i = 0; i < s.ds.length; i += stride) {
      const d = s.ds[i]
      if (d > 0 && Number.isFinite(d)) grow(Math.log10(d))
    }
  }
  const logCut = cutoff > 0 && Number.isFinite(cutoff) ? Math.log10(cutoff) : null
  if (logCut !== null) grow(logCut)
  if (lo <= hi) {
    if (hi - lo < 1e-9) {
      lo -= 1
      hi += 1
    }
    const pad = 6
    const yOf = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad)
    if (logCut !== null) {
      ctx.strokeStyle = COLORS.muted
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(0, yOf(logCut))
      ctx.lineTo(w, yOf(logCut))
      ctx.stroke()
    }
    ctx.setLineDash([])
    for (let k = 0; k < series.length; k++) {
      ctx.strokeStyle = ensembleColor(k)
      ctx.lineWidth = 1
      ctx.beginPath()
      let pen = false
      const s = series[k]
      const stride = strideOf(s.ts.length)
      for (let i = 0; i < s.ts.length; i += stride) {
        const d = s.ds[i]
        if (d > 0 && Number.isFinite(d)) {
          const x = xOf(s.ts[i])
          const y = yOf(Math.log10(d))
          if (pen) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
          pen = true
        } else {
          pen = false
        }
      }
      ctx.stroke()
    }
    if (fit) {
      const logAt = (t: number) => (Math.log(fit.delta0) + fit.lambda * t) / Math.LN10
      ctx.strokeStyle = COLORS.fg
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(xOf(0), yOf(logAt(0)))
      ctx.lineTo(xOf(tMax), yOf(logAt(tMax)))
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  const tx = xOf(Math.min(Math.max(tCurrent, 0), tMax))
  ctx.strokeStyle = COLORS.fg
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.moveTo(tx, 0)
  ctx.lineTo(tx, h)
  ctx.stroke()
  ctx.globalAlpha = 1
}
