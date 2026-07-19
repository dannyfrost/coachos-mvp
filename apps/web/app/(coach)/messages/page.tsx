import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import MessagesClient, { ConversationRow } from './_components/MessagesClient'

export default async function MessagesPage() {
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

  const { data, error } = await supabase.rpc('list_conversations')

  if (error) {
    console.error('list_conversations error', error)
    return <p style={{ padding: 24, color: '#991b1b' }}>Failed to load conversations.</p>
  }

  const conversations: ConversationRow[] = (data ?? []).map(c => ({
    participant_id: c.participant_id,
    participant_name: c.participant_name,
    participant_role: c.participant_role,
    last_message: c.last_message,
    last_message_at: c.last_message_at,
    unread_count: Number(c.unread_count),
  }))

  return <MessagesClient conversations={conversations} />
}
