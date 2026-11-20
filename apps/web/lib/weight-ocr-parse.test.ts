import { describe, expect, it } from 'vitest'
import { parseWeightKg, parseSteps } from './weight-ocr-parse'

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

describe('parseSteps', () => {
  it.each([
    ['8421', 8421],
    ['8,421', 8421],
    ['8.421', 8421],
    [' 12,345 ', 12345],
    ['100', 100],
  ])('accepts %j', (t, steps) => expect(parseSteps(t)).toBe(steps))

  it.each([
    'none',
    '',
    '99', // below MIN_STEPS
    '200001', // above MAX_STEPS
    '5.2', // a km distance, not steps
    '8,421 steps', // extra words
    '512 calories',
  ])('rejects %j', (t) => expect(parseSteps(t)).toBeNull())
})
