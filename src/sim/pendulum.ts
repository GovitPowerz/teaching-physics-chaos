import type { Deriv } from './ode'

// state y = [theta_0..theta_{n-1}, omega_0..omega_{n-1}]
// theta_i = absolute angle of link i from the downward vertical; m = l = g = 1

export const solveLinear = (A: number[][], b: number[]): number[] => {
  const n = b.length
  const M = A.map((row) => row.slice())
  const x = b.slice()
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row
    }
    if (pivot !== col) {
      const rowTmp = M[col]
      M[col] = M[pivot]
      M[pivot] = rowTmp
      const xTmp = x[col]
      x[col] = x[pivot]
      x[pivot] = xTmp
    }
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col]
      for (let k = col; k < n; k++) M[row][k] -= f * M[col][k]
      x[row] -= f * x[col]
    }
  }
  for (let row = n - 1; row >= 0; row--) {
    for (let k = row + 1; k < n; k++) x[row] -= M[row][k] * x[k]
    x[row] /= M[row][row]
  }
  return x
}

// A[i][j] = n - max(i, j): masses carried by both links i and j
export const pendulumDeriv = (n: number): Deriv => {
  const A: number[][] = []
  for (let i = 0; i < n; i++) {
    A.push([])
    for (let j = 0; j < n; j++) A[i].push(n - Math.max(i, j))
  }
  return (_t, y) => {
    const thetas = y.slice(0, n)
    const omegas = y.slice(n, 2 * n)
    const M: number[][] = []
    const b: number[] = []
    for (let i = 0; i < n; i++) {
      M.push([])
      let bi = -(n - i) * Math.sin(thetas[i])
      for (let j = 0; j < n; j++) {
        M[i].push(A[i][j] * Math.cos(thetas[i] - thetas[j]))
        bi -= A[i][j] * Math.sin(thetas[i] - thetas[j]) * omegas[j] * omegas[j]
      }
      b.push(bi)
    }
    return [...omegas, ...solveLinear(M, b)]
  }
}

// T + V; V is zero at the pivot
export const pendulumEnergy = (y: number[]): number => {
  const n = y.length / 2
  let T = 0
  let V = 0
  for (let i = 0; i < n; i++) {
    V -= (n - i) * Math.cos(y[i])
    for (let j = 0; j < n; j++) {
      T += 0.5 * (n - Math.max(i, j)) * Math.cos(y[i] - y[j]) * y[n + i] * y[n + j]
    }
  }
  return T + V
}

// pivot at origin, y up: joint k at (sum sin(theta_i), -sum cos(theta_i)) for i <= k
export const jointPositions = (thetas: number[]): Array<{ x: number; y: number }> => {
  const out: Array<{ x: number; y: number }> = []
  let x = 0
  let y = 0
  for (const t of thetas) {
    x += Math.sin(t)
    y -= Math.cos(t)
    out.push({ x, y })
  }
  return out
}
