import { describe, it, expect } from 'vitest'
import { validateLoginBody, mapLoginAuthError } from './login-validation'

describe('validateLoginBody', () => {
  it('accepts a valid body and trims email', () => {
    const result = validateLoginBody({ email: '  a@b.com  ', password: 'x' })
    expect(result).toEqual({ ok: true, data: { email: 'a@b.com', password: 'x' } })
  })

  it('does not trim password', () => {
    const result = validateLoginBody({ email: 'a@b.com', password: '  x  ' })
    expect(result.ok).toBe(true)
    expect(result.ok && result.data.password).toBe('  x  ')
  })

  it('rejects non-object bodies', () => {
    expect(validateLoginBody(null)).toEqual({ ok: false, error: 'Invalid request body' })
    expect(validateLoginBody('str')).toEqual({ ok: false, error: 'Invalid request body' })
    expect(validateLoginBody(42)).toEqual({ ok: false, error: 'Invalid request body' })
  })

  it('rejects malformed email', () => {
    const result = validateLoginBody({ email: 'not-an-email', password: 'x' })
    expect(result).toEqual({ ok: false, error: 'Invalid email format' })
  })

  it('rejects missing email', () => {
    const result = validateLoginBody({ password: 'x' })
    expect(result).toEqual({ ok: false, error: 'Invalid email format' })
  })

  it('rejects empty password', () => {
    const result = validateLoginBody({ email: 'a@b.com', password: '' })
    expect(result).toEqual({ ok: false, error: 'Password is required' })
  })

  it('rejects missing password', () => {
    const result = validateLoginBody({ email: 'a@b.com' })
    expect(result).toEqual({ ok: false, error: 'Password is required' })
  })
})

describe('mapLoginAuthError', () => {
  it('maps 4xx to 401 invalid credentials', () => {
    expect(mapLoginAuthError(400)).toEqual({ status: 401, error: 'Invalid credentials' })
    expect(mapLoginAuthError(499)).toEqual({ status: 401, error: 'Invalid credentials' })
  })

  it('maps 5xx and out-of-range status to 500 login failed', () => {
    expect(mapLoginAuthError(500)).toEqual({ status: 500, error: 'Login failed' })
    expect(mapLoginAuthError(399)).toEqual({ status: 500, error: 'Login failed' })
  })

  it('maps undefined status to 500 login failed', () => {
    expect(mapLoginAuthError(undefined)).toEqual({ status: 500, error: 'Login failed' })
  })
})
