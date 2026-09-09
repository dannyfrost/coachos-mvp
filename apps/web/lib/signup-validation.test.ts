import { describe, it, expect } from 'vitest'
import { validateSignupBody, extractInviteCode, checkInviteCode } from './signup-validation'

const validBody = {
  email: 'a@b.com',
  password: 'password1',
  full_name: 'Jane Coach',
  workspace_name: "Jane's Gym",
}

describe('validateSignupBody', () => {
  it('accepts a valid body and trims all fields', () => {
    const result = validateSignupBody({
      email: '  a@b.com  ',
      password: '  password1  ',
      full_name: '  Jane Coach  ',
      workspace_name: "  Jane's Gym  ",
    })
    expect(result).toEqual({ ok: true, data: validBody })
  })

  it('rejects non-object bodies', () => {
    expect(validateSignupBody(null)).toEqual({ ok: false, error: 'Invalid request body' })
    expect(validateSignupBody('str')).toEqual({ ok: false, error: 'Invalid request body' })
  })

  it('treats an array body as an object, falling through to field validation', () => {
    // typeof [] === 'object' in JS — matches the original route's check exactly.
    expect(validateSignupBody([])).toEqual({ ok: false, error: 'Invalid email format' })
  })

  it('rejects malformed email', () => {
    const result = validateSignupBody({ ...validBody, email: 'nope' })
    expect(result).toEqual({ ok: false, error: 'Invalid email format' })
  })

  it('rejects password under 8 chars', () => {
    const result = validateSignupBody({ ...validBody, password: 'short1' })
    expect(result).toEqual({ ok: false, error: 'Password must be at least 8 characters' })
  })

  it('accepts password at exactly 8 chars', () => {
    const result = validateSignupBody({ ...validBody, password: '12345678' })
    expect(result.ok).toBe(true)
  })

  it('rejects full_name under 2 chars', () => {
    const result = validateSignupBody({ ...validBody, full_name: 'J' })
    expect(result).toEqual({ ok: false, error: 'full_name must be between 2 and 100 characters' })
  })

  it('rejects full_name over 100 chars', () => {
    const result = validateSignupBody({ ...validBody, full_name: 'a'.repeat(101) })
    expect(result).toEqual({ ok: false, error: 'full_name must be between 2 and 100 characters' })
  })

  it('rejects workspace_name under 2 chars', () => {
    const result = validateSignupBody({ ...validBody, workspace_name: 'A' })
    expect(result).toEqual({ ok: false, error: 'workspace_name must be between 2 and 50 characters' })
  })

  it('rejects workspace_name over 50 chars', () => {
    const result = validateSignupBody({ ...validBody, workspace_name: 'a'.repeat(51) })
    expect(result).toEqual({ ok: false, error: 'workspace_name must be between 2 and 50 characters' })
  })

  it('rejects workspace_name with disallowed characters', () => {
    const result = validateSignupBody({ ...validBody, workspace_name: 'Gym!' })
    expect(result).toEqual({
      ok: false,
      error: "workspace_name may only contain letters, numbers, spaces, hyphens, and apostrophes",
    })
  })

  it('accepts workspace_name with letters, numbers, spaces, hyphens, apostrophes', () => {
    const result = validateSignupBody({ ...validBody, workspace_name: "Gym-2 O'Clock" })
    expect(result.ok).toBe(true)
  })
})

describe('extractInviteCode', () => {
  it('extracts a string invite_code', () => {
    expect(extractInviteCode({ invite_code: 'ABC123' })).toBe('ABC123')
  })

  it('returns empty string when missing or wrong type', () => {
    expect(extractInviteCode({})).toBe('')
    expect(extractInviteCode({ invite_code: 42 })).toBe('')
    expect(extractInviteCode(null)).toBe('')
    expect(extractInviteCode('str')).toBe('')
  })
})

describe('checkInviteCode', () => {
  it('passes when supplied matches expected', () => {
    expect(checkInviteCode('ABC', 'ABC')).toBe(true)
  })

  it('fails on mismatch', () => {
    expect(checkInviteCode('ABC', 'XYZ')).toBe(false)
  })

  it('fails closed when no expected code is configured', () => {
    expect(checkInviteCode('ABC', undefined)).toBe(false)
    expect(checkInviteCode('', undefined)).toBe(false)
  })

  it('fails when expected code is configured but supplied is empty', () => {
    expect(checkInviteCode('', 'ABC')).toBe(false)
  })
})
