import { describe, it, expect } from 'vitest'
import { levelForDaysAbsent } from './absence-detection'

describe('levelForDaysAbsent', () => {
  it('returns null for 0 days absent', () => {
    expect(levelForDaysAbsent(0)).toBeNull()
  })

  it('returns 24h for exactly 1 day absent', () => {
    expect(levelForDaysAbsent(1)).toBe('24h')
  })

  it('returns 48h for exactly 2 days absent', () => {
    expect(levelForDaysAbsent(2)).toBe('48h')
  })

  it('returns 72h for exactly 3 days absent', () => {
    expect(levelForDaysAbsent(3)).toBe('72h')
  })

  it('returns 72h for anything beyond 3 days', () => {
    expect(levelForDaysAbsent(4)).toBe('72h')
    expect(levelForDaysAbsent(30)).toBe('72h')
  })

  it('returns null for negative days (future log date, clock skew)', () => {
    expect(levelForDaysAbsent(-1)).toBeNull()
  })
})
