import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import { T, font, Card, Badge, SectionLabel } from '../../../lib/design-system'

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.onSurfaceVar, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>
          {value} ({pct}%)
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 2, background: T.surfaceLow, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 26, color: color ?? T.onSurface, lineHeight: 1 }}>{value}</div>
    </Card>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function ReportsPage() {
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

  const today = new Date()
  const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)
  const expiryThreshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: clients },
    { data: flashCards },
    { data: recentLogs },
    { data: subscriptions },
    { data: staff },
    { data: clientStaffAssignments },
    { data: absenceEvents },
  ] = await Promise.all([
    supabase.from('clients').select('id, platform_users(full_name, status)').eq('coach_id', user.id),
    supabase.from('flash_cards').select('status').eq('coach_id', user.id),
    supabase.from('daily_logs').select('client_id, log_date').eq('coach_id', user.id).gte('log_date', sevenDaysAgo),
    supabase.from('client_subscriptions').select('status, end_date').eq('coach_id', user.id),
    supabase.from('staff_assignments').select('id, user_id, status, platform_users(full_name)').eq('coach_id', user.id),
    supabase.from('client_staff_assignments').select('staff_id'),
    supabase.from('absence_events').select('level, action_taken, created_at, resolved_at').eq('coach_id', user.id),
  ])

  const activeClients = (clients ?? []).filter(c => (c.platform_users as { status: string } | null)?.status === 'active')
  const activeClientCount = activeClients.length
  const totalClientCount = (clients ?? []).length

  const flashCounts = { green: 0, yellow: 0, red: 0 }
  ;(flashCards ?? []).forEach(fc => {
    if (fc.status in flashCounts) flashCounts[fc.status as keyof typeof flashCounts]++
  })
  const flashTotal = flashCounts.green + flashCounts.yellow + flashCounts.red

  const todayLogClientIds = new Set((recentLogs ?? []).filter(l => l.log_date === todayStr).map(l => l.client_id))
  const checkedInToday = activeClients.filter(c => todayLogClientIds.has(c.id)).length

  const weekLogsByDate = new Map<string, Set<string>>()
  ;(recentLogs ?? []).forEach(l => {
    const set = weekLogsByDate.get(l.log_date) ?? new Set<string>()
    set.add(l.client_id)
    weekLogsByDate.set(l.log_date, set)
  })
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { date: d, count: weekLogsByDate.get(d)?.size ?? 0 }
  })

  const subCounts = { active: 0, expired: 0, overdue: 0 }
  const expiringSoon: string[] = []
  ;(subscriptions ?? []).forEach(s => {
    if (s.status in subCounts) subCounts[s.status as keyof typeof subCounts]++
    if (s.status === 'active' && s.end_date && s.end_date <= expiryThreshold) expiringSoon.push(s.end_date)
  })
  const subTotal = subCounts.active + subCounts.expired + subCounts.overdue

  const clientsPerStaff = new Map<string, number>()
  ;(clientStaffAssignments ?? []).forEach(a => {
    clientsPerStaff.set(a.staff_id, (clientsPerStaff.get(a.staff_id) ?? 0) + 1)
  })
  const activeStaff = (staff ?? []).filter(s => s.status === 'active')

  const absenceByLevel = { '24h': 0, '48h': 0, '72h': 0 }
  const absenceByAction = { pending: 0, message_sent: 0, escalated_to_coach: 0, resolved: 0 }
  const resolutionDurationsMs: number[] = []
  ;(absenceEvents ?? []).forEach(e => {
    if (e.level in absenceByLevel) absenceByLevel[e.level as keyof typeof absenceByLevel]++
    if (e.action_taken in absenceByAction) absenceByAction[e.action_taken as keyof typeof absenceByAction]++
    if (e.resolved_at) resolutionDurationsMs.push(new Date(e.resolved_at).getTime() - new Date(e.created_at).getTime())
  })
  const avgResolutionHours =
    resolutionDurationsMs.length > 0
      ? Math.round(resolutionDurationsMs.reduce((a, b) => a + b, 0) / resolutionDurationsMs.length / (1000 * 60 * 60))
      : null
  const absenceTotal = absenceEvents?.length ?? 0

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Client Health */}
      <div>
        <SectionLabel>Client Health</SectionLabel>
        <div className="grid-stats" style={{ marginBottom: 14 }}>
          <StatTile label="Active Clients" value={activeClientCount} color={T.primary} />
          <StatTile label="Checked In Today" value={`${checkedInToday}/${activeClientCount}`} color={T.successMid} />
          <StatTile label="Total Clients" value={totalClientCount} />
        </div>
        <Card>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: T.onSurface }}>Flash Card Distribution</h3>
          {flashTotal === 0 ? (
            <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No flash cards computed yet.</p>
          ) : (
            <>
              <Bar label="Green — On Track" value={flashCounts.green} total={flashTotal} color={T.successMid} />
              <Bar label="Yellow — Needs Attention" value={flashCounts.yellow} total={flashTotal} color={T.amberMid} />
              <Bar label="Red — At Risk" value={flashCounts.red} total={flashTotal} color={T.redMid} />
            </>
          )}
        </Card>
        <Card style={{ marginTop: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: T.onSurface }}>7-Day Check-in Activity</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {weekDays.map(d => {
              const pct = activeClientCount > 0 ? (d.count / activeClientCount) * 100 : 0
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                    <div style={{ width: '100%', height: `${Math.max(pct, 2)}%`, background: T.primary, borderRadius: '2px 2px 0 0' }} />
                  </div>
                  <span style={{ fontSize: 10, color: T.muted }}>{d.date.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Subscriptions */}
      <div>
        <SectionLabel>Subscriptions</SectionLabel>
        <div className="grid-stats" style={{ marginBottom: 14 }}>
          <StatTile label="Active" value={subCounts.active} color={T.successMid} />
          <StatTile label="Expired" value={subCounts.expired} color={T.redMid} />
          <StatTile label="Overdue" value={subCounts.overdue} color={T.amberMid} />
          <StatTile label="Expiring ≤7 Days" value={expiringSoon.length} color={T.amberMid} />
        </div>
        {subTotal === 0 ? (
          <Card style={{ color: T.muted, fontSize: 13 }}>No subscriptions recorded yet.</Card>
        ) : (
          <Card>
            <Bar label="Active" value={subCounts.active} total={subTotal} color={T.successMid} />
            <Bar label="Expired" value={subCounts.expired} total={subTotal} color={T.redMid} />
            <Bar label="Overdue" value={subCounts.overdue} total={subTotal} color={T.amberMid} />
          </Card>
        )}
        <p style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
          Revenue/MRR is not shown — client_subscriptions has no stored price, so no dollar figure can be computed honestly.
        </p>
      </div>

      {/* Team / Ops */}
      <div>
        <SectionLabel>Team &amp; Ops</SectionLabel>
        <div className="grid-stats" style={{ marginBottom: 14 }}>
          <StatTile label="Active Staff" value={activeStaff.length} />
          <StatTile label="Absence Events" value={absenceTotal} />
          <StatTile label="Avg Resolution Time" value={avgResolutionHours !== null ? `${avgResolutionHours}h` : '—'} />
        </div>

        <Card style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: T.onSurface }}>Clients per Staff Member</h3>
          {activeStaff.length === 0 ? (
            <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No active staff.</p>
          ) : (
            activeStaff.map(s => {
              const pu = s.platform_users as { full_name: string } | null
              const count = clientsPerStaff.get(s.user_id) ?? 0
              return <Bar key={s.id} label={pu?.full_name ?? 'Unknown'} value={count} total={Math.max(activeClientCount, 1)} color={T.primary} />
            })
          )}
        </Card>

        <Card>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: T.onSurface }}>Absence Events</h3>
          {absenceTotal === 0 ? (
            <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No absence events recorded.</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <Badge status="red" small labelOverride={`72h: ${absenceByLevel['72h']}`} />
                <Badge status="yellow" small labelOverride={`48h: ${absenceByLevel['48h']}`} />
                <Badge status="pending" small labelOverride={`24h: ${absenceByLevel['24h']}`} />
              </div>
              <Bar label="Pending" value={absenceByAction.pending} total={absenceTotal} color={T.redMid} />
              <Bar label="Message Sent" value={absenceByAction.message_sent} total={absenceTotal} color={T.amberMid} />
              <Bar label="Escalated" value={absenceByAction.escalated_to_coach} total={absenceTotal} color={T.red} />
              <Bar label="Resolved" value={absenceByAction.resolved} total={absenceTotal} color={T.successMid} />
            </>
          )}
        </Card>
      </div>

      {expiringSoon.length > 0 && (
        <p style={{ fontSize: 11, color: T.muted }}>
          Nearest subscription expiry: {fmtDate(expiringSoon.sort()[0])}
        </p>
      )}
    </div>
  )
}
