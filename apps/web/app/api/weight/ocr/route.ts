import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'
import { createServiceRoleClient } from '@coaching/supabase/server'
import { parseWeightKg, parseSteps } from '../../../../lib/weight-ocr-parse'

// Node runtime: base64 image handling needs Node, not edge.
export const runtime = 'nodejs'
// A download + one vision call. Gemini 2.5 flash runs adaptive thinking on
// hard/rotated photos, which can take time, so give real headroom — a 30s cap
// 504s those reads and the app shows nothing. 60 is the Vercel Hobby maximum.
export const maxDuration = 60

// Same path contract as the signed-upload-url route: {coach}/{client}/{file}.
const UUID_SEG = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE_SEG = '[a-zA-Z0-9._-]{1,255}'
const PATH_REGEX = new RegExp(`^(${UUID_SEG})/(${UUID_SEG})/(${FILE_SEG})$`)

// ML Kit (on-device) genuinely can't read seven-segment scale LCD/LED digits
// (it drops the sparse "7" glyph), so the number is read server-side by a
// vision model. Reads via Google AI Studio (Gemini), switched from Anthropic
// Sonnet per request. NOTE: the original 32-photo benchmark that chose Sonnet
// (100% upright, 53% rotated) was Anthropic-only — Gemini is NOT yet
// benchmarked on these real scale photos, so re-run docs/WEIGHT_OCR_E2E_TEST.md
// on a real phone before trusting rotated-photo accuracy.
// gemini-3.8-flash (newest) is sustained-503 overloaded and gemini-2.5-* 404 for
// this key, so default to gemini-3.5-flash, which has capacity. GEMINI_MODEL
// overrides; bump to gemini-pro-latest if flash misreads rotated displays on the
// phone pass. Check live availability with ListModels before changing the id.
const OCR_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'

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
    // Same route reads weight scales and step-count screens; the client picks
    // via mode. Default stays 'weight' so existing callers are unchanged.
    const mode = (body as Record<string, unknown>)?.mode === 'steps' ? 'steps' : 'weight'

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

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[weight-ocr] GEMINI_API_KEY is not set')
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

    const prompt =
      mode === 'steps'
        ? 'This is a photo or screenshot of a fitness tracker or phone screen showing a daily step count. ' +
          'Read ONLY the number of steps (the value labelled "steps", a whole number such as 8,421). ' +
          'Ignore calories, distance (km/mi), heart rate (bpm), floors, and active minutes. ' +
          'Reply with ONLY the step count as digits (e.g. "8421" or "8,421"). ' +
          'If no step count is clearly visible, reply with exactly "none". ' +
          'Never output units, labels, or any other text.'
        : 'This is a photo of a body-weight scale display (often a seven-segment LCD/LED). ' +
          'The photo may be rotated sideways or upside-down — mentally rotate it so the ' +
          'digits are upright before reading. ' +
          'Read the full weight shown, in kilograms, including every decimal digit on the display. ' +
          'Reply with ONLY the number (e.g. "72.5" or "81.70"). ' +
          'If no scale reading is clearly visible, reply with exactly "none". ' +
          'Never output a rotation angle, degrees, units, words, or any other text.'

    // Gemini (Google AI Studio) generateContent REST call — raw fetch so no SDK
    // dependency. maxOutputTokens must leave room beyond the tiny numeric answer:
    // flash runs adaptive thinking and its thinking tokens draw on the same
    // budget, so a tight cap can starve the text answer and return nothing.
    const reqBody = JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 4096 },
    })

    // gemini-3.8-flash hits SUSTAINED 503 "high demand" under load — retrying the
    // same model doesn't clear a sustained overload, so fall through a short model
    // ladder: 2 quick attempts each (0.6s backoff on 429/5xx), first 200 wins. A
    // 404/400 means that id is unavailable to this key, so skip to the next model.
    // Fixes every read (weight AND steps share this route). Bounded: 3 models x 2
    // = 6 calls, inside maxDuration=60. Override via GEMINI_MODEL (primary) and
    // GEMINI_FALLBACK_MODELS (comma-separated).
    const RETRYABLE = new Set([429, 500, 502, 503, 504])
    const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-lite-latest,gemini-3.5-flash-lite')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
    const models = [...new Set([OCR_MODEL, ...fallbacks])]
    let resp: Response | null = null
    let usedModel = OCR_MODEL
    outer: for (const model of models) {
      usedModel = model
      for (let attempt = 0; attempt < 2; attempt++) {
        resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
            body: reqBody,
          }
        )
        if (resp.ok) break outer
        const errBody = await resp.text()
        console.error(`[weight-ocr] ${model} HTTP ${resp.status}: ${errBody.slice(0, 200)}`)
        if (!RETRYABLE.has(resp.status)) break // id unavailable/bad → next model
        if (attempt === 0) await new Promise((r) => setTimeout(r, 600))
      }
    }

    // All models failed (bad key, quota, sustained outage): return 502, not the
    // generic 500 the app shows as "couldn't read the scale".
    if (!resp || !resp.ok) {
      return NextResponse.json({ error: 'OCR upstream error' }, { status: 502 })
    }

    const data = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
      usageMetadata?: { candidatesTokenCount?: number }
    }
    const candidate = data.candidates?.[0]
    const text = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join(' ')
      .trim()
    const finishReason = candidate?.finishReason ?? 'none'

    // Strict: the whole reply must be the number (range-checked for the mode).
    const parsed = mode === 'steps' ? parseSteps(text) : parseWeightKg(text)
    const inRange = parsed !== null
    // Diagnostic: raw model text + decision, visible in Vercel logs. No PII —
    // only internal storage path (coach/client UUIDs) and the number read.
    console.log(
      `[weight-ocr] mode=${mode} model=${usedModel} path=${rawPath} raw="${text}" parsed=${parsed ?? 'null'} ` +
        `inRange=${inRange} stop=${finishReason} out=${data.usageMetadata?.candidatesTokenCount ?? '?'}`
    )
    if (mode === 'steps') {
      return NextResponse.json({ steps: inRange ? parsed : null })
    }
    return NextResponse.json({ weightKg: inRange ? parsed : null })
  } catch (err) {
    console.error(
      '[weight-ocr] unhandled error:',
      err instanceof Error ? err.stack || err.message : err
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
