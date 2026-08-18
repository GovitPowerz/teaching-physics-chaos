import type { Deriv } from './ode'

// state y = [x1, y1, vx1, vy1, x2, y2, vx2, vy2, ...]; G = 1
export const SOFTENING = 0.05

export interface NBodyParams { masses: number[]; softening: number }

export const nbodyDeriv = (p: NBodyParams): Deriv => (_t, y) => {
  const n = p.masses.length
  const e2 = p.softening * p.softening
  const out = new Array<number>(4 * n).fill(0)
  for (let i = 0; i < n; i++) {
    out[4 * i] = y[4 * i + 2]
    out[4 * i + 1] = y[4 * i + 3]
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = y[4 * j] - y[4 * i]
      const dy = y[4 * j + 1] - y[4 * i + 1]
      const denom = Math.pow(dx * dx + dy * dy + e2, 1.5)
      out[4 * i + 2] += p.masses[j] * dx / denom
      out[4 * i + 3] += p.masses[j] * dy / denom
      out[4 * j + 2] -= p.masses[i] * dx / denom
      out[4 * j + 3] -= p.masses[i] * dy / denom
    }
  }
  return out
}

export const nbodyEnergy = (p: NBodyParams, y: number[]): number => {
  const n = p.masses.length
  const e2 = p.softening * p.softening
  let e = 0
  for (let i = 0; i < n; i++) {
    const vx = y[4 * i + 2]
    const vy = y[4 * i + 3]
    e += 0.5 * p.masses[i] * (vx * vx + vy * vy)
    for (let j = i + 1; j < n; j++) {
      const dx = y[4 * j] - y[4 * i]
      const dy = y[4 * j + 1] - y[4 * i + 1]
      e -= p.masses[i] * p.masses[j] / Math.sqrt(dx * dx + dy * dy + e2)
    }
  }
  return e
}

export const nbodyAngularMomentum = (p: NBodyParams, y: number[]): number => {
  let l = 0
  for (let i = 0; i < p.masses.length; i++) {
    l += p.masses[i] * (y[4 * i] * y[4 * i + 3] - y[4 * i + 1] * y[4 * i + 2])
  }
  return l
}

export interface NBodyPreset {
  id: string
  label: string
  masses: number[]
  y0: number[]
  halfExtent: number
  tMax: number
  maxSamples: number
}

// all presets carry zero net momentum (velocities rounded to 8 decimals)
export const PRESETS: NBodyPreset[] = [
  {
    id: 'figure8',
    label: 'Figure 8',
    masses: [1, 1, 1],
    y0: [
      0.97000436, -0.24308753, 0.46620368, 0.43236573,
      -0.97000436, 0.24308753, 0.46620368, 0.43236573,
      0, 0, -0.93240737, -0.86473146,
    ],
    halfExtent: 1.5,
    tMax: 20,
    maxSamples: 20000,
  },
  {
    id: 'pythagorean',
    label: 'Pythagorean',
    masses: [3, 4, 5],
    y0: [
      1, 3, 0, 0,
      -2, -1, 0, 0,
      1, -1, 0, 0,
    ],
    halfExtent: 4,
    tMax: 60,
    maxSamples: 40000,
  },
  {
    id: 'sun2planets',
    label: 'Sun + 2 planets',
    masses: [20, 1, 1],
    y0: [
      0, 0, 0, -0.05347474,
      1.5, 0, 0, 3.65148372,
      -3, 0, 0, -2.5819889,
    ],
    halfExtent: 4,
    tMax: 40,
    maxSamples: 40000,
  },
  {
    id: 'binaryPlanet',
    label: 'Binary + planet',
    masses: [10, 10, 0.01],
    y0: [
      0.5, 0, 0, 2.23477763,
      -0.5, 0, 0, -2.23735833,
      3, 0, 0, 2.58069855,
    ],
    halfExtent: 4,
    tMax: 40,
    maxSamples: 40000,
  },
]
