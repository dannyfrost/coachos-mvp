import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient } from '@coaching/supabase/auth-server'

interface LoginBody {
  email: string
  password: string
}

function validateBody(raw: unknown): { ok: true; data: LoginBody } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid request body' }
  }
  const b = raw as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim() : ''
  const password = typeof b.password === 'string' ? b.password : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Invalid email format' }
  }
  if (password.length === 0) {
    return { ok: false, error: 'Password is required' }
  }

  return { ok: true, data: { email, password } }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateBody(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { email, password } = validation.data
  const supabase = createAnonServerClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.status !== undefined && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
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
