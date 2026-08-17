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
