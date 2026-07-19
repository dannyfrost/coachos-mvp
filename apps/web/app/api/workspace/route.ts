import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const anonClient = createAnonServerClient()
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const raw = (body as Record<string, unknown>)?.workspace_name
    if (raw === undefined || raw === null || typeof raw !== 'string') {
      return NextResponse.json({ error: 'workspace_name is required' }, { status: 400 })
    }
    const trimmedName = raw.trim()
    if (trimmedName.length < 2) {
      return NextResponse.json({ error: 'workspace_name must be at least 2 characters' }, { status: 400 })
    }
    if (trimmedName.length > 50) {
      return NextResponse.json({ error: 'workspace_name must be 50 characters or fewer' }, { status: 400 })
    }
    if (!/^[\p{L}\p{N} \-']{2,50}$/u.test(trimmedName)) {
      return NextResponse.json({ error: 'workspace_name contains invalid characters' }, { status: 400 })
    }

    const db = createUserClient(token)

    const { data: platformUser, error: puError } = await db
      .from('platform_users')
      .select('id, role_type, status')
      .eq('id', user.id)
      .single()

    if (puError || !platformUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (platformUser.role_type !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: coach, error: coachError } = await db
      .from('coaches')
      .select('trial_status, trial_started_at, trial_expires_at')
      .eq('id', user.id)
      .single()

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Coach profile missing' }, { status: 500 })
    }

    const now = new Date()
    const updateObj: {
      workspace_name: string
      trial_status?: 'trial_active'
      trial_started_at?: string
      trial_expires_at?: string
    } = { workspace_name: trimmedName }

    if (coach.trial_status === 'trial_not_started') {
      updateObj.trial_status = 'trial_active'
      updateObj.trial_started_at = now.toISOString()
      updateObj.trial_expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { error: updateError } = await db
      .from('coaches')
      .update(updateObj)
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      workspace_name: trimmedName,
      trial_status: updateObj.trial_status ?? coach.trial_status,
      trial_started_at: updateObj.trial_started_at ?? coach.trial_started_at,
      trial_expires_at: updateObj.trial_expires_at ?? coach.trial_expires_at,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
