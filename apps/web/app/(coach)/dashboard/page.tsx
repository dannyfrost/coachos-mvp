import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import DashboardClient from './_components/DashboardClient'

type FlashCardData = {
  id: string
  client_id: string
  status: string
  reason: string | null
  food_summary: string | null
  interpretation: string | null
  notes: string | null
  last_log_at: string | null
  computed_at: string
}

type ClientData = {
  id: string
  status: string
  full_name: string | null
}

type WeekLogEntry = { log_date: string; weight: number | null; steps: number | null }

type PlanInfo = { title: string; type: string; assigned_at: string; week: number }

type AttentionItem = {
  id: string
  client_id: string
  trigger_date: string
  level: '24h' | '48h' | '72h'
  clientName: string
}

function weekNumberSince(assignedAt: string): number {
  const assigned = new Date(assignedAt)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(diffDays / 7) + 1)
}

export default async function DashboardPage() {
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

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('id, role_type, status')
    .eq('id', user.id)
    .single()

  if (
    !platformUser ||
    platformUser.status !== 'active' ||
    platformUser.role_type !== 'coach'
  ) {
    redirect('/login')
  }

  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    flashCardsRes,
    clientsRes,
    dailyLogsRes,
    subscriptionRes,
    weekLogsRes,
    planAssignmentsRes,
    unreadMessagesRes,
    attentionRes,
  ] = await Promise.all([
    supabase
      .from('flash_cards')
      .select(
        'id, client_id, status, reason, food_summary, interpretation, notes, last_log_at, computed_at'
      ),
    supabase
      .from('clients')
      .select('id, platform_users(full_name, status)')
      .eq('coach_id', user.id),
    supabase.from('daily_logs').select('client_id').eq('log_date', today),
    supabase
      .from('coach_subscriptions')
      .select('plan_name, current_period_end, status')
      .eq('coach_id', user.id)
      .maybeSingle(),
    supabase
      .from('daily_logs')
      .select('client_id, log_date, weight, steps')
      .gte('log_date', sevenDaysAgo)
      .lte('log_date', today),
    supabase
      .from('plan_assignments')
      .select('client_id, plan_id, assigned_at, plans!plan_assignments_plan_id_fkey(title, type)')
      .eq('status', 'active'),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null),
    supabase
      .from('absence_events')
      .select(
        'id, client_id, trigger_date, level, action_taken, clients!absence_events_client_coach_fkey(platform_users(full_name))'
      )
      .neq('action_taken', 'resolved')
      .order('level', { ascending: false }) // '72h' > '48h' > '24h' lexically descending — matches urgency (most urgent first)
      .limit(6),
  ])

  const flashCards: FlashCardData[] = (flashCardsRes.data ?? []).map(c => ({
    id: c.id,
    client_id: c.client_id,
    status: c.status as string,
    reason: c.reason ?? null,
    food_summary: c.food_summary ?? null,
    interpretation: c.interpretation ?? null,
    notes: c.notes ?? null,
    last_log_at: c.last_log_at ?? null,
    computed_at: c.computed_at,
  }))

  const clients: ClientData[] = (clientsRes.data ?? []).map(c => {
    const pu = c.platform_users as {
      full_name: string | null
      status: string | null
    } | null
    return {
      id: c.id,
      status: (pu?.status as string) ?? 'active',
      full_name: pu?.full_name ?? null,
    }
  })

  const todayLogClientIds = new Set((dailyLogsRes.data ?? []).map(l => l.client_id))
  const missingCheckIns = clients
    .filter(c => c.status === 'active')
    .filter(c => !todayLogClientIds.has(c.id)).length

  const activeClientCount = clients.filter(c => c.status === 'active').length
  const adherencePct = activeClientCount > 0
    ? Math.round(((activeClientCount - missingCheckIns) / activeClientCount) * 100)
    : 0

  const weekLogsByClient = new Map<string, WeekLogEntry[]>()
  for (const row of weekLogsRes.data ?? []) {
    const list = weekLogsByClient.get(row.client_id) ?? []
    list.push({ log_date: row.log_date, weight: row.weight, steps: row.steps })
    weekLogsByClient.set(row.client_id, list)
  }

  const planByClient = new Map<string, PlanInfo>()
  for (const row of planAssignmentsRes.data ?? []) {
    const plan = row.plans as { title: string; type: string } | null
    if (!plan) continue
    const existing = planByClient.get(row.client_id)
    if (!existing || row.assigned_at > existing.assigned_at) {
      planByClient.set(row.client_id, {
        title: plan.title,
        type: plan.type,
        assigned_at: row.assigned_at,
        week: weekNumberSince(row.assigned_at),
      })
    }
  }

  const unreadCount = unreadMessagesRes.count ?? 0

  const attentionItems: AttentionItem[] = (attentionRes.data ?? []).map(e => {
    const client = e.clients as { platform_users: { full_name: string } | null } | null
    return {
      id: e.id,
      client_id: e.client_id,
      trigger_date: e.trigger_date,
      level: e.level,
      clientName: client?.platform_users?.full_name ?? 'Unknown',
    }
  })

  return (
    <DashboardClient
      flashCards={flashCards}
      clients={clients}
      missingCheckIns={missingCheckIns}
      subscription={subscriptionRes.data ?? null}
      weekLogsByClientId={Object.fromEntries(weekLogsByClient)}
      planByClientId={Object.fromEntries(planByClient)}
      unreadCount={unreadCount}
      adherencePct={adherencePct}
      attentionItems={attentionItems}
    />
  )
}
