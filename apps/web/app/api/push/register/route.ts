import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'

const ALLOWED_PLATFORMS = ['ios', 'android'] as const
type PlatformType = (typeof ALLOWED_PLATFORMS)[number]

export async function POST(req: NextRequest) {
  try {
    // 1. Bearer token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    // 2. Validate token
    const anonClient = createAnonServerClient()
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Role + status check
    const db = createUserClient(token)
    const { data: platformUser, error: puError } = await db
      .from('platform_users')
      .select('id, role_type, status')
      .eq('id', user.id)
      .single()

    if (puError || !platformUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (platformUser.role_type !== 'client' || platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Parse & validate body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'expo_push_token and platform are required' },
        { status: 400 }
      )
    }

    const rawToken = (body as Record<string, unknown>)?.expo_push_token
    const rawPlatform = (body as Record<string, unknown>)?.platform

    if (typeof rawToken !== 'string' || !rawToken.trim()) {
      return NextResponse.json(
        { error: 'expo_push_token is required' },
        { status: 400 }
      )
    }

    if (
      typeof rawPlatform !== 'string' ||
      !ALLOWED_PLATFORMS.includes(rawPlatform as PlatformType)
    ) {
      return NextResponse.json(
        { error: "platform must be either 'ios' or 'android'" },
        { status: 400 }
      )
    }

    // 5. Upsert push_token using user client (scoped by RLS)
    const { error: upsertError } = await db.from('push_tokens').upsert(
      {
        user_id: user.id,
        expo_push_token: rawToken.trim(),
        platform: rawPlatform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      console.error('PUSH TOKEN UPSERT FAILED:', upsertError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUSH TOKEN REGISTER EXCEPTION:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
