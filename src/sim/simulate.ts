import { rk4Step, type Deriv } from './ode'

export interface SimResult { ts: number[]; ys: number[][] }

export interface SimOptions { dt: number; tMax: number; maxSamples?: number; haltWhen?: (y: number[]) => boolean }

const allFinite = (y: number[]): boolean => {
  for (let i = 0; i < y.length; i++) if (!Number.isFinite(y[i])) return false
  return true
}

export const simulate = (f: Deriv, y0: number[], o: SimOptions): SimResult => {
  const maxSamples = o.maxSamples ?? 20000
  let y = y0.slice()
  let t = 0
  const ts: number[] = [0]
  const ys: number[][] = [y]
  while (t < o.tMax - o.dt / 2 && ts.length < maxSamples) {
    const next = rk4Step(f, t, y, o.dt)
    if (!allFinite(next)) break
    if (o.haltWhen && o.haltWhen(next)) break
    t += o.dt
    y = next
    ts.push(t)
    ys.push(next)
  }
  return { ts, ys }
}

export const sampleAt = (r: SimResult, t: number): number[] => {
  const n = r.ts.length
  if (n === 0) return []
  if (t <= r.ts[0]) return r.ys[0].slice()
  if (t >= r.ts[n - 1]) return r.ys[n - 1].slice()
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (r.ts[mid] <= t) lo = mid
    else hi = mid
  }
  const f = (t - r.ts[lo]) / (r.ts[hi] - r.ts[lo])
  const a = r.ys[lo]
  const b = r.ys[hi]
  const out = new Array<number>(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] + f * (b[i] - a[i])
  return out
}

export const duration = (r: SimResult): number =>
  r.ts.length < 2 ? 0 : r.ts[r.ts.length - 1]
