import { describe, expect, it } from 'vitest'
import { hitTest, numCommit, type Handle } from '../src/ui/controls'

describe('hitTest', () => {
  const handles: Handle[] = [
    { id: 'a', pos: { x: 0, y: 0 }, radius: 10 },
    { id: 'b', pos: { x: 6, y: 0 }, radius: 10 },
  ]
  it('returns a handle whose radius contains the point', () => {
    expect(hitTest(handles, { x: 1, y: 0 })).toBe('a')
    expect(hitTest(handles, { x: 5, y: 0 })).toBe('b')
  })
  it('overlapping handles: nearest center wins', () => {
    // d(a) = 3.5, d(b) = 2.5 - both contain the point
    expect(hitTest(handles, { x: 3.5, y: 0 })).toBe('b')
  })
  it('misses and empty lists return null', () => {
    expect(hitTest(handles, { x: 30, y: 0 })).toBe(null)
    expect(hitTest([], { x: 0, y: 0 })).toBe(null)
  })
  it('a point exactly on the radius still hits', () => {
    expect(hitTest([{ id: 'edge', pos: { x: 0, y: 0 }, radius: 5 }], { x: 5, y: 0 })).toBe('edge')
  })
})

describe('numCommit', () => {
  it('parses and clamps to [min, max]', () => {
    expect(numCommit('3.5', 0, 10)).toBe(3.5)
    expect(numCommit('-7', 0, 10)).toBe(0)
    expect(numCommit('99', 0, 10)).toBe(10)
    expect(numCommit(' 2.5 ', -1, 1)).toBe(1)
  })
  it('rejects invalid and empty input with null', () => {
    expect(numCommit('abc', 0, 10)).toBe(null)
    expect(numCommit('', 0, 10)).toBe(null)
    expect(numCommit('  ', 0, 10)).toBe(null) // Number('  ') is 0 - must not commit
    expect(numCommit('Infinity', 0, 10)).toBe(null)
  })
})
