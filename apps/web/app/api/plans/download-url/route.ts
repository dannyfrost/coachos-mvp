import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_REGEX = new RegExp(`^${UUID}$`, 'i')

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
    const { data: platformUser, error: puError } = await db.from('platform_users').select('status').eq('id', user.id).single()
    if (puError || !platformUser || platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 })
    }
    const planId = (body as Record<string, unknown>)?.plan_id
    if (typeof planId !== 'string' || !UUID_REGEX.test(planId)) {
      return NextResponse.json({ error: 'plan_id must be a valid UUID' }, { status: 400 })
    }

    // RLS on `plans` already scopes visibility to: coach (own tenant),
    // assistant (assigned clients), senior_assistant (team), client (own assignment).
    // A successful select here IS the authorization check.
    const { data: plan, error: planError } = await db.from('plans').select('content').eq('id', planId).single()
    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const content = plan.content as { file?: { path?: string } } | null
    const path = content?.file?.path
    if (typeof path !== 'string' || path.length === 0) {
      return NextResponse.json({ error: 'No file attached to this plan' }, { status: 404 })
    }

    const serviceClient = createServiceRoleClient()
    const { data: urlData, error: urlError } = await serviceClient.storage.from('tenant-media').createSignedUrl(path, 300)
    if (urlError || !urlData) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ signed_url: urlData.signedUrl, expires_in: 300 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
