import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'

// Shared by GET (Vercel Cron invokes with GET + auto Bearer CRON_SECRET)
// and POST (manual trigger). Mirrors /api/meals/purge-photos's pattern.
async function handlePurgeRequest(req: NextRequest) {
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

  // Compute cutoff date: today (UTC) minus 14 days
  const now = new Date()
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14))
  const cutoffISO = cutoff.toISOString().slice(0, 10)

  // Fetch only rows older than cutoff with a non-null weight_photo_key (safety limit 500)
  const { data: rows, error: queryError } = await serviceClient
    .from('daily_logs')
    .select('id, weight_photo_key')
    .lt('log_date', cutoffISO)
    .not('weight_photo_key', 'is', null)
    .limit(500)

  if (queryError) {
    console.error('WEIGHT PHOTO PURGE QUERY FAILED', queryError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const scanned = (rows ?? []).length
  let purged = 0
  let errors = 0

  for (const row of rows ?? []) {
    if (!row.weight_photo_key) continue

    try {
      // 1. Remove only the exact photo_key stored in this row
      const { error: removeError } = await serviceClient
        .storage
        .from('tenant-media')
        .remove([row.weight_photo_key])

      if (removeError) {
        console.error(`WEIGHT PHOTO PURGE FAILED (storage remove) for row ${row.id}:`, removeError)
        errors++
        continue
      }

      // 2. Set weight_photo_key to null on the daily_logs row
      const { error: updateError } = await serviceClient
        .from('daily_logs')
        .update({ weight_photo_key: null })
        .eq('id', row.id)

      if (updateError) {
        console.error(`WEIGHT PHOTO PURGE FAILED (db update) for row ${row.id}:`, updateError)
        errors++
      } else {
        purged++
      }
    } catch (err) {
      console.error(`WEIGHT PHOTO PURGE EXCEPTION for row ${row.id}:`, err)
      errors++
    }
  }

  return NextResponse.json({ scanned, purged, errors })
}

export async function GET(req: NextRequest) {
  return handlePurgeRequest(req)
}

export async function POST(req: NextRequest) {
  return handlePurgeRequest(req)
}
