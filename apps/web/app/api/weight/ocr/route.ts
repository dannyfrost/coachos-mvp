import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'

// Node runtime: the Anthropic SDK and base64 image handling need Node, not edge.
export const runtime = 'nodejs'
// A download + one vision call; keep headroom over the default.
export const maxDuration = 30

// Same path contract as the signed-upload-url route: {coach}/{client}/{file}.
const UUID_SEG = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE_SEG = '[a-zA-Z0-9._-]{1,255}'
const PATH_REGEX = new RegExp(`^(${UUID_SEG})/(${UUID_SEG})/(${FILE_SEG})$`)

const MIN_WEIGHT_KG = 30
const MAX_WEIGHT_KG = 300

// ML Kit (on-device) genuinely can't read seven-segment scale LCD/LED digits
// (it drops the sparse "7" glyph), so the number is read server-side by a
// vision model that handles those displays. Benchmarked on 32 real client
// photos (docs/WEIGHT_OCR_DEVICE_TEST.md context): Sonnet WITH thinking on is
// the clear winner — 100% on upright photos, 53% on rotated/upside-down ones
// (reasoning lets it mentally rotate), vs ~56% total for Haiku/thinking-off.
// ~1¢/photo, which is nothing at this volume. ponytail: drop to haiku +
// thinking disabled if per-read cost ever actually matters.
const OCR_MODEL = 'claude-sonnet-5-5'

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
    if (platformUser.role_type !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

    // Path format + ownership: a client may only OCR a photo in its own
    // {coach}/{client}/ folder — never read an arbitrary stored object.
    const match = PATH_REGEX.exec(rawPath)
    if (!match) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const [, pathCoachId, pathClientId] = match
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

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OCR not configured' }, { status: 500 })
    }

    // Download the uploaded photo via service role (bypasses RLS on storage).
    const serviceClient = createServiceRoleClient()
    const { data: blob, error: dlError } = await serviceClient.storage
      .from('tenant-media')
      .download(rawPath)
    if (dlError || !blob) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    const mediaType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: OCR_MODEL,
      // Thinking is ON (sonnet-5-5 runs adaptive thinking by default): clients
      // photograph the scale sideways or upside-down, and reasoning is what lets
      // the model mentally rotate and read them (benchmark: rotated accuracy
      // 11% -> 53% with thinking). CRITICAL: on sonnet-5-5 max_tokens caps
      // thinking + answer COMBINED, and thinking tokens are billed/counted as
      // output. At 1024 the adaptive thinking consumed the whole budget and the
      // response came back with no text block at all, so every read returned
      // null. Give thinking real room; the numeric answer itself is tiny.
      // ponytail: if per-read cost matters, cap thinking with
      // thinking: { type: 'between_tools' } + output_config: { effort: 'low' }.
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text:
                'This is a photo of a body-weight scale display (often a seven-segment LCD/LED). ' +
                'The photo may be rotated sideways or upside-down — mentally rotate it so the ' +
                'digits are upright before reading. ' +
                'Read the full weight shown, in kilograms, including every decimal digit on the display. ' +
                'Reply with ONLY the number (e.g. "72.5" or "81.70"). ' +
                'If no scale reading is clearly visible, reply with exactly "none". ' +
                'Never output a rotation angle, degrees, units, words, or any other text.',
            },
          ],
        },
      ],
    })

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim()

    // Model replies with just the number, or "none". Pull the first numeric
    // token and range-check it the same way the mobile client did.
    const numMatch = text.replace(',', '.').match(/\d{1,3}(\.\d{1,2})?/)
    const weightKg = numMatch ? parseFloat(numMatch[0]) : null
    if (weightKg === null || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
      return NextResponse.json({ weightKg: null })
    }
    return NextResponse.json({ weightKg })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
