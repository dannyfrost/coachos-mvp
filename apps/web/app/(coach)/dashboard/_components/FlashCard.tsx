'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, StatusWord, Btn, Avatar, initialsOf } from '../../../../lib/design-system'

type FlashCardData = {
  id: string
  client_id: string
  status: string
  reason: string | null
  food_summary: string | null
  interpretation: string | null
  notes: string | null
  last_log_at: string | null
  computed_at: string
}

type WeekLogEntry = { log_date: string; weight: number | null; steps: number | null }

type PlanInfo = { title: string; type: string; week: number }

const BORDER_COLOR: Record<string, string> = {
  green: T.successMid,
  yellow: T.amberMid,
  red: T.redMid,
  paused: '#d1d5db',
}

function SevenDayStrip({ weekLogs }: { weekLogs: WeekLogEntry[] }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  const byDate = new Map(weekLogs.map(l => [l.log_date, l]))
  const maxSteps = Math.max(1, ...weekLogs.map(l => l.steps ?? 0))

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
      {days.map(date => {
        const log = byDate.get(date)
        const hasLog = !!log
        const stepsHeight = log?.steps ? Math.max(4, Math.round((log.steps / maxSteps) * 24)) : 4
        return (
          <div
            key={date}
            style={{
              width: 10,
              height: stepsHeight,
              borderRadius: 1,
              background: hasLog ? T.primary : T.surfaceHigh,
            }}
          />
        )
      })}
    </div>
  )
}

export default function FlashCard({
  card: initialCard,
  clientName,
  weekLogs,
  plan,
  onRefresh,
}: {
  card: FlashCardData
  clientName: string
  weekLogs: WeekLogEntry[]
  plan: PlanInfo | undefined
  onRefresh: (card: FlashCardData) => void
}) {
  const [card, setCard] = useState(initialCard)
  const [loading, setLoading] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const [notesValue, setNotesValue] = useState(card.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  async function handleRefresh() {
    setLoading(true)
    setRefreshError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error: rpcError } = await supabase.rpc('refresh_flash_card', {
        p_client_id: card.client_id,
      })
      if (rpcError || !data || (data as FlashCardData[]).length === 0) {
        setRefreshError('Refresh failed.')
      } else {
        const updated = (data as FlashCardData[])[0]
        setCard(updated)
        setNotesValue(updated.notes ?? '')
        onRefresh(updated)
      }
    } catch {
      setRefreshError('Refresh failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveNotes() {
    setNotesSaving(true)
    setNotesSaved(false)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.rpc('update_flash_card_notes', {
        p_card_id: card.id,
        p_notes: notesValue,
      })
      if (!error) {
        setCard(prev => ({ ...prev, notes: notesValue }))
        setNotesSaved(true)
        setTimeout(() => setNotesSaved(false), 1500)
      }
    } finally {
      setNotesSaving(false)
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const latestLog =
    weekLogs.find(l => l.log_date === todayStr) ??
    [...weekLogs].sort((a, b) => (a.log_date < b.log_date ? 1 : -1))[0]

  return (
    <div
      style={{
        background: T.white,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: shadow.card,
        borderLeft: `4px solid ${BORDER_COLOR[card.status] ?? '#d1d5db'}`,
        opacity: card.status === 'paused' ? 0.75 : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials={initialsOf(clientName)} />
            <div>
              <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: T.onSurface }}>
                {clientName}
              </div>
              {plan && (
                <div style={{ fontFamily: font.body, fontSize: 11, color: T.muted }}>
                  {plan.title} — week {plan.week}
                </div>
              )}
            </div>
          </div>
          <StatusWord status={card.status} />
        </div>
      </div>

      <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 2 }}>
                Weight
              </div>
              <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 18, color: T.onSurface }}>
                {latestLog?.weight != null ? `${latestLog.weight} kg` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 2 }}>
                Steps
              </div>
              <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 18, color: T.onSurface }}>
                {latestLog?.steps != null ? latestLog.steps.toLocaleString() : '—'}
              </div>
            </div>
          </div>
          <SevenDayStrip weekLogs={weekLogs} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
            Coach notes
          </div>
          <textarea
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            placeholder="Add a note..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: T.surfaceLow,
              borderBottom: `2px solid ${T.primary}`,
              fontFamily: font.body,
              fontSize: 12,
              color: T.onSurface,
              outline: 'none',
              resize: 'none',
              minHeight: 52,
              boxSizing: 'border-box',
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Btn small variant="secondary" onClick={handleSaveNotes} disabled={notesSaving || notesValue === (card.notes ?? '')}>
              {notesSaving ? 'Saving...' : 'Save note'}
            </Btn>
            {notesSaved && <span style={{ fontSize: 11, color: T.success, fontWeight: 600 }}>Saved</span>}
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
          <a href={`/clients/${card.client_id}`} style={{ flex: 1, textDecoration: 'none' }}>
            <Btn small variant="primary" full>
              Open file
            </Btn>
          </a>
          <Btn small variant="secondary" onClick={handleRefresh} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Btn>
        </div>
        {refreshError && <p style={{ color: T.red, fontSize: 11, margin: '6px 0 0' }}>{refreshError}</p>}
      </div>
    </div>
  )
}
