'use client'

import { useState, useMemo } from 'react'
import FlashCard from './FlashCard'
import { T, shadow, font, Card, SectionLabel } from '../../../../lib/design-system'

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
const FILTERS = ['all', 'red', 'yellow', 'green', 'paused'] as const

export default function DashboardClient({ flashCards: initialCards, clients, missingCheckIns, subscription }: Props) {
  const [cards, setCards] = useState<FlashCardData[]>(initialCards)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>('all')

  const clientMap = useMemo(() => {
    const map = new Map<string, ClientData>()
    clients.forEach(c => map.set(c.id, c))
    return map
  }, [clients])

  const activeCount = useMemo(() => clients.filter(c => c.status === 'active').length, [clients])

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
        return !!client && (client.full_name ?? '').toLowerCase().includes(term)
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

  const kpis = [
    { label: 'Active Clients', value: String(activeCount), color: T.primary },
    { label: 'Missing Check-ins Today', value: String(missingCheckIns), color: T.redMid },
    { label: 'Red', value: String(stats.red), color: T.redMid },
    { label: 'Yellow', value: String(stats.yellow), color: T.amberMid },
    { label: 'Green', value: String(stats.green), color: T.successMid },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      {isTrial && (
        <div
          style={{
            background: T.amberBg,
            color: T.amber,
            borderRadius: 10,
            padding: '10px 16px',
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Trial active — ends {new Date(subscription!.current_period_end!).toLocaleDateString()}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map(kpi => (
          <Card key={kpi.label} style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 26, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <SectionLabel>Flash Cards</SectionLabel>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: T.white,
            borderRadius: 8,
            padding: '7px 12px',
            boxShadow: shadow.card,
            maxWidth: 240,
          }}
        >
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: T.onSurface, fontFamily: font.body, width: '100%' }}
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: font.body,
                fontWeight: 600,
                transition: 'all 0.15s',
                background: statusFilter === f ? T.primary : T.surfaceHigh,
                color: statusFilter === f ? '#fff' : T.onSurfaceVar,
              }}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sortedAndFiltered.length === 0 ? (
        <Card style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '40px 24px' }}>No clients match your filter.</Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {sortedAndFiltered.map(card => {
            const client = clientMap.get(card.client_id)
            const clientName = client?.full_name?.trim() || 'Unknown'
            return <FlashCard key={card.id} card={card} clientName={clientName} onRefresh={handleRefresh} />
          })}
        </div>
      )}
    </div>
  )
}
