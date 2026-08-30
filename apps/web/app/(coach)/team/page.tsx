import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import TeamClient, { StaffRow, ActiveClientOption, RoleRow } from './_components/TeamClient'

export default async function TeamPage() {
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
  if (platformUser?.role_type !== 'coach') redirect('/dashboard')

  const [{ data: rawStaff, error: staffError }, { data: rawAssignments }, { data: rawClients }, { data: rawRoles }] = await Promise.all([
    supabase
      .from('staff_assignments')
      .select('id, user_id, status, assigned_timezones, assigned_regions, created_at, platform_users(full_name, email), roles(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('client_staff_assignments')
      .select('staff_id, client_id, clients!client_staff_assignments_client_coach_fkey(platform_users(full_name))'),
    supabase.from('clients').select('id, platform_users(full_name, status)'),
    supabase
      .from('roles')
      .select('id, name, description, locked, coach_id, role_permissions(permission, granted)')
      .order('locked', { ascending: false })
      .order('name'),
  ])

  if (staffError) {
    console.error('staff_assignments fetch error', staffError)
    return <p style={{ padding: 24, color: '#991b1b' }}>Failed to load team.</p>
  }

  const clientsByStaff = new Map<string, { id: string; name: string }[]>()
  ;(rawAssignments ?? []).forEach(a => {
    const clientRow = a.clients as { platform_users: { full_name: string } | null } | null
    const name = clientRow?.platform_users?.full_name ?? 'Unknown'
    const list = clientsByStaff.get(a.staff_id) ?? []
    list.push({ id: a.client_id, name })
    clientsByStaff.set(a.staff_id, list)
  })

  const staff: StaffRow[] = (rawStaff ?? []).map(s => {
    const pu = s.platform_users as { full_name: string; email: string } | null
    const role = s.roles as { name: string } | null
    return {
      id: s.id,
      userId: s.user_id,
      fullName: pu?.full_name ?? 'Unknown',
      email: pu?.email ?? '',
      roleName: role?.name ?? 'assistant',
      status: s.status,
      assignedTimezones: s.assigned_timezones,
      assignedRegions: s.assigned_regions,
      assignedClients: clientsByStaff.get(s.user_id) ?? [],
    }
  })

  const activeClients: ActiveClientOption[] = (rawClients ?? [])
    .filter(c => (c.platform_users as { status: string } | null)?.status === 'active')
    .map(c => ({ id: c.id, full_name: (c.platform_users as { full_name: string } | null)?.full_name ?? 'Unknown' }))

  // Only assistant-type roles are relevant here — coach/super_admin/client
  // exist in the same table but are never invitable as staff.
  const NON_STAFF_ROLE_NAMES = new Set(['coach', 'super_admin', 'client'])
  const roles: RoleRow[] = (rawRoles ?? [])
    .filter(r => !NON_STAFF_ROLE_NAMES.has(r.name))
    .map(r => {
      const perms = (r.role_permissions ?? []) as { permission: string; granted: boolean }[]
      const has = (p: string) => perms.some(x => x.permission === p && x.granted)
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        locked: r.locked,
        readTeamScope: has('clients:read_team_scope'),
        billingManage: has('billing:manage'),
        modifyPlans: has('modify_plans'),
        markPayment: has('mark_payment'),
      }
    })

  return <TeamClient staff={staff} activeClients={activeClients} roles={roles} />
}
