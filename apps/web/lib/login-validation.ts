export interface LoginBody {
  email: string
  password: string
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLoginBody(raw: unknown): ValidationResult<LoginBody> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid request body' }
  }
  const b = raw as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim() : ''
  const password = typeof b.password === 'string' ? b.password : ''

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Invalid email format' }
  }
  if (password.length === 0) {
    return { ok: false, error: 'Password is required' }
  }

  return { ok: true, data: { email, password } }
}

/** Maps a Supabase auth error's HTTP status onto the route's response shape. */
export function mapLoginAuthError(status: number | undefined): { status: number; error: string } {
  if (status !== undefined && status >= 400 && status < 500) {
    return { status: 401, error: 'Invalid credentials' }
  }
  return { status: 500, error: 'Login failed' }
}
