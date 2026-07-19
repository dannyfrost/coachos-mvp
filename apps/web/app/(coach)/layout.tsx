import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'

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

  return <>{children}</>
}
