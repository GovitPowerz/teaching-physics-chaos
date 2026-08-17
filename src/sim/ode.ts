export type Deriv = (t: number, y: number[]) => number[]

export const rk4Step = (f: Deriv, t: number, y: number[], dt: number): number[] => {
  const n = y.length
  const k1 = f(t, y)
  const y2 = new Array<number>(n)
  for (let i = 0; i < n; i++) y2[i] = y[i] + (dt / 2) * k1[i]
  const k2 = f(t + dt / 2, y2)
  const y3 = new Array<number>(n)
  for (let i = 0; i < n; i++) y3[i] = y[i] + (dt / 2) * k2[i]
  const k3 = f(t + dt / 2, y3)
  const y4 = new Array<number>(n)
  for (let i = 0; i < n; i++) y4[i] = y[i] + dt * k3[i]
  const k4 = f(t + dt, y4)
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) out[i] = y[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  return out
}
