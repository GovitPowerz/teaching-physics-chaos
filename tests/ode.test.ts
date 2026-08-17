import { describe, expect, it } from 'vitest'
import { rk4Step, type Deriv } from '../src/sim/ode'

const oscillator: Deriv = (_t, y) => [y[1], -y[0]]

const integrate = (y0: number[], dt: number, tEnd: number): number[] => {
  const steps = Math.round(tEnd / dt)
  let y = y0
  let t = 0
  for (let i = 0; i < steps; i++) {
    y = rk4Step(oscillator, t, y, dt)
    t += dt
  }
  return y
}

describe('rk4Step', () => {
  it('matches cos(t) on the harmonic oscillator', () => {
    const y = integrate([1, 0], Math.PI / 1000, Math.PI)
    expect(y[0]).toBeCloseTo(Math.cos(Math.PI), 8)
    expect(y[1]).toBeCloseTo(-Math.sin(Math.PI), 8)
  })

  it('shows 4th-order convergence when dt halves', () => {
    // Measure the velocity component: RK4's O(dt^4) error on the oscillator is a
    // phase error, and x = cos(t) has zero slope at t = pi, so the dt^4 term
    // vanishes in x there (order ~5 artifact). v = -sin(t) has slope 1 at pi.
    const exact = -Math.sin(Math.PI)
    const e1 = Math.abs(integrate([1, 0], Math.PI / 200, Math.PI)[1] - exact)
    const e2 = Math.abs(integrate([1, 0], Math.PI / 400, Math.PI)[1] - exact)
    const order = Math.log2(e1 / e2)
    expect(order).toBeGreaterThan(3.7)
    expect(order).toBeLessThan(4.3)
  })

  it('feeds the supplied t into time-dependent derivs', () => {
    // y' = 2t integrates to t^2; RK4 is exact on quadratics
    const f: Deriv = (t) => [2 * t]
    let y = [0]
    let t = 0
    for (let i = 0; i < 10; i++) {
      y = rk4Step(f, t, y, 0.1)
      t += 0.1
    }
    expect(y[0]).toBeCloseTo(1, 12)
  })

  it('does not mutate the input state', () => {
    const y = [1, 2]
    rk4Step(oscillator, 0, y, 0.1)
    expect(y).toEqual([1, 2])
  })
})
