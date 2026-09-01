'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, font, Card, StatusWord, Btn } from '../../../../lib/design-system'

type Level = '24h' | '48h' | '72h'
type Action = 'pending' | 'message_sent' | 'escalated_to_coach' | 'resolved'

export type AlertRow = {
  id: string
  client_id: string
  client_name: string
  trigger_date: string
  level: Level
  action_taken: Action
  handled_by_name: string | null
  created_at: string
  resolved_at: string | null
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const LEVEL_FILTERS: (Level | 'all')[] = ['all', '24h', '48h', '72h']
const STATUS_FILTERS: (Action | 'all')[] = ['all', 'pending', 'message_sent', 'escalated_to_coach', 'resolved']

export default function AlertsClient({ events: initialEvents }: { events: AlertRow[] }) {
  const [events, setEvents] = useState(initialEvents)
  const [levelFilter, setLevelFilter] = useState<Level | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<Action | 'all'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})

  const filtered = events.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false
    if (statusFilter !== 'all' && e.action_taken !== statusFilter) return false
    return true
  })

  async function handleAction(event: AlertRow, action: Action) {
    setActionLoading(event.id)
    setRowError(prev => ({ ...prev, [event.id]: '' }))
    const supabase = createSupabaseBrowserClient()
    const { error } =
      action === 'resolved'
        ? await supabase.rpc('resolve_absence', { p_event_id: event.id })
        : await supabase.rpc('mark_absence_handled', { p_event_id: event.id, p_action: action })
    setActionLoading(null)
    if (error) {
      setRowError(prev => ({ ...prev, [event.id]: error.message }))
      return
    }
    setEvents(prev =>
      prev.map(e =>
        e.id === event.id
          ? { ...e, action_taken: action, resolved_at: action === 'resolved' ? new Date().toISOString() : e.resolved_at }
          : e
      )
    )
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 2,
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.body,
    fontSize: 12,
    fontWeight: 600,
    background: T.white,
    color: T.onSurfaceVar,
  }

  return (
    <div className="page-pad">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as Level | 'all')} style={selectStyle}>
          {LEVEL_FILTERS.map(l => (
            <option key={l} value={l}>
              {l === 'all' ? 'All levels' : l}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Action | 'all')} style={selectStyle}>
          {STATUS_FILTERS.map(s => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '40px 24px' }}>No absence events.</Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(e => {
            const urgent = e.level === '72h' && e.action_taken === 'pending'
            return (
              <Card
                key={e.id}
                style={{
                  padding: '14px 18px',
                  borderLeft: urgent ? `4px solid ${T.redMid}` : `4px solid transparent`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 15, color: T.onSurface }}>{e.client_name}</span>
                    <StatusWord status={e.level === '72h' ? 'red' : e.level === '48h' ? 'yellow' : 'pending'} labelOverride={e.level} />
                    <StatusWord status={e.action_taken} labelOverride={e.action_taken.replace('_', ' ')} />
                    {urgent && <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>URGENT</span>}
                  </div>
                  <span style={{ fontSize: 12, color: T.muted }}>Triggered {fmtDate(e.trigger_date)}</span>
                </div>

                <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
                  {e.handled_by_name ? `Handled by ${e.handled_by_name}` : 'Not yet handled'}
                  {e.resolved_at && ` · Resolved ${fmtDate(e.resolved_at)}`}
                </div>

                {rowError[e.id] && <p style={{ color: T.red, fontSize: 12, marginTop: 6 }}>{rowError[e.id]}</p>}

                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {e.action_taken !== 'resolved' && (
                    <>
                      <Btn small variant="secondary" onClick={() => handleAction(e, 'message_sent')} disabled={actionLoading === e.id}>
                        Mark Message Sent
                      </Btn>
                      <Btn small variant="secondary" onClick={() => handleAction(e, 'escalated_to_coach')} disabled={actionLoading === e.id}>
                        Escalate to Coach
                      </Btn>
                      <Btn small variant="success" onClick={() => handleAction(e, 'resolved')} disabled={actionLoading === e.id}>
                        Mark Resolved
                      </Btn>
                    </>
                  )}
                  <a href={`/clients/${e.client_id}`} style={{ textDecoration: 'none' }}>
                    <Btn small variant="ghost">Open Profile</Btn>
                  </a>
                  <a href={`/messages/${e.client_id}`} style={{ textDecoration: 'none' }}>
                    <Btn small variant="ghost">Message Client</Btn>
                  </a>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
