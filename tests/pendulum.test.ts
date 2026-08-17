import { describe, expect, it } from 'vitest'
import { solveLinear } from '../src/sim/pendulum'

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
