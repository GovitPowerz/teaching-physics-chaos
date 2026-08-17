import { describe, expect, it } from 'vitest'

describe('scaffold', () => {
  it('runs strict typescript under vitest', () => {
    const squares = [1, 2, 3].map((n) => n * n)
    expect(squares).toEqual([1, 4, 9])
  })
})
