import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
const MAX_SIZE_BYTES = 10_485_760
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_REGEX = new RegExp(`^${UUID}$`, 'i')

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
  return cleaned.length > 0 ? cleaned : 'file'
}

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

    if (puError || !platformUser || platformUser.role_type !== 'coach' || platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'plan_id, filename, content_type, and size are required' }, { status: 400 })
    }
    const b = (body as Record<string, unknown>) ?? {}

    const planId = b.plan_id
    const filename = b.filename
    const contentType = b.content_type
    const size = b.size

    if (typeof planId !== 'string' || !UUID_REGEX.test(planId)) {
      return NextResponse.json({ error: 'plan_id must be a valid UUID' }, { status: 400 })
    }
    if (typeof filename !== 'string' || filename.trim().length === 0) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 })
    }
    if (typeof contentType !== 'string' || !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      return NextResponse.json({ error: 'content_type must be image/jpeg, image/png, or application/pdf' }, { status: 400 })
    }
    if (typeof size !== 'number' || size <= 0 || size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'size must not exceed 10MB' }, { status: 400 })
    }

    // Plan must exist and belong to this coach.
    const { data: plan, error: planError } = await db.from('plans').select('id, coach_id').eq('id', planId).eq('coach_id', user.id).single()
    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found in your workspace' }, { status: 404 })
    }

    const path = `${user.id}/plans/${planId}/${Date.now()}-${sanitizeFilename(filename)}`

    const serviceClient = createServiceRoleClient()
    const { data: urlData, error: urlError } = await serviceClient.storage.from('tenant-media').createSignedUploadUrl(path, { upsert: false })

    if (urlError || !urlData) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      signed_url: urlData.signedUrl,
      path: urlData.path,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
