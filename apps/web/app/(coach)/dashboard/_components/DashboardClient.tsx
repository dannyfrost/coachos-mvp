'use client'

import { useState, useMemo } from 'react'
import FlashCard from './FlashCard'

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

type ClientData = {
  id: string
  status: string
  full_name: string | null
}

type SubscriptionData = {
  plan_name: string | null
  current_period_end: string | null
  status: string
} | null

type Props = {
  flashCards: FlashCardData[]
  clients: ClientData[]
  missingCheckIns: number
  subscription: SubscriptionData
}

const SEVERITY_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, paused: 3 }

export default function DashboardClient({
  flashCards: initialCards,
  clients,
  missingCheckIns,
  subscription,
}: Props) {
  const [cards, setCards] = useState<FlashCardData[]>(initialCards)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const clientMap = useMemo(() => {
    const map = new Map<string, ClientData>()
    clients.forEach(c => map.set(c.id, c))
    return map
  }, [clients])

  const activeCount = useMemo(
    () => clients.filter(c => c.status === 'active').length,
    [clients]
  )

  const stats = useMemo(
    () => ({
      red: cards.filter(c => c.status === 'red').length,
      yellow: cards.filter(c => c.status === 'yellow').length,
      green: cards.filter(c => c.status === 'green').length,
    }),
    [cards]
  )

  const sortedAndFiltered = useMemo(() => {
    let filtered = cards

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    if (search.trim()) {
      const term = search.toLowerCase()
      filtered = filtered.filter(c => {
        const client = clientMap.get(c.client_id)
        if (!client) return false
        const name = (client.full_name ?? '').toLowerCase()
        return name.includes(term)
      })
    }

    return [...filtered].sort((a, b) => {
      const aOrder = SEVERITY_ORDER[a.status] ?? 4
      const bOrder = SEVERITY_ORDER[b.status] ?? 4
      if (aOrder !== bOrder) return aOrder - bOrder
      if (!a.last_log_at && !b.last_log_at) return 0
      if (!a.last_log_at) return 1
      if (!b.last_log_at) return -1
      return new Date(b.last_log_at).getTime() - new Date(a.last_log_at).getTime()
    })
  }, [cards, statusFilter, search, clientMap])

  function handleRefresh(updated: FlashCardData) {
    setCards(prev => prev.map(c => (c.id === updated.id ? updated : c)))
  }

  const isTrial = subscription?.plan_name === 'trial' && !!subscription.current_period_end

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      {isTrial && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
          }}
        >
          Trial active — ends{' '}
          {new Date(subscription!.current_period_end!).toLocaleDateString()}
        </div>
      )}

      <h1 style={{ marginBottom: '1rem' }}>Coach Dashboard</h1>

      <div
        style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
      >
        <StatCard label="Active Clients" value={activeCount} />
        <StatCard label="Missing Check-ins Today" value={missingCheckIns} />
        <StatCard label="Red" value={stats.red} color="#dc3545" />
        <StatCard label="Yellow" value={stats.yellow} color="#856404" />
        <StatCard label="Green" value={stats.green} color="#28a745" />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by client name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            flex: 1,
          }}
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        >
          <option value="all">All statuses</option>
          <option value="red">Red</option>
          <option value="yellow">Yellow</option>
          <option value="green">Green</option>
        </select>
      </div>

      {sortedAndFiltered.length === 0 ? (
        <p style={{ color: '#6c757d' }}>No clients match your filter.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}
        >
          {sortedAndFiltered.map(card => {
            const client = clientMap.get(card.client_id)
            const clientName = client?.full_name?.trim() || 'Unknown'
            return (
              <FlashCard
                key={card.id}
                card={card}
                clientName={clientName}
                onRefresh={handleRefresh}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div
      style={{
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: color ?? '#212529' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{label}</div>
    </div>
  )
}
