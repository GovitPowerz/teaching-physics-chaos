import { type Deriv } from './ode'
import { simulate, type SimOptions, type SimResult } from './simulate'

export interface Ensemble { reference: SimResult; copies: SimResult[] }

export const perturb = (y0: number[], index: number, delta: number): number[] => {
  const out = y0.slice()
  out[index] += delta
  return out
}

export const runEnsemble = (
  f: Deriv, y0: number[], perturbIndex: number, epsilon: number, K: number, o: SimOptions,
): Ensemble => {
  const reference = simulate(f, y0, o)
  const copies: SimResult[] = []
  for (let k = 1; k <= K; k++)
    copies.push(simulate(f, perturb(y0, perturbIndex, k * epsilon), o))
  return { reference, copies }
}

export interface SepSeries { ts: number[]; ds: number[] }

export const separation = (ref: SimResult, copy: SimResult): SepSeries => {
  const n = Math.min(ref.ts.length, copy.ts.length)
  const ts: number[] = []
  const ds: number[] = []
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < ref.ys[i].length; j++) {
      const d = copy.ys[i][j] - ref.ys[i][j]
      sum += d * d
    }
    ts.push(ref.ts[i])
    ds.push(Math.sqrt(sum))
  }
  return { ts, ds }
}

export const stateExtent = (r: SimResult): number => {
  const n = r.ys.length
  if (n === 0) return 0
  const dim = r.ys[0].length
  const mean = new Array<number>(dim).fill(0)
  for (const y of r.ys) for (let j = 0; j < dim; j++) mean[j] += y[j]
  for (let j = 0; j < dim; j++) mean[j] /= n
  let sum = 0
  for (const y of r.ys) {
    for (let j = 0; j < dim; j++) {
      const d = y[j] - mean[j]
      sum += d * d
    }
  }
  return Math.sqrt(sum / n)
}

export interface LyapFit { lambda: number; delta0: number }

export const lyapunovFit = (s: SepSeries, cutoff: number): LyapFit | null => {
  const ts: number[] = []
  const ls: number[] = []
  for (let i = 0; i < s.ds.length; i++) {
    if (s.ds[i] > 0 && s.ds[i] < cutoff) {
      ts.push(s.ts[i])
      ls.push(Math.log(s.ds[i]))
    }
  }
  const n = ts.length
  if (n < 2) return null
  let st = 0
  let sl = 0
  let stt = 0
  let stl = 0
  for (let i = 0; i < n; i++) {
    st += ts[i]
    sl += ls[i]
    stt += ts[i] * ts[i]
    stl += ts[i] * ls[i]
  }
  const lambda = (n * stl - st * sl) / (n * stt - st * st)
  const delta0 = Math.exp((sl - lambda * st) / n)
  return { lambda, delta0 }
}
