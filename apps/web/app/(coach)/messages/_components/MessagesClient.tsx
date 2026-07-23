'use client'

import { useState } from 'react'
import { T, font, Card, Avatar, initialsOf } from '../../../../lib/design-system'

export type ConversationRow = {
  participant_id: string
  participant_name: string
  participant_role: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function MessagesClient({ conversations }: { conversations: ConversationRow[] }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filtered = filter === 'unread' ? conversations.filter(c => c.unread_count > 0) : conversations

  return (
    <div className="page-pad">
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: font.body,
              fontWeight: 600,
              background: filter === f ? T.primary : T.surfaceHigh,
              color: filter === f ? '#fff' : T.onSurfaceVar,
            }}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '40px 24px' }}>No conversations yet.</Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((c, i) => (
            <a
              key={c.participant_id}
              href={`/messages/${c.participant_id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
                textDecoration: 'none',
                background: c.unread_count > 0 ? T.primaryLight : T.white,
              }}
            >
              <Avatar initials={initialsOf(c.participant_name)} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.onSurface }}>{c.participant_name}</span>
                  <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{fmtTime(c.last_message_at)}</span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: T.onSurfaceVar,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}
                >
                  {c.last_message ?? 'No messages yet'}
                </div>
              </div>
              {c.unread_count > 0 && (
                <span
                  style={{
                    background: T.redMid,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: '2px 8px',
                    flexShrink: 0,
                  }}
                >
                  {c.unread_count}
                </span>
              )}
            </a>
          ))}
        </Card>
      )}
    </div>
  )
}
