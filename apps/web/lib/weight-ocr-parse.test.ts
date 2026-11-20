import { describe, expect, it } from 'vitest'
import { parseWeightKg } from './weight-ocr-parse'

describe('parseWeightKg', () => {
  it.each([
    ['72.5', 72.5],
    ['81.70', 81.7],
    [' 81,7 ', 81.7],
    ['81.7 kg', 81.7],
    ['100', 100],
  ])('accepts %j', (t, kg) => expect(parseWeightKg(t)).toBe(kg))

  it.each([
    'none',
    '',
    'rotated 90 degrees: 81.70',
    '90 degrees',
    '8.1',
    '301',
    '29.9',
    '1234',
    '72.5 or 75.2',
  ])('rejects %j', (t) => expect(parseWeightKg(t)).toBeNull())
})
