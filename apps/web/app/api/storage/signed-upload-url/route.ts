import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'

const UUID_SEG = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE_SEG = '[a-zA-Z0-9._-]{1,255}'
const PATH_REGEX = new RegExp(`^(${UUID_SEG})/(${UUID_SEG})/(${FILE_SEG})$`)

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const
const MAX_SIZE_BYTES = 5_242_880

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
    if (platformUser.role_type !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'path, content_type, and size are required' }, { status: 400 })
    }

    const rawPath = (body as Record<string, unknown>)?.path
    const rawContentType = (body as Record<string, unknown>)?.content_type
    const rawSize = (body as Record<string, unknown>)?.size

    if (typeof rawPath !== 'string' || typeof rawContentType !== 'string' || typeof rawSize !== 'number') {
      return NextResponse.json({ error: 'path, content_type, and size are required' }, { status: 400 })
    }

    // 5. Content type validation
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(rawContentType)) {
      return NextResponse.json({ error: 'content_type must be image/jpeg or image/png' }, { status: 400 })
    }

    // 6. Size validation
    if (rawSize <= 0 || rawSize > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'size must not exceed 5MB' }, { status: 400 })
    }

    // 7. Path format + ownership validation
    const match = PATH_REGEX.exec(rawPath)
    if (!match) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const [, pathCoachId, pathClientId] = match

    if (pathClientId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 8. Verify coach_id matches caller's actual coach
    const { data: clientRow, error: clientError } = await db
      .from('clients')
      .select('coach_id')
      .eq('id', user.id)
      .single()

    if (clientError || !clientRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (pathCoachId !== clientRow.coach_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 9. Generate signed upload URL (service role)
    // createSignedUploadUrl in storage-js 2.105.4 has no TTL option; expires_in not exposed by SDK
    const serviceClient = createServiceRoleClient()
    const { data: urlData, error: urlError } = await serviceClient.storage
      .from('tenant-media')
      .createSignedUploadUrl(rawPath, { upsert: false })

    if (urlError || !urlData) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      signed_url: urlData.signedUrl,
      path: urlData.path,
      expires_in: null,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
