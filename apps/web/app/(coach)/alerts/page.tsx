import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import AlertsClient, { AlertRow } from './_components/AlertsClient'

export default async function AlertsPage() {
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll() {},
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawEvents, error } = await supabase
    .from('absence_events')
    .select(
      'id, client_id, trigger_date, level, action_taken, handled_by, created_at, resolved_at, clients!absence_events_client_coach_fkey(platform_users(full_name))'
    )
    .order('trigger_date', { ascending: false })

  if (error) {
    console.error('absence_events fetch error', error)
    return <p style={{ padding: 24, color: '#991b1b' }}>Failed to load alerts.</p>
  }

  const handlerIds = [...new Set((rawEvents ?? []).map(e => e.handled_by).filter((v): v is string => !!v))]
  const handlerMap = new Map<string, string>()
  if (handlerIds.length > 0) {
    const { data: handlers } = await supabase.from('platform_users').select('id, full_name').in('id', handlerIds)
    ;(handlers ?? []).forEach(h => handlerMap.set(h.id, h.full_name))
  }

  const events: AlertRow[] = (rawEvents ?? []).map(e => {
    const client = e.clients as { platform_users: { full_name: string } | null } | null
    return {
      id: e.id,
      client_id: e.client_id,
      client_name: client?.platform_users?.full_name ?? 'Unknown',
      trigger_date: e.trigger_date,
      level: e.level,
      action_taken: e.action_taken,
      handled_by_name: e.handled_by ? (handlerMap.get(e.handled_by) ?? null) : null,
      created_at: e.created_at,
      resolved_at: e.resolved_at,
    }
  })

  return <AlertsClient events={events} />
}
