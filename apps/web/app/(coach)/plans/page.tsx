import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import PlansClient, { PlanRow, ActiveClientOption } from './_components/PlansClient'

export default async function PlansPage() {
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

  const { data: platformUser } = await supabase.from('platform_users').select('role_type').eq('id', user.id).single()

  const [{ data: rawPlans, error: plansError }, { data: rawClients }, { data: activeAssignments }] = await Promise.all([
    supabase.from('plans').select('*').order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, platform_users(full_name, status)')
      .eq('coach_id', user.id),
    supabase.from('plan_assignments').select('plan_id').eq('status', 'active'),
  ])

  if (plansError) {
    console.error('plans fetch error', plansError)
    return <p style={{ padding: 24, color: '#991b1b' }}>Failed to load plans.</p>
  }

  const activePlanIds = new Set((activeAssignments ?? []).map(a => a.plan_id))

  const plans: PlanRow[] = (rawPlans ?? []).map(p => ({
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    is_template: p.is_template,
    created_at: p.created_at,
    updated_at: p.updated_at,
    content: p.content,
    hasActiveAssignments: activePlanIds.has(p.id),
  }))

  const activeClients: ActiveClientOption[] = (rawClients ?? [])
    .filter(c => (c.platform_users as { status: string } | null)?.status === 'active')
    .map(c => ({
      id: c.id,
      full_name: (c.platform_users as { full_name: string } | null)?.full_name ?? 'Unknown',
    }))

  return <PlansClient plans={plans} activeClients={activeClients} isCoach={platformUser?.role_type === 'coach'} />
}
