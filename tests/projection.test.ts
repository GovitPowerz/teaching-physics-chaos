import { describe, expect, it } from 'vitest'
import { project, rotationMatrix, unprojectDelta, type View3 } from '../src/sim/projection'

const views: View3[] = [
  { yaw: 0, pitch: 0 },
  { yaw: 0.7, pitch: -0.3 },
  { yaw: Math.PI / 2, pitch: Math.PI / 4 },
  { yaw: -2.1, pitch: 1.4 },
]

describe('rotationMatrix', () => {
  it('is orthonormal: R * R^T = I', () => {
    for (const v of views) {
      const r = rotationMatrix(v)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const dot = r[i][0] * r[j][0] + r[i][1] * r[j][1] + r[i][2] * r[j][2]
          expect(dot).toBeCloseTo(i === j ? 1 : 0, 12)
        }
      }
    }
  })
  it('is the identity at yaw = 0, pitch = 0', () => {
    const r = rotationMatrix({ yaw: 0, pitch: 0 })
    const id = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) expect(r[i][j]).toBeCloseTo(id[i][j], 12)
    }
  })
})

describe('project', () => {
  it('gives the classic x-z butterfly view at zero angles', () => {
    expect(project({ yaw: 0, pitch: 0 }, [2, 5, -3])).toEqual([2, -3])
  })
  it('rotates known points to known screen positions', () => {
    // yaw pi/2 sends world x to world y, which is the depth axis: projects to origin
    const [sx1, sy1] = project({ yaw: Math.PI / 2, pitch: 0 }, [1, 0, 0])
    expect(sx1).toBeCloseTo(0, 12)
    expect(sy1).toBeCloseTo(0, 12)
    // pitch pi/2 sends world y to world z, the screen vertical
    const [sx2, sy2] = project({ yaw: 0, pitch: Math.PI / 2 }, [0, 1, 0])
    expect(sx2).toBeCloseTo(0, 12)
    expect(sy2).toBeCloseTo(1, 12)
  })
})

describe('unprojectDelta', () => {
  it('round-trips: project(unprojectDelta(dx, dy)) = [dx, dy]', () => {
    for (const v of views) {
      const [wx, wy, wz] = unprojectDelta(v, 3.2, -1.7)
      const [sx, sy] = project(v, [wx, wy, wz])
      expect(sx).toBeCloseTo(3.2, 12)
      expect(sy).toBeCloseTo(-1.7, 12)
    }
  })
  it('is the screen plane itself at zero angles', () => {
    expect(unprojectDelta({ yaw: 0, pitch: 0 }, 2, 3)).toEqual([2, 0, 3])
  })
})
