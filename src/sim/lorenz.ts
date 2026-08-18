import { type Deriv } from './ode'

export interface LorenzParams { sigma: number; rho: number; beta: number }

export const CLASSIC: LorenzParams = { sigma: 10, rho: 28, beta: 8 / 3 }

export const lorenzDeriv = (p: LorenzParams): Deriv => (_t, y) => [
  p.sigma * (y[1] - y[0]),
  y[0] * (p.rho - y[2]) - y[1],
  y[0] * y[1] - p.beta * y[2],
]

export const fixedPoints = (p: LorenzParams): number[][] => {
  const pts = [[0, 0, 0]]
  if (p.rho > 1) {
    const s = Math.sqrt(p.beta * (p.rho - 1))
    pts.push([s, s, p.rho - 1], [-s, -s, p.rho - 1])
  }
  return pts
}
