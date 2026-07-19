import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'

type AbsenceLevel = '24h' | '48h' | '72h'

function levelForDaysAbsent(daysAbsent: number): AbsenceLevel | null {
  if (daysAbsent >= 3) return '72h'
  if (daysAbsent === 2) return '48h'
  if (daysAbsent === 1) return '24h'
  return null
}

// Shared by GET (Vercel Cron invokes with GET + auto Bearer CRON_SECRET)
// and POST (manual recovery). Mirrors /api/flash-cards/compute's auth pattern.
async function handleDetectRequest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (
    !cronSecret ||
    !authHeader ||
    !authHeader.startsWith('Bearer ') ||
    authHeader.slice(7) !== cronSecret
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()
  const utcToday = new Date().toISOString().slice(0, 10)

  const { data: clientRows, error: clientsError } = await serviceClient
    .from('clients')
    .select('id, coach_id')
  if (clientsError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const allClientIds = (clientRows ?? []).map(c => c.id)
  if (allClientIds.length === 0) {
    return NextResponse.json({ scanned: 0, created: 0, errors: 0 })
  }

  // Only active clients — paused clients are excluded from absence detection (per spec).
  const { data: puRows, error: puError } = await serviceClient
    .from('platform_users')
    .select('id, status')
    .in('id', allClientIds)
    .eq('status', 'active')
  if (puError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const clientCoachMap = new Map((clientRows ?? []).map(c => [c.id, c.coach_id]))
  const activeClientIds = (puRows ?? []).map(pu => pu.id)

  let scanned = 0
  let created = 0
  let errors = 0

  for (const clientId of activeClientIds) {
    scanned++
    const coachId = clientCoachMap.get(clientId)
    if (!coachId) continue

    try {
      const { data: latestLog } = await serviceClient
        .from('daily_logs')
        .select('log_date')
        .eq('client_id', clientId)
        .order('log_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestLog) continue

      const daysAbsent = Math.floor(
        (new Date(utcToday).getTime() - new Date(latestLog.log_date).getTime()) / (1000 * 60 * 60 * 24)
      )

      const level = levelForDaysAbsent(daysAbsent)
      if (!level) continue

      const { error: upsertError, data: upserted } = await serviceClient
        .from('absence_events')
        .upsert(
          {
            client_id: clientId,
            coach_id: coachId,
            trigger_date: utcToday,
            level,
          },
          { onConflict: 'client_id,trigger_date,level', ignoreDuplicates: true }
        )
        .select()

      if (upsertError) {
        console.error('ABSENCE DETECT FAILED for client: ' + clientId, upsertError)
        errors++
      } else if (upserted && upserted.length > 0) {
        created++
      }
    } catch (err) {
      console.error('ABSENCE DETECT FAILED for client: ' + clientId, err)
      errors++
    }
  }

  return NextResponse.json({ scanned, created, errors })
}

export async function GET(req: NextRequest) {
  return handleDetectRequest(req)
}

export async function POST(req: NextRequest) {
  return handleDetectRequest(req)
}
