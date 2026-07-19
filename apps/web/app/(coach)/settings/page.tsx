import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import SettingsClient from './_components/SettingsClient'

export default async function SettingsPage() {
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

  const { data: coach, error } = await supabase.from('coaches').select('workspace_name, timezone, settings').eq('id', user.id).single()

  if (error || !coach) {
    console.error('coaches fetch error', error)
    return <p style={{ padding: 24, color: '#991b1b' }}>Failed to load settings.</p>
  }

  const settings = (coach.settings ?? {}) as Record<string, unknown>

  return (
    <SettingsClient
      workspaceName={coach.workspace_name}
      timezone={coach.timezone}
      absenceWarningDays={typeof settings.absence_warning_days === 'number' ? settings.absence_warning_days : 2}
      absenceCriticalDays={typeof settings.absence_critical_days === 'number' ? settings.absence_critical_days : 4}
      weightStagnationDays={typeof settings.weight_stagnation_days === 'number' ? settings.weight_stagnation_days : 7}
      escalation24h={settings.escalation_24h !== false}
      escalation48h={settings.escalation_48h !== false}
      escalation72h={settings.escalation_72h !== false}
    />
  )
}
