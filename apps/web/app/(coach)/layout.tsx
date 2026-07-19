import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import { Shell } from './_components/Shell'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
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

  const [{ data: platformUser }, { data: coach }, { data: clients }] = await Promise.all([
    supabase.from('platform_users').select('full_name').eq('id', user.id).single(),
    supabase.from('coaches').select('workspace_name').eq('id', user.id).single(),
    supabase.from('clients').select('id, platform_users(status)').eq('coach_id', user.id),
  ])

  const activeClientCount = (clients ?? []).filter(c => {
    const pu = c.platform_users as { status: string } | null
    return pu?.status === 'active'
  }).length

  return (
    <Shell
      coachName={platformUser?.full_name ?? 'Coach'}
      workspaceName={coach?.workspace_name ?? 'Workspace'}
      activeClientCount={activeClientCount}
    >
      {children}
    </Shell>
  )
}
