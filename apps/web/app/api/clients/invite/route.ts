import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { sendInviteEmail } from '../../../../lib/email/send-invite-email'

export async function POST(req: NextRequest) {
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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const rawEmail = (body as Record<string, unknown>)?.email
    if (rawEmail === undefined || rawEmail === null || typeof rawEmail !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    const email = rawEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const rawFullName = (body as Record<string, unknown>)?.full_name
    if (rawFullName === undefined || rawFullName === null || typeof rawFullName !== 'string') {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }
    const full_name = rawFullName.trim()
    if (full_name.length < 2) {
      return NextResponse.json({ error: 'full_name must be at least 2 characters' }, { status: 400 })
    }
    if (full_name.length > 100) {
      return NextResponse.json({ error: 'full_name must be 100 characters or fewer' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    const { data: authData, error: authCreateError } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (authCreateError) {
      const msg = authCreateError.message ?? ''
      if (msg.includes('already been registered') || msg.includes('already registered')) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create client account' }, { status: 422 })
    }
    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create client account' }, { status: 422 })
    }

    const userId = authData.user.id

    const { data: activationToken, error: rpcError } = await db.rpc('create_client_invite', {
      p_user_id: userId,
      p_email: email,
      p_full_name: full_name,
    })

    if (rpcError) {
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
      if (deleteError) {
        console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId)
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const emailResult = await sendInviteEmail({
      to: email,
      fullName: full_name,
      activationToken,
    })

    return NextResponse.json(
      {
        client_id: userId,
        invited: true,
        email_sent: emailResult.sent,
        ...(emailResult.sent ? {} : { warning: emailResult.reason }),
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
