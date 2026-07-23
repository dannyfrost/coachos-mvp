'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, Card, Badge, Btn, Avatar, initialsOf } from '../../../../../lib/design-system'

type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated'
type FlashStatus = 'green' | 'yellow' | 'red'
type SubStatus = 'active' | 'expired' | 'overdue'

type PlatformUserData = {
  full_name: string
  email: string
  status: string
  created_at: string
}

type SubscriptionData = {
  status: string
  start_date: string | null
  end_date: string | null
} | null

type FlashCardData = {
  id: string
  status: string
  last_log_at: string | null
  computed_at: string | null
  notes: string | null
} | null

type LogData = {
  id: string
  log_date: string
  steps: number | null
  weight: number | null
  meal_description: string | null
  meal_photo_key: string | null
  questions: string | null
}

type PlanAssignmentData = {
  id: string
  title: string
  plan_type: string
  status: string
  assigned_at: string
}

type MessageData = {
  id: string
  fromClient: boolean
  content: string
  read_at: string | null
  created_at: string
}

type AbsenceEventData = {
  id: string
  trigger_date: string
  level: string
  action_taken: string
  created_at: string
  resolved_at: string | null
}

export type ClientProfileClientProps = {
  clientId: string
  clientCreatedAt: string
  onboardingCompleted: boolean
  platformUser: PlatformUserData
  subscription: SubscriptionData
  flashCard: FlashCardData
  logs: LogData[]
  photoUrlMap: Record<string, string>
  planAssignments: PlanAssignmentData[]
  messages: MessageData[]
  absenceEvents: AbsenceEventData[]
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtLogDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function truncate(str: string | null, max: number): string {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const BORDER_COLOR: Record<string, string> = { green: T.successMid, yellow: T.amberMid, red: T.redMid, paused: '#d1d5db' }
const ABSENCE_LEVEL_STATUS: Record<string, string> = { '24h': 'pending', '48h': 'yellow', '72h': 'red' }

export default function ClientProfileClient({
  clientId,
  clientCreatedAt,
  platformUser,
  subscription,
  flashCard,
  logs,
  photoUrlMap,
  planAssignments,
  messages,
  absenceEvents,
}: ClientProfileClientProps) {
  const [displayStatus, setDisplayStatus] = useState<UserStatus>(platformUser.status as UserStatus)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [notesValue, setNotesValue] = useState(flashCard?.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'overview' | 'report'>('overview')

  async function handlePause() {
    setActionLoading(true)
    setActionError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.rpc('pause_client', { p_client_id: clientId })
    setActionLoading(false)
    if (error) setActionError('Could not pause client. Try again.')
    else setDisplayStatus('paused')
  }

  async function handleUnpause() {
    setActionLoading(true)
    setActionError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.rpc('unpause_client', { p_client_id: clientId })
    setActionLoading(false)
    if (error) setActionError('Could not unpause client. Try again.')
    else setDisplayStatus('active')
  }

  async function handleSaveNotes() {
    if (!flashCard) return
    setNotesSaving(true)
    setNotesSaved(false)
    setNotesError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.rpc('update_flash_card_notes', { p_card_id: flashCard.id, p_notes: notesValue })
    setNotesSaving(false)
    if (error) {
      setNotesError('Could not save notes. Try again.')
    } else {
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    }
  }

  return (
    <div className="page-pad" style={{ maxWidth: 900, margin: '0 auto' }}>
      <a href="/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.primary, fontWeight: 600, fontSize: 13, marginBottom: 18, textDecoration: 'none' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Clients
      </a>

      <div className="profile-header-grid" style={{ marginBottom: 20 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Avatar initials={initialsOf(platformUser.full_name)} size={52} />
              <div>
                <h2 style={{ margin: 0, fontFamily: font.heading, fontWeight: 800, fontSize: 20, color: T.onSurface }}>{platformUser.full_name}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: T.muted }}>
                  {platformUser.email} · Member since {fmtDate(clientCreatedAt)}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge status={displayStatus} />
              {displayStatus === 'active' && (
                <Btn small variant="danger" onClick={handlePause} disabled={actionLoading}>
                  {actionLoading ? '...' : 'Pause'}
                </Btn>
              )}
              {displayStatus === 'paused' && (
                <Btn small variant="success" onClick={handleUnpause} disabled={actionLoading}>
                  {actionLoading ? '...' : 'Unpause'}
                </Btn>
              )}
            </div>
          </div>
          {actionError && <p style={{ color: T.red, fontSize: 12, marginTop: 10 }}>{actionError}</p>}
          {subscription && (
            <div style={{ marginTop: 14, padding: 12, background: T.surfaceLow, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge status={subscription.status} small />
              <span style={{ fontSize: 12, color: T.onSurfaceVar }}>
                {fmtDate(subscription.start_date)} – {fmtDate(subscription.end_date)}
              </span>
            </div>
          )}
        </Card>

        <div
          style={{
            background: T.white,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: shadow.card,
            borderLeft: `4px solid ${flashCard ? (BORDER_COLOR[flashCard.status] ?? '#d1d5db') : '#d1d5db'}`,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Flash Card</span>
            {flashCard && <Badge status={flashCard.status} small />}
          </div>
          <div style={{ padding: '12px 16px' }}>
            {flashCard === null ? (
              <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Flash card data not yet computed.</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: T.muted }}>
                  <span>Last log: {fmtDate(flashCard.last_log_at)}</span>
                  <span>Computed: {fmtDate(flashCard.computed_at)}</span>
                </div>
                <textarea
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  rows={3}
                  placeholder="Add coach notes..."
                  style={{
                    width: '100%',
                    border: 'none',
                    background: T.surfaceLow,
                    borderBottom: `2px solid ${T.primary}`,
                    borderRadius: '6px 6px 0 0',
                    padding: '7px 10px',
                    fontFamily: font.body,
                    fontSize: 12,
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <Btn small variant="secondary" onClick={handleSaveNotes} disabled={notesSaving}>
                    {notesSaving ? 'Saving…' : 'Save notes'}
                  </Btn>
                  {notesSaved && <span style={{ fontSize: 12, color: T.success, fontWeight: 600 }}>Saved ✓</span>}
                  {notesError && <span style={{ fontSize: 12, color: T.red }}>{notesError}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 18 }}>
        {(['overview', 'report'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: font.body,
              fontSize: 13,
              fontWeight: 700,
              color: activeTab === tab ? T.primary : T.muted,
              borderBottom: activeTab === tab ? `2px solid ${T.primary}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab === 'overview' ? 'Overview' : 'Report'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <SectionHeader>Daily Log Timeline</SectionHeader>
          {logs.length === 0 ? (
            <Card style={{ color: T.muted, fontSize: 13 }}>No logs recorded yet.</Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {logs.map(log => {
                const photoUrl = log.meal_photo_key ? photoUrlMap[log.meal_photo_key] : undefined
                return (
                  <Card key={log.id} style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 14, color: T.onSurface }}>{fmtLogDate(log.log_date)}</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: T.muted }}>{log.weight != null ? `${log.weight.toFixed(1)} kg` : '—'}</span>
                        <span style={{ fontSize: 12, color: T.muted }}>{log.steps ?? '—'} steps</span>
                        {photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoUrl}
                            alt="Meal photo"
                            width={40}
                            height={40}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => setLightboxUrl(photoUrl)}
                          />
                        )}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: T.onSurfaceVar, lineHeight: 1.6 }}>{truncate(log.meal_description, 200)}</p>
                    {log.questions && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: T.muted, fontStyle: 'italic' }}>{truncate(log.questions, 160)}</p>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'report' && (
        <ClientReportPanel
          flashCard={flashCard}
          logs={logs}
          planAssignments={planAssignments}
          messages={messages}
          absenceEvents={absenceEvents}
        />
      )}

      {lightboxUrl !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Meal photo"
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function Sparkline({ points, unit, color }: { points: { date: string; value: number | null }[]; unit: string; color: string }) {
  const values = points.map(p => p.value).filter((v): v is number => v !== null)
  if (values.length === 0) {
    return <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No data in this window.</p>
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 70 }}>
      {points.map(p => {
        const pct = p.value !== null ? ((p.value - min) / range) * 80 + 10 : 0
        return (
          <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div
              title={p.value !== null ? `${p.value} ${unit}` : 'No log'}
              style={{ width: '100%', height: `${p.value !== null ? pct : 2}%`, background: p.value !== null ? color : '#e5e7eb', borderRadius: '3px 3px 0 0' }}
            />
          </div>
        )
      })}
    </div>
  )
}

function ClientReportPanel({
  flashCard,
  logs,
  planAssignments,
  messages,
  absenceEvents,
}: {
  flashCard: FlashCardData
  logs: LogData[]
  planAssignments: PlanAssignmentData[]
  messages: MessageData[]
  absenceEvents: AbsenceEventData[]
}) {
  const chronoLogs = [...logs].reverse()
  const weightPoints = chronoLogs.map(l => ({ date: l.log_date, value: l.weight }))
  const stepsPoints = chronoLogs.map(l => ({ date: l.log_date, value: l.steps }))

  const messagesFromClient = messages.filter(m => m.fromClient).length
  const lastMessage = messages[0] ?? null

  const unresolvedAbsences = absenceEvents.filter(e => !e.resolved_at).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <SectionHeader>Flash Card Status</SectionHeader>
        <Card>
          {flashCard === null ? (
            <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Not yet computed.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Badge status={flashCard.status} />
              <span style={{ fontSize: 12, color: T.muted }}>as of {fmtDate(flashCard.computed_at)}</span>
            </div>
          )}
          <p style={{ fontSize: 11, color: T.muted, marginTop: 10, marginBottom: 0 }}>
            Current status only — flash cards store a single live value per client, not a history of past color changes.
          </p>
        </Card>
      </div>

      <div>
        <SectionLabelRow left="Weight Trend" right={`last ${chronoLogs.length} logs`} />
        <Card>
          <Sparkline points={weightPoints} unit="kg" color={T.primary} />
        </Card>
      </div>

      <div>
        <SectionLabelRow left="Steps Trend" right={`last ${chronoLogs.length} logs`} />
        <Card>
          <Sparkline points={stepsPoints} unit="steps" color={T.successMid} />
        </Card>
      </div>

      <div>
        <SectionHeader>Plan History</SectionHeader>
        {planAssignments.length === 0 ? (
          <Card style={{ color: T.muted, fontSize: 13 }}>No plans assigned yet.</Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {planAssignments.map(p => (
              <Card key={p.id} style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge status={p.plan_type} small />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.onSurface }}>{p.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{fmtDate(p.assigned_at)}</span>
                  <Badge status={p.status} small />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader>Messages</SectionHeader>
        <Card>
          <div style={{ display: 'flex', gap: 20, marginBottom: lastMessage ? 12 : 0, fontSize: 12, color: T.muted }}>
            <span>{messages.length} total</span>
            <span>{messagesFromClient} from client</span>
            <span>{messages.length - messagesFromClient} from coach/staff</span>
          </div>
          {lastMessage ? (
            <div style={{ padding: 10, background: T.surfaceLow, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>
                Last message · {lastMessage.fromClient ? 'from client' : 'to client'} · {fmtDateTime(lastMessage.created_at)}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: T.onSurfaceVar }}>{truncate(lastMessage.content, 160)}</p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No messages yet.</p>
          )}
        </Card>
      </div>

      <div>
        <SectionLabelRow left="Absence Events" right={unresolvedAbsences > 0 ? `${unresolvedAbsences} unresolved` : 'all resolved'} />
        {absenceEvents.length === 0 ? (
          <Card style={{ color: T.muted, fontSize: 13 }}>No absence events recorded.</Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {absenceEvents.map(e => (
              <Card key={e.id} style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge status={ABSENCE_LEVEL_STATUS[e.level] ?? 'pending'} small labelOverride={e.level} />
                  <span style={{ fontSize: 12, color: T.muted }}>triggered {fmtDate(e.trigger_date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {e.resolved_at && <span style={{ fontSize: 12, color: T.muted }}>resolved {fmtDate(e.resolved_at)}</span>}
                  <Badge status={e.action_taken} small />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabelRow({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{left}</div>
      <div style={{ fontSize: 11, color: T.muted }}>{right}</div>
    </div>
  )
}
