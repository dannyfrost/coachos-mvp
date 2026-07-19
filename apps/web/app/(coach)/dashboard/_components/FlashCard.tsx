'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'

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

const STATUS_COLORS: Record<string, string> = {
  red: '#dc3545',
  yellow: '#ffc107',
  green: '#28a745',
  paused: '#6c757d',
}

const NOTES_MAX = 120

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

  const isStale =
    new Date(card.computed_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)
  const statusColor = STATUS_COLORS[card.status] ?? '#6c757d'
  const truncatedNotes =
    card.notes && card.notes.length > NOTES_MAX
      ? card.notes.slice(0, NOTES_MAX) + '...'
      : card.notes

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
        onRefresh(updated)
      }
    } catch {
      setRefreshError('Refresh failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: `2px solid ${statusColor}`,
        borderRadius: 8,
        padding: '1rem',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{clientName}</strong>
        <span
          style={{
            background: statusColor,
            color: card.status === 'yellow' ? '#000' : '#fff',
            padding: '0.2rem 0.6rem',
            borderRadius: 12,
            fontSize: '0.8rem',
            textTransform: 'uppercase',
          }}
        >
          {card.status}
        </span>
      </div>

      {isStale && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#856404',
            background: '#fff3cd',
            padding: '0.25rem 0.5rem',
            borderRadius: 4,
          }}
        >
          Stale — computed &gt;24h ago
        </div>
      )}

      {card.reason && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
          <strong>Reason:</strong> {card.reason}
        </p>
      )}
      {card.food_summary && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6c757d' }}>{card.food_summary}</p>
      )}
      {card.interpretation && (
        <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#495057' }}>
          {card.interpretation}
        </p>
      )}
      {truncatedNotes && (
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6c757d',
            borderTop: '1px solid #e9ecef',
            paddingTop: '0.25rem',
          }}
        >
          <strong>Notes:</strong> {truncatedNotes}
        </p>
      )}
      {card.last_log_at && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#adb5bd' }}>
          Last log: {new Date(card.last_log_at).toLocaleString()}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem', gap: '0.5rem' }}>
        <a
          href={`/clients/${card.client_id}`}
          style={{ fontSize: '0.85rem', color: '#0d6efd', textDecoration: 'none' }}
        >
          Open Profile
        </a>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '0.25rem 0.75rem',
            fontSize: '0.85rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: '#0d6efd',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {refreshError && (
        <p style={{ color: '#dc3545', fontSize: '0.8rem', margin: 0 }}>{refreshError}</p>
      )}
    </div>
  )
}
