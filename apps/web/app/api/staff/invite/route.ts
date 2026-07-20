import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const anonClient = createAnonServerClient()
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token)
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
    if (platformUser.role_type !== 'coach' || platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const b = (body as Record<string, unknown>) ?? {}

    const rawEmail = b.email
    if (typeof rawEmail !== 'string') return NextResponse.json({ error: 'email is required' }, { status: 400 })
    const email = rawEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const rawFullName = b.full_name
    if (typeof rawFullName !== 'string' || rawFullName.trim().length < 2 || rawFullName.trim().length > 100) {
      return NextResponse.json({ error: 'full_name must be 2-100 characters' }, { status: 400 })
    }
    const full_name = rawFullName.trim()

    const rawRoleName = b.role_name
    if (typeof rawRoleName !== 'string' || !['assistant', 'senior_assistant', 'billing_operations'].includes(rawRoleName)) {
      return NextResponse.json({ error: 'role_name must be assistant, senior_assistant, or billing_operations' }, { status: 400 })
    }

    const assigned_timezones = Array.isArray(b.assigned_timezones) ? (b.assigned_timezones as string[]) : null
    const assigned_regions = Array.isArray(b.assigned_regions) ? (b.assigned_regions as string[]) : null

    const { data: role, error: roleError } = await db.from('roles').select('id').eq('name', rawRoleName).single()
    if (roleError || !role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 500 })
    }

    const serviceClient = createServiceRoleClient()

    const { data: authData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email)

    if (inviteError) {
      const msg = inviteError.message ?? ''
      if (msg.includes('already been registered') || msg.includes('already registered')) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to invite staff member' }, { status: 422 })
    }
    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to invite staff member' }, { status: 422 })
    }

    const userId = authData.user.id

    const { error: profileError } = await serviceClient
      .from('platform_users')
      .insert({ id: userId, email, full_name, role_type: 'assistant', status: 'active', email_verified: false })

    if (profileError) {
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
      if (deleteError) console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId)
      return NextResponse.json({ error: 'Failed to create staff profile' }, { status: 500 })
    }

    const { error: assignmentError } = await db.from('staff_assignments').insert({
      coach_id: user.id,
      user_id: userId,
      role_id: role.id,
      assigned_timezones,
      assigned_regions,
      status: 'active',
    })

    if (assignmentError) {
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
      if (deleteError) console.error('ORPHAN AUTH USER — manual cleanup required: ' + userId)
      return NextResponse.json({ error: 'Failed to create staff assignment' }, { status: 500 })
    }

    return NextResponse.json({ staff_id: userId, invited: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
