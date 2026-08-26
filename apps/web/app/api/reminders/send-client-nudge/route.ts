import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@coaching/supabase/server'

// Shared by GET (Vercel Cron invokes with GET + auto Bearer CRON_SECRET)
// and POST (manual trigger).
async function handleReminderRequest(req: NextRequest) {
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

  // 1. Get all client IDs
  const { data: clientRows, error: clientsError } = await serviceClient
    .from('clients')
    .select('id')

  if (clientsError) {
    console.error('CLIENTS LOOKUP FAILED in reminder cron', clientsError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const allClientIds = (clientRows ?? []).map((c) => c.id)
  if (allClientIds.length === 0) {
    return NextResponse.json({ scanned: 0, tokensFound: 0, sent: 0, errors: 0 })
  }

  // 2. Filter for active clients
  const { data: puRows, error: puError } = await serviceClient
    .from('platform_users')
    .select('id')
    .in('id', allClientIds)
    .eq('status', 'active')

  if (puError) {
    console.error('PLATFORM USERS LOOKUP FAILED in reminder cron', puError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const activeClientIds = (puRows ?? []).map((pu) => pu.id)
  if (activeClientIds.length === 0) {
    return NextResponse.json({ scanned: 0, tokensFound: 0, sent: 0, errors: 0 })
  }

  // 3. Query daily_logs for today's logs among active clients
  const { data: todayLogs, error: logsError } = await serviceClient
    .from('daily_logs')
    .select('client_id')
    .eq('log_date', utcToday)
    .in('client_id', activeClientIds)

  if (logsError) {
    console.error('DAILY LOGS LOOKUP FAILED in reminder cron', logsError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const loggedTodaySet = new Set((todayLogs ?? []).map((l) => l.client_id))

  // 4. Remaining clients who have not checked in today
  const remaining = activeClientIds.filter((id) => !loggedTodaySet.has(id))
  if (remaining.length === 0) {
    return NextResponse.json({ scanned: 0, tokensFound: 0, sent: 0, errors: 0 })
  }

  // 5. Query push tokens for remaining clients
  const { data: tokenRows, error: tokenError } = await serviceClient
    .from('push_tokens')
    .select('user_id, expo_push_token')
    .in('user_id', remaining)

  if (tokenError) {
    console.error('PUSH TOKENS LOOKUP FAILED in reminder cron', tokenError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const tokens = (tokenRows ?? [])
    .map((t) => t.expo_push_token)
    .filter(
      (token): token is string => typeof token === 'string' && token.trim().length > 0
    )

  const tokensFound = tokens.length
  let sent = 0
  let errors = 0

  // 6. Send Expo push notifications in batches of 100
  const CHUNK_SIZE = 100
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE)
    const messages = chunk.map((token) => ({
      to: token,
      title: "Don't forget today's log",
      body: 'Log your steps and weight before the day ends.',
    }))

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      })

      if (!res.ok) {
        console.error('EXPO PUSH SEND FAILED (HTTP status)', res.status)
        errors += chunk.length
      } else {
        const json = await res.json()
        const tickets = json?.data as Array<{ status: string }> | undefined
        if (Array.isArray(tickets)) {
          for (const ticket of tickets) {
            if (ticket.status === 'ok') {
              sent++
            } else {
              errors++
            }
          }
        } else {
          sent += chunk.length
        }
      }
    } catch (err) {
      console.error('EXPO PUSH SEND CHUNK EXCEPTION', err)
      errors += chunk.length
    }
  }

  return NextResponse.json({
    scanned: remaining.length,
    tokensFound,
    sent,
    errors,
  })
}

export async function GET(req: NextRequest) {
  return handleReminderRequest(req)
}

export async function POST(req: NextRequest) {
  return handleReminderRequest(req)
}
