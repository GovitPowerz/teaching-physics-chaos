export interface View3 { yaw: number; pitch: number }

// R = Rx(pitch) * Rz(yaw)
export const rotationMatrix = (v: View3): number[][] => {
  const cy = Math.cos(v.yaw)
  const sy = Math.sin(v.yaw)
  const cp = Math.cos(v.pitch)
  const sp = Math.sin(v.pitch)
  return [
    [cy, -sy, 0],
    [cp * sy, cp * cy, -sp],
    [sp * sy, sp * cy, cp],
  ]
}

// p' = R p; screen x = rotated x, screen y = rotated z
export const project = (v: View3, p: [number, number, number]): [number, number] => {
  const r = rotationMatrix(v)
  return [
    r[0][0] * p[0] + r[0][1] * p[1] + r[0][2] * p[2],
    r[2][0] * p[0] + r[2][1] * p[1] + r[2][2] * p[2],
  ]
}

// R^T * [dx, 0, dy]: screen-plane delta back to world delta
export const unprojectDelta = (v: View3, dx: number, dy: number): [number, number, number] => {
  const r = rotationMatrix(v)
  return [
    r[0][0] * dx + r[2][0] * dy,
    r[0][1] * dx + r[2][1] * dy,
    r[0][2] * dx + r[2][2] * dy,
  ]
}
