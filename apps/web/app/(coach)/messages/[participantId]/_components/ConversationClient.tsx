'use client'

import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, font, Btn } from '../../../../../lib/design-system'

export type MessageRow = {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  read_at: string | null
  created_at: string
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function ConversationClient({
  participantId,
  participantName,
  currentUserId,
  initialMessages,
}: {
  participantId: string
  participantName: string
  currentUserId: string
  initialMessages: MessageRow[]
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50)
  const bottomRef = useRef<HTMLDivElement>(null)
  const markedRef = useRef(new Set<string>())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [])

  useEffect(() => {
    const unread = messages.filter(m => m.recipient_id === currentUserId && !m.read_at && !markedRef.current.has(m.id))
    if (unread.length === 0) return
    const supabase = createSupabaseBrowserClient()
    unread.forEach(m => {
      markedRef.current.add(m.id)
      supabase.rpc('mark_message_read', { p_message_id: m.id })
    })
  }, [messages, currentUserId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setSending(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data, error: sendError } = await supabase.rpc('send_message', {
      p_recipient_id: participantId,
      p_content: draft,
    })
    setSending(false)
    if (sendError || !data || data.length === 0) {
      setError('Could not send message. Try again.')
      return
    }
    setMessages(prev => [...prev, data[0] as MessageRow])
    setDraft('')
    setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 50)
  }

  async function handleLoadOlder() {
    if (messages.length === 0) return
    setLoadingOlder(true)
    const supabase = createSupabaseBrowserClient()
    const cursor = messages[0].created_at
    const { data, error: loadError } = await supabase.rpc('get_conversation', {
      p_participant_id: participantId,
      p_cursor: cursor,
    })
    setLoadingOlder(false)
    if (loadError) return
    const older = (data ?? []) as MessageRow[]
    setHasMore(older.length >= 50)
    setMessages(prev => [...[...older].reverse(), ...prev])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 28px', borderBottom: `1px solid ${T.border}`, background: T.white }}>
        <a href="/messages" style={{ fontSize: 12, color: T.primary, textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Messages
        </a>
        <div style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: T.onSurface, marginTop: 4 }}>{participantName}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hasMore && (
          <button
            onClick={handleLoadOlder}
            disabled={loadingOlder}
            style={{
              alignSelf: 'center',
              background: 'none',
              border: 'none',
              color: T.primary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            {loadingOlder ? 'Loading…' : 'Load older messages'}
          </button>
        )}

        {messages.map(m => {
          const isMine = m.sender_id === currentUserId
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '60%',
                  background: isMine ? T.primary : T.surfaceLow,
                  color: isMine ? '#fff' : T.onSurface,
                  borderRadius: 2,
                  padding: '9px 14px',
                }}
              >
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3, textAlign: 'right' }}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '16px 28px', borderTop: `1px solid ${T.border}`, background: T.white, display: 'flex', gap: 10 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 2,
            border: 'none',
            background: T.surfaceLow,
            outline: 'none',
            fontSize: 13,
            fontFamily: font.body,
            color: T.onSurface,
          }}
        />
        <Btn type="submit" disabled={sending || !draft.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </Btn>
      </form>
      {error && <p style={{ color: T.red, fontSize: 12, padding: '0 28px 10px' }}>{error}</p>}
    </div>
  )
}
