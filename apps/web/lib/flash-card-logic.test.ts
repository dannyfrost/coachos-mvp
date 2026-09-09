import { describe, it, expect } from 'vitest'
import { getIntSetting, daysBetween, computeFlashCard } from './flash-card-logic'

describe('getIntSetting', () => {
  it('returns the setting when it is a positive finite number', () => {
    expect(getIntSetting({ absence_warning_days: 3 }, 'absence_warning_days', 2)).toBe(3)
  })

  it('floors non-integer values', () => {
    expect(getIntSetting({ x: 3.9 }, 'x', 1)).toBe(3)
  })

  it('falls back on missing key', () => {
    expect(getIntSetting({}, 'x', 5)).toBe(5)
  })

  it('falls back on zero or negative', () => {
    expect(getIntSetting({ x: 0 }, 'x', 5)).toBe(5)
    expect(getIntSetting({ x: -1 }, 'x', 5)).toBe(5)
  })

  it('falls back on non-number, null settings, and arrays', () => {
    expect(getIntSetting({ x: '3' }, 'x', 5)).toBe(5)
    expect(getIntSetting(null, 'x', 5)).toBe(5)
    expect(getIntSetting([1, 2], 'x', 5)).toBe(5)
  })
})

describe('daysBetween', () => {
  it('computes whole-day difference in UTC', () => {
    expect(daysBetween('2026-09-10', '2026-09-05')).toBe(5)
  })

  it('is zero for the same date', () => {
    expect(daysBetween('2026-09-10', '2026-09-10')).toBe(0)
  })
})

describe('computeFlashCard', () => {
  const base = {
    clientStatus: 'active',
    hasLog: true,
    daysAbsent: 0,
    warningDays: 2,
    criticalDays: 4,
    stagnationDays: 7,
    recentWeights: [] as number[],
  }

  it('paused status overrides everything else', () => {
    const result = computeFlashCard({ ...base, clientStatus: 'paused', hasLog: false, daysAbsent: 99 })
    expect(result).toEqual({ status: 'yellow', reason: 'client paused', interpretation: null })
  })

  it('no logs at all is red', () => {
    const result = computeFlashCard({ ...base, hasLog: false })
    expect(result.status).toBe('red')
    expect(result.reason).toBe('no check-ins recorded')
  })

  it('daysAbsent over criticalDays is red', () => {
    const result = computeFlashCard({ ...base, daysAbsent: 5 })
    expect(result.status).toBe('red')
    expect(result.reason).toBe('no check-in for 5 days')
  })

  it('daysAbsent exactly at criticalDays is not yet red', () => {
    const result = computeFlashCard({ ...base, daysAbsent: 4 })
    expect(result.status).not.toBe('red')
  })

  it('daysAbsent over warningDays but within criticalDays is yellow', () => {
    const result = computeFlashCard({ ...base, daysAbsent: 3 })
    expect(result.status).toBe('yellow')
    expect(result.reason).toBe('missed check-in for 3 days')
  })

  it('daysAbsent exactly at warningDays is not yet yellow from absence', () => {
    const result = computeFlashCard({ ...base, daysAbsent: 2 })
    expect(result.status).toBe('green')
  })

  it('weight unchanged across the full stagnation window is yellow', () => {
    const result = computeFlashCard({ ...base, recentWeights: [80, 80, 80, 80, 80, 80, 80] })
    expect(result.status).toBe('yellow')
    expect(result.reason).toBe('weight unchanged for 7 days')
  })

  it('fewer weight entries than stagnationDays does not trigger stagnation', () => {
    const result = computeFlashCard({ ...base, recentWeights: [80, 80, 80] })
    expect(result.status).toBe('green')
  })

  it('varying weight across the window is green', () => {
    const result = computeFlashCard({ ...base, recentWeights: [80, 79, 80, 81, 80, 79, 80] })
    expect(result.status).toBe('green')
    expect(result.reason).toBe('on track')
  })
})
