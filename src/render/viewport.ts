export interface Viewport {
  world: { xMin: number; xMax: number; yMin: number; yMax: number }
  w: number
  h: number
}

export const pxPerUnit = (vp: Viewport): number =>
  Math.min(vp.w / (vp.world.xMax - vp.world.xMin), vp.h / (vp.world.yMax - vp.world.yMin))

export const toScreen = (
  vp: Viewport, p: { x: number; y: number },
): { x: number; y: number } => {
  const s = pxPerUnit(vp)
  const cx = (vp.world.xMin + vp.world.xMax) / 2
  const cy = (vp.world.yMin + vp.world.yMax) / 2
  return { x: vp.w / 2 + (p.x - cx) * s, y: vp.h / 2 - (p.y - cy) * s }
}

export const toWorld = (
  vp: Viewport, p: { x: number; y: number },
): { x: number; y: number } => {
  const s = pxPerUnit(vp)
  const cx = (vp.world.xMin + vp.world.xMax) / 2
  const cy = (vp.world.yMin + vp.world.yMax) / 2
  return { x: cx + (p.x - vp.w / 2) / s, y: cy - (p.y - vp.h / 2) / s }
}
