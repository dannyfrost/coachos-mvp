import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'

export async function GET(req: NextRequest) {
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

    const dbClient = createUserClient(token)

    const { data: platformUser, error: puError } = await dbClient
      .from('platform_users')
      .select('id, email, full_name, role_type, status, email_verified')
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

    const { data: coach, error: coachError } = await dbClient
      .from('coaches')
      .select('workspace_name, trial_status, trial_started_at, trial_expires_at')
      .eq('id', user.id)
      .single()

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    let next_action: string
    if (!coach.workspace_name || coach.workspace_name === '') {
      next_action = 'workspace_setup'
    } else if (coach.trial_status === 'trial_expired') {
      next_action = 'billing'
    } else {
      next_action = 'dashboard'
    }

    return NextResponse.json(
      {
        user: {
          id: platformUser.id,
          email: platformUser.email,
          full_name: platformUser.full_name,
          role_type: platformUser.role_type,
          status: platformUser.status,
          email_verified: platformUser.email_verified,
        },
        coach: {
          workspace_name: coach.workspace_name,
          trial_status: coach.trial_status,
          trial_started_at: coach.trial_started_at,
          trial_expires_at: coach.trial_expires_at,
        },
        next_action,
      },
      { status: 200 },
    )
  } catch (_e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
