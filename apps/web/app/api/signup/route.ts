import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'

interface SignupBody {
  email: string
  password: string
  full_name: string
  workspace_name: string
}

function validateBody(raw: unknown): { ok: true; data: SignupBody } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid request body' }
  }
  const b = raw as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim() : ''
  const password = typeof b.password === 'string' ? b.password.trim() : ''
  const full_name = typeof b.full_name === 'string' ? b.full_name.trim() : ''
  const workspace_name = typeof b.workspace_name === 'string' ? b.workspace_name.trim() : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
  if (!/^[a-zA-Z0-9 \-']+$/.test(workspace_name)) {
    return { ok: false, error: "workspace_name may only contain letters, numbers, spaces, hyphens, and apostrophes" }
  }

  return { ok: true, data: { email, password, full_name, workspace_name } }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // T1-21 invitation gate. Must run before any Supabase Auth or database
  // operation. Fails closed when SIGNUP_INVITE_CODE is not configured.
  // The code is server-only: never logged, never echoed in any response.
  const expectedCode = process.env.SIGNUP_INVITE_CODE
  const suppliedCode =
    typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).invite_code === 'string'
      ? ((body as Record<string, unknown>).invite_code as string)
      : ''
  if (!expectedCode || suppliedCode !== expectedCode) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const validation = validateBody(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { email, password, full_name, workspace_name } = validation.data
  const supabase = createServiceRoleClient()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    // Generic response only — auth error detail stays in server logs (T1-21).
    if (authError) {
      console.error('signup auth createUser failed: ' + authError.message)
    }
    return NextResponse.json({ error: 'Signup failed' }, { status: 422 })
  }

  const userId = authData.user.id

  const { error: profileError } = await supabase
    .from('platform_users')
    .insert({ id: userId, email, full_name, role_type: 'coach', status: 'active', email_verified: true })

  if (profileError) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      // Orphan UUID stays in server logs only — never in the response (T1-21).
      console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId)
    }
    return NextResponse.json({ error: 'Profile creation failed' }, { status: 500 })
  }

  // CASCADE CONFIRMED: deleteUser → platform_users cascade → coaches cascade
  const { error: coachError } = await supabase
    .from('coaches')
    .insert({ id: userId, workspace_name, timezone: 'UTC' })

  if (coachError) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      // Orphan UUID stays in server logs only — never in the response (T1-21).
      console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId)
    }
    return NextResponse.json({ error: 'Coach profile creation failed' }, { status: 500 })
  }

  return NextResponse.json({ id: userId, email }, { status: 201 })
}
