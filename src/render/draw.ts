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

export const drawFadingTrail = (
  ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, color: string, upTo: number,
): void => {
  const end = Math.min(Math.floor(upTo), pts.length - 1)
  if (end < 1) return
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  const per = Math.max(1, Math.ceil(end / BUCKETS))
  for (let start = 0; start < end; start += per) {
    const stop = Math.min(start + per, end)
    ctx.globalAlpha = 0.05 + 0.85 * (stop / end)
    ctx.beginPath()
    ctx.moveTo(pts[start].x, pts[start].y)
    for (let i = start + 1; i <= stop; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
  }
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
  let lo = Infinity
  let hi = -Infinity
  const grow = (v: number) => {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  for (const s of series) {
    for (const d of s.ds) if (d > 0 && Number.isFinite(d)) grow(Math.log10(d))
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
      for (let i = 0; i < s.ts.length; i++) {
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
