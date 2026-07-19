import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'

function getIntSetting(settings: unknown, key: string, fallback: number): number {
  if (settings !== null && typeof settings === 'object' && !Array.isArray(settings)) {
    const val = (settings as Record<string, unknown>)[key]
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) return Math.floor(val)
  }
  return fallback
}

// Shared by GET (Vercel Cron invokes with GET + auto Bearer CRON_SECRET)
// and POST (manual recovery). Single implementation — same auth, same logic.
async function handleComputeRequest(req: NextRequest) {
  // 1. Cron secret auth
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
  const utcToday = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC

  // 2. Fetch all client rows
  const { data: clientRows, error: clientsError } = await serviceClient
    .from('clients')
    .select('id, coach_id')
  if (clientsError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const allClientIds = (clientRows ?? []).map(c => c.id)
  if (allClientIds.length === 0) {
    return NextResponse.json({ processed: 0, errors: 0 })
  }

  // 3. Filter to active/paused only
  const { data: puRows, error: puError } = await serviceClient
    .from('platform_users')
    .select('id, status')
    .in('id', allClientIds)
    .in('status', ['active', 'paused'])
  if (puError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const clientCoachMap = new Map((clientRows ?? []).map(c => [c.id, c.coach_id]))
  const qualifyingClients = (puRows ?? [])
    .map(pu => ({
      id: pu.id,
      status: pu.status as string,
      coachId: clientCoachMap.get(pu.id) ?? '',
    }))
    .filter(c => c.coachId !== '')

  if (qualifyingClients.length === 0) {
    return NextResponse.json({ processed: 0, errors: 0 })
  }

  // 4. Fetch coach settings for all relevant coaches
  const coachIds = [...new Set(qualifyingClients.map(c => c.coachId))]
  const { data: coachRows, error: coachesError } = await serviceClient
    .from('coaches')
    .select('id, settings')
    .in('id', coachIds)
  if (coachesError) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const coachSettingsMap = new Map<string, unknown>(
    (coachRows ?? []).map(c => [c.id, c.settings])
  )

  let processed = 0
  let errors = 0

  for (const client of qualifyingClients) {
    const { id: clientId, status: clientStatus, coachId } = client

    try {
      const settings = coachSettingsMap.get(coachId) ?? {}
      const warningDays = getIntSetting(settings, 'absence_warning_days', 2)
      const criticalDays = getIntSetting(settings, 'absence_critical_days', 4)
      const stagnationDays = getIntSetting(settings, 'weight_stagnation_days', 7)

      let fcStatus: 'green' | 'yellow' | 'red'
      let fcReason: string
      let fcInterpretation: string | null
      let fcLastLogAt: string | null = null

      if (clientStatus === 'paused') {
        fcStatus = 'yellow'
        fcReason = 'client paused'
        fcInterpretation = null
      } else {
        // Latest daily log
        const { data: latestLog } = await serviceClient
          .from('daily_logs')
          .select('log_date, created_at')
          .eq('client_id', clientId)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!latestLog) {
          fcStatus = 'red'
          fcReason = 'no check-ins recorded'
          fcInterpretation = 'no data available'
        } else {
          fcLastLogAt = latestLog.created_at
          const daysAbsent = Math.floor(
            (new Date(utcToday).getTime() - new Date(latestLog.log_date).getTime()) /
            (1000 * 60 * 60 * 24)
          )

          if (daysAbsent > criticalDays) {
            fcStatus = 'red'
            fcReason = `no check-in for ${daysAbsent} days`
            fcInterpretation = 'extended absence detected'
          } else if (daysAbsent > warningDays) {
            fcStatus = 'yellow'
            fcReason = `missed check-in for ${daysAbsent} days`
            fcInterpretation = 'absence warning threshold reached'
          } else {
            // Weight stagnation check
            const windowStart = new Date(
              new Date(utcToday).getTime() - stagnationDays * 24 * 60 * 60 * 1000
            ).toISOString().slice(0, 10)

            const { data: weightLogs } = await serviceClient
              .from('daily_logs')
              .select('weight')
              .eq('client_id', clientId)
              .gte('log_date', windowStart)
              .not('weight', 'is', null)

            const weights = (weightLogs ?? [])
              .map(r => r.weight)
              .filter((w): w is number => typeof w === 'number')
            const uniqueWeights = new Set(weights)

            if (weights.length >= stagnationDays && uniqueWeights.size === 1) {
              fcStatus = 'yellow'
              fcReason = `weight unchanged for ${stagnationDays} days`
              fcInterpretation = 'stagnation despite compliance'
            } else {
              fcStatus = 'green'
              fcReason = 'on track'
              fcInterpretation = null
            }
          }
        }
      }

      // Food summary: last 3 non-null meal descriptions
      const { data: foodLogs } = await serviceClient
        .from('daily_logs')
        .select('meal_description')
        .eq('client_id', clientId)
        .not('meal_description', 'is', null)
        .order('log_date', { ascending: false })
        .limit(3)

      const descriptions = (foodLogs ?? [])
        .map(r => r.meal_description as string)
        .filter(Boolean)
      const fcFoodSummary = descriptions.length > 0 ? descriptions.join(' | ') : null

      // Upsert flash card — never touch notes
      const { error: upsertError } = await serviceClient
        .from('flash_cards')
        .upsert(
          {
            client_id: clientId,
            coach_id: coachId,
            status: fcStatus,
            reason: fcReason,
            food_summary: fcFoodSummary,
            interpretation: fcInterpretation,
            last_log_at: fcLastLogAt,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'client_id' }
        )

      if (upsertError) {
        console.error('FLASH CARD COMPUTE FAILED for client: ' + clientId, upsertError)
        errors++
      } else {
        processed++
      }
    } catch (err) {
      console.error('FLASH CARD COMPUTE FAILED for client: ' + clientId, err)
      errors++
    }
  }

  return NextResponse.json({ processed, errors })
}

export async function GET(req: NextRequest) {
  return handleComputeRequest(req)
}

export async function POST(req: NextRequest) {
  return handleComputeRequest(req)
}
