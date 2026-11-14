import { ChevronRight } from 'lucide-react'
import { T, font } from '../../../../lib/design-system'

export type AttentionItem = {
  id: string
  client_id: string
  trigger_date: string
  level: '24h' | '48h' | '72h'
  clientName: string
}

// Urgency is carried by the absence level. Give each a plain-language reason a
// coach reads at a glance, and a dot color that matches the flash-status spine.
const LEVEL: Record<AttentionItem['level'], { reason: string; dot: string }> = {
  '72h': { reason: 'No check-in for 3+ days', dot: T.redMid },
  '48h': { reason: 'No check-in for 2 days', dot: T.amberMid },
  '24h': { reason: 'No check-in since yesterday', dot: T.blue },
}

export default function NeedsAttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          background: T.white,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.successMid, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 15, color: T.onSurface }}>
            Everyone&apos;s on track
          </div>
          <div style={{ fontFamily: font.body, fontSize: 13, color: T.muted, marginTop: 2 }}>
            No clients are waiting on you right now.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: T.white,
        border: `1px solid ${T.border}`,
        // A hairline left accent in the most-urgent color: this panel is the
        // first thing a coach should act on.
        borderLeft: `3px solid ${LEVEL[items[0].level].dot}`,
        borderRadius: 12,
        padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 16, color: T.onSurface }}>
          Needs you today
        </span>
        <span style={{ fontFamily: font.body, fontSize: 13, color: T.muted }}>
          {items.length} {items.length === 1 ? 'client' : 'clients'}
        </span>
      </div>

      <div className="attention-grid">
        {items.map(item => {
          const meta = LEVEL[item.level]
          return (
            <a
              key={item.id}
              href={`/clients/${item.client_id}`}
              className="attention-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                padding: '9px 10px',
                borderRadius: 8,
                color: T.onSurface,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
              <span style={{ fontFamily: font.heading, fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                {item.clientName}
              </span>
              <span style={{ fontFamily: font.body, fontSize: 13, color: T.onSurfaceVar, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {meta.reason}
              </span>
              <ChevronRight size={16} color={T.muted} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </a>
          )
        })}
      </div>
    </div>
  )
}
