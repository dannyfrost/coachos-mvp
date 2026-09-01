import { T, font, Card, StatusWord } from '../../../../lib/design-system'

export type AttentionItem = {
  id: string
  client_id: string
  trigger_date: string
  level: '24h' | '48h' | '72h'
  clientName: string
}

export default function NeedsAttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <div style={{ fontFamily: font.heading, fontSize: 15, marginBottom: 4 }}>Needs attention</div>
        <div style={{ fontFamily: font.body, fontSize: 13, color: T.muted }}>Nothing urgent right now.</div>
      </Card>
    )
  }
  return (
    <Card>
      <div style={{ fontFamily: font.heading, fontSize: 15, marginBottom: 10 }}>Needs attention</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <a
            key={item.id}
            href={`/clients/${item.client_id}`}
            style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none', color: T.onSurface, fontFamily: font.body, fontSize: 13 }}
          >
            <span>{item.clientName}</span>
            <StatusWord status={item.level === '72h' ? 'red' : item.level === '48h' ? 'yellow' : 'pending'} labelOverride={item.level} />
          </a>
        ))}
      </div>
    </Card>
  )
}
