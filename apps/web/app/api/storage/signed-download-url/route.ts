import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'

const UUID_SEG = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE_SEG = '[a-zA-Z0-9._-]{1,255}'
const PATH_REGEX = new RegExp(`^(${UUID_SEG})/(${UUID_SEG})/(${FILE_SEG})$`)

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
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Read caller identity
    const db = createUserClient(token)
    const { data: platformUser, error: puError } = await db
      .from('platform_users')
      .select('id, role_type, status')
      .eq('id', user.id)
      .single()

    if (puError || !platformUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (
      platformUser.role_type !== 'coach' &&
      platformUser.role_type !== 'client' &&
      platformUser.role_type !== 'assistant'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }
    const rawPath = (body as Record<string, unknown>)?.path
    if (typeof rawPath !== 'string') {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    // 5. Path format validation
    const match = PATH_REGEX.exec(rawPath)
    if (!match) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const [, pathCoachId, pathClientId] = match

    // 6. Role-based authorization
    if (platformUser.role_type === 'coach') {
      if (pathCoachId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (platformUser.role_type === 'client') {
      if (pathClientId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data: clientRow, error: clientError } = await db
        .from('clients')
        .select('coach_id')
        .eq('id', user.id)
        .single()
      if (clientError || !clientRow || pathCoachId !== clientRow.coach_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // assistant
      // staff_assignments uses user_id (not staff_id) per 002_create_tables.sql
      const { data: staffAssignment, error: saError } = await db
        .from('staff_assignments')
        .select('coach_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (saError || !staffAssignment || pathCoachId !== staffAssignment.coach_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // client_staff_assignments uses staff_id per 002_create_tables.sql
      const { data: csaRow, error: csaError } = await db
        .from('client_staff_assignments')
        .select('client_id')
        .eq('staff_id', user.id)
        .eq('client_id', pathClientId)
        .maybeSingle()
      if (csaError || !csaRow) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // 7. Generate signed download URL (service role, TTL 300s)
    const serviceClient = createServiceRoleClient()
    const { data: urlData, error: urlError } = await serviceClient.storage
      .from('tenant-media')
      .createSignedUrl(rawPath, 300)
    if (urlError || !urlData) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      signed_url: urlData.signedUrl,
      path: rawPath,
      expires_in: 300,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
