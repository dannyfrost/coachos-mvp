import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient } from '@coaching/supabase/auth-server'
import { validateLoginBody, mapLoginAuthError } from '../../../lib/login-validation'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateLoginBody(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { email, password } = validation.data
  const supabase = createAnonServerClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const mapped = mapLoginAuthError(error.status)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }

  if (!data.user || !data.session) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }

  return NextResponse.json(
    {
      id: data.user.id,
      email: data.user.email,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    { status: 200 },
  )
}
