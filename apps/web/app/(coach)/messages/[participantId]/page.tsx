import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import ConversationClient, { MessageRow } from './_components/ConversationClient'

export default async function ConversationPage({ params }: { params: { participantId: string } }) {
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

  const [{ data: participant }, { data: rawMessages, error: msgError }] = await Promise.all([
    supabase.from('platform_users').select('full_name').eq('id', params.participantId).single(),
    supabase.rpc('get_conversation', { p_participant_id: params.participantId }),
  ])

  if (msgError) {
    console.error('get_conversation error', msgError)
    return <p style={{ padding: 24, color: '#991b1b' }}>Failed to load conversation.</p>
  }

  const messages: MessageRow[] = (rawMessages ?? [])
    .map(m => ({
      id: m.id,
      sender_id: m.sender_id,
      recipient_id: m.recipient_id,
      content: m.content,
      read_at: m.read_at,
      created_at: m.created_at,
    }))
    .reverse()

  return (
    <ConversationClient
      participantId={params.participantId}
      participantName={participant?.full_name ?? 'Unknown'}
      currentUserId={user.id}
      initialMessages={messages}
    />
  )
}
