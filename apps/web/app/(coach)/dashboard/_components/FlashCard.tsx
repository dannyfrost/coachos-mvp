'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, Badge, Btn, Avatar, initialsOf } from '../../../../lib/design-system'

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

const BORDER_COLOR: Record<string, string> = {
  green: T.successMid,
  yellow: T.amberMid,
  red: T.redMid,
  paused: '#d1d5db',
}

export default function FlashCard({
  card: initialCard,
  clientName,
  onRefresh,
}: {
  card: FlashCardData
  clientName: string
  onRefresh: (card: FlashCardData) => void
}) {
  const [card, setCard] = useState(initialCard)
  const [loading, setLoading] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const [notesValue, setNotesValue] = useState(card.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  const isStale = new Date(card.computed_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)

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

  return (
    <div
      style={{
        background: T.white,
        borderRadius: 14,
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
              <div style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 15, color: T.onSurface }}>{clientName}</div>
              <div style={{ fontSize: 11, color: T.muted }}>
                {card.last_log_at ? `Last log ${new Date(card.last_log_at).toLocaleDateString()}` : 'No logs yet'}
              </div>
            </div>
          </div>
          <Badge status={card.status} small />
        </div>
      </div>

      <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {isStale && (
          <div
            style={{
              fontSize: 11,
              color: T.amber,
              background: T.amberBg,
              padding: '4px 8px',
              borderRadius: 6,
              marginBottom: 10,
              fontWeight: 600,
            }}
          >
            Stale — computed &gt;24h ago
          </div>
        )}

        {card.food_summary && (
          <div style={{ background: T.surfaceLow, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
              Meals
            </div>
            <div style={{ fontSize: 12, color: T.onSurfaceVar, lineHeight: 1.5 }}>{card.food_summary}</div>
          </div>
        )}

        {card.reason && (
          <div
            style={{
              fontSize: 12,
              color: card.status === 'red' ? T.red : card.status === 'yellow' ? T.amber : T.onSurfaceVar,
              lineHeight: 1.5,
              marginBottom: 10,
              fontWeight: card.status !== 'green' ? 600 : 400,
            }}
          >
            {card.reason}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            Coach Notes
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
              Profile
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
