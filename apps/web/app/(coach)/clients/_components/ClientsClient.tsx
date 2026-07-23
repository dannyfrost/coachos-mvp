'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, Card, Badge, FlashDot, Btn, FieldLabel, inputStyle } from '../../../../lib/design-system'

type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated'
type FlashStatus = 'green' | 'yellow' | 'red'
type SubStatus = 'active' | 'expired' | 'overdue'

export interface ClientRow {
  id: string
  onboarding_completed: boolean
  created_at: string
  platform_users: {
    full_name: string
    email: string
    status: UserStatus
  } | null
  flash?: {
    status: FlashStatus
    last_log_at: string | null
    computed_at: string | null
  }
  subscription?: {
    status: SubStatus
    end_date: string | null
    start_date: string | null
  }
  expiringSoon?: boolean
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invited, setInvited] = useState<{ emailSent: boolean; warning?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setError('Session expired. Please refresh and try again.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/clients/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, full_name: fullName }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.')
        setLoading(false)
        return
      }

      setInvited({ emailSent: json.email_sent, warning: json.warning })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        padding: 16,
      }}
    >
      <div style={{ background: T.white, borderRadius: 14, boxShadow: shadow.float, width: '100%', maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: T.onSurface }}>Invite Client</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: T.muted }}
          >
            &times;
          </button>
        </div>

        {invited ? (
          <div>
            {invited.emailSent ? (
              <p style={{ fontSize: 13, color: T.onSurfaceVar }}>Client invited successfully. An activation email has been sent to them.</p>
            ) : (
              <p style={{ fontSize: 13, color: T.amber }}>
                Client record was created, but the invite email could not be sent. Ask an admin to check email configuration
                before inviting real clients.
              </p>
            )}
            <Btn full variant="secondary" onClick={onClose}>
              Done
            </Btn>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Full Name</FieldLabel>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                style={inputStyle}
              />
            </div>
            {error && <p style={{ fontSize: 13, color: T.red, marginBottom: 12 }}>{error}</p>}
            <Btn type="submit" full disabled={loading}>
              {loading ? 'Sending…' : 'Send Invite'}
            </Btn>
          </form>
        )}
      </div>
    </div>
  )
}

type SortKey = 'name' | 'last_log' | 'subscription'
const STATUS_FILTERS: (UserStatus | 'all')[] = ['all', 'active', 'pending', 'paused']
const FLASH_FILTERS: (FlashStatus | 'all')[] = ['all', 'green', 'yellow', 'red']

export default function ClientsClient({ clients }: { clients: ClientRow[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all')
  const [flashFilter, setFlashFilter] = useState<FlashStatus | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [showModal, setShowModal] = useState(false)

  const filtered = clients
    .filter(c => {
      const pu = c.platform_users
      if (!pu) return false
      if (statusFilter !== 'all' && pu.status !== statusFilter) return false
      if (flashFilter !== 'all' && c.flash?.status !== flashFilter) return false
      const q = search.toLowerCase()
      if (q && !pu.full_name.toLowerCase().includes(q) && !pu.email.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      if (sortKey === 'name') return (a.platform_users?.full_name ?? '').localeCompare(b.platform_users?.full_name ?? '')
      if (sortKey === 'last_log') return (b.flash?.last_log_at ?? '').localeCompare(a.flash?.last_log_at ?? '')
      if (sortKey === 'subscription') return (a.subscription?.status ?? 'z').localeCompare(b.subscription?.status ?? 'z')
      return 0
    })

  const selectStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.body,
    fontSize: 12,
    fontWeight: 600,
    background: T.white,
    color: T.onSurfaceVar,
    boxShadow: shadow.card,
  }

  return (
    <div className="page-pad">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: T.white,
            borderRadius: 8,
            padding: '8px 14px',
            boxShadow: shadow.card,
            flex: 1,
            maxWidth: 320,
          }}
        >
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: T.onSurface, fontFamily: font.body, width: '100%' }}
          />
        </div>

        <select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as UserStatus | 'all')} style={selectStyle}>
          {STATUS_FILTERS.map(f => (
            <option key={f} value={f}>
              {f === 'all' ? 'All statuses' : f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>

        <select aria-label="Filter by flash status" value={flashFilter} onChange={e => setFlashFilter(e.target.value as FlashStatus | 'all')} style={selectStyle}>
          {FLASH_FILTERS.map(f => (
            <option key={f} value={f}>
              {f === 'all' ? 'All flash' : f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>

        <select aria-label="Sort by" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} style={selectStyle}>
          <option value="name">Sort: Name</option>
          <option value="last_log">Sort: Last Log</option>
          <option value="subscription">Sort: Subscription</option>
        </select>

        <Btn onClick={() => setShowModal(true)} style={{ marginLeft: 'auto' }}>
          + Add Client
        </Btn>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
       <div className="table-scroll">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 80px 1fr 1fr 120px',
            minWidth: 720,
            padding: '10px 20px',
            background: T.surfaceLow,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          {['Client', 'Status', 'Flash', 'Last Log', 'Subscription', 'Actions'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {h}
            </span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: T.muted, fontSize: 13 }}>No clients match the current filters.</div>
        ) : (
          filtered.map((c, i) => {
            const pu = c.platform_users!
            return (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 80px 1fr 1fr 120px',
                  minWidth: 720,
                  padding: '13px 20px',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: T.onSurface }}>{pu.full_name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{pu.email}</div>
                </div>
                <Badge status={pu.status} small />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {c.flash ? <FlashDot status={c.flash.status} /> : <FlashDot status="—" />}
                  <span style={{ fontSize: 11, color: T.muted }}>{c.flash?.status ?? '—'}</span>
                </div>
                <span style={{ fontSize: 13, color: T.onSurface }}>{fmtDate(c.flash?.last_log_at)}</span>
                <div>
                  {c.subscription ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Badge status={c.subscription.status} small />
                      {c.expiringSoon && <Badge status="pending" small labelOverride="expiring soon" />}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: T.muted }}>—</span>
                  )}
                </div>
                <a href={`/clients/${c.id}`} style={{ textDecoration: 'none' }}>
                  <Btn small variant="primary">
                    Profile
                  </Btn>
                </a>
              </div>
            )
          })
        )}
       </div>
      </Card>

      {showModal && <InviteModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
