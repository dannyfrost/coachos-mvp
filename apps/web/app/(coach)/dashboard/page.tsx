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

  const [flashCardsRes, clientsRes, dailyLogsRes, subscriptionRes] = await Promise.all([
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

  return (
    <DashboardClient
      flashCards={flashCards}
      clients={clients}
      missingCheckIns={missingCheckIns}
      subscription={subscriptionRes.data ?? null}
    />
  )
}
