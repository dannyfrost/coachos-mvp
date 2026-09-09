export interface SignupBody {
  email: string
  password: string
  full_name: string
  workspace_name: string
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WORKSPACE_NAME_RE = /^[a-zA-Z0-9 \-']+$/

export function validateSignupBody(raw: unknown): ValidationResult<SignupBody> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid request body' }
  }
  const b = raw as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim() : ''
  const password = typeof b.password === 'string' ? b.password.trim() : ''
  const full_name = typeof b.full_name === 'string' ? b.full_name.trim() : ''
  const workspace_name = typeof b.workspace_name === 'string' ? b.workspace_name.trim() : ''

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Invalid email format' }
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' }
  }
  if (full_name.length < 2 || full_name.length > 100) {
    return { ok: false, error: 'full_name must be between 2 and 100 characters' }
  }
  if (workspace_name.length < 2 || workspace_name.length > 50) {
    return { ok: false, error: 'workspace_name must be between 2 and 50 characters' }
  }
  if (!WORKSPACE_NAME_RE.test(workspace_name)) {
    return { ok: false, error: "workspace_name may only contain letters, numbers, spaces, hyphens, and apostrophes" }
  }

  return { ok: true, data: { email, password, full_name, workspace_name } }
}

/** Extracts invite_code from an unvalidated request body without throwing. */
export function extractInviteCode(raw: unknown): string {
  return typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).invite_code === 'string'
    ? ((raw as Record<string, unknown>).invite_code as string)
    : ''
}

/** T1-21 invitation gate: fails closed when no code is configured server-side. */
export function checkInviteCode(suppliedCode: string, expectedCode: string | undefined): boolean {
  return !!expectedCode && suppliedCode === expectedCode
}
