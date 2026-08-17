import { describe, expect, it } from 'vitest'
import { pendulumDeriv, solveLinear } from '../src/sim/pendulum'

describe('solveLinear', () => {
  it('solves the identity system', () => {
    const x = solveLinear([[1, 0], [0, 1]], [3, -2])
    expect(x[0]).toBeCloseTo(3, 12)
    expect(x[1]).toBeCloseTo(-2, 12)
  })
  it('solves a hand-computed 2x2 system', () => {
    // 2x + y = 5, x + 3y = 10 -> x = 1, y = 3
    const x = solveLinear([[2, 1], [1, 3]], [5, 10])
    expect(x[0]).toBeCloseTo(1, 12)
    expect(x[1]).toBeCloseTo(3, 12)
  })
  it('pivots past a zero leading entry', () => {
    // naive elimination divides by zero here; partial pivoting must not
    const x = solveLinear([[0, 1], [1, 0]], [2, 3])
    expect(x[0]).toBeCloseTo(3, 12)
    expect(x[1]).toBeCloseTo(2, 12)
  })
  it('solves a 3x3 system with known solution', () => {
    // b = A * [1, 1, 1]; det(A) = -3, nonsingular
    const A = [[1, 2, 3], [4, 5, 6], [7, 8, 10]]
    const x = solveLinear(A, [6, 15, 25])
    expect(x[0]).toBeCloseTo(1, 10)
    expect(x[1]).toBeCloseTo(1, 10)
    expect(x[2]).toBeCloseTo(1, 10)
  })
  it('does not mutate its inputs', () => {
    const A = [[0, 1], [1, 0]]
    const b = [2, 3]
    solveLinear(A, b)
    expect(A).toEqual([[0, 1], [1, 0]])
    expect(b).toEqual([2, 3])
  })
})

describe('pendulumDeriv', () => {
  it('n = 1 reduces to the simple pendulum omegaDot = -sin(theta)', () => {
    const dy = pendulumDeriv(1)(0, [0.7, 0.3])
    expect(dy).toHaveLength(2)
    expect(dy[0]).toBeCloseTo(0.3, 12)
    expect(dy[1]).toBeCloseTo(-Math.sin(0.7), 12)
  })
  it('hanging at rest is stationary (n = 3)', () => {
    const dy = pendulumDeriv(3)(0, [0, 0, 0, 0, 0, 0])
    for (const c of dy) expect(c).toBeCloseTo(0, 12)
  })
  it('n = 2 matches the closed-form double pendulum', () => {
    // absolute angles, equal m = l = 1, g = 1, d = t1 - t2:
    // M = [[2, cos d], [cos d, 1]]
    // b = [-sin(d)*w2^2 - 2*sin t1, sin(d)*w1^2 - sin t2]
    const t1 = 0.5
    const t2 = -0.3
    const w1 = 0.2
    const w2 = -0.7
    const d = t1 - t2
    const b1 = -Math.sin(d) * w2 * w2 - 2 * Math.sin(t1)
    const b2 = Math.sin(d) * w1 * w1 - Math.sin(t2)
    const det = 2 - Math.cos(d) * Math.cos(d)
    const a1 = (b1 - Math.cos(d) * b2) / det
    const a2 = (2 * b2 - Math.cos(d) * b1) / det
    const dy = pendulumDeriv(2)(0, [t1, t2, w1, w2])
    expect(dy[0]).toBeCloseTo(w1, 12)
    expect(dy[1]).toBeCloseTo(w2, 12)
    expect(dy[2]).toBeCloseTo(a1, 12)
    expect(dy[3]).toBeCloseTo(a2, 12)
  })
})
