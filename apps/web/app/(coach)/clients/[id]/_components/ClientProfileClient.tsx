'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, font, Card, Badge, StatusWord, Btn, Avatar, initialsOf } from '../../../../../lib/design-system'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

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
  weight_photo_key: string | null
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

type MealEntryData = {
  id: string
  log_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description: string | null
  photo_key: string | null
}

export type ClientProfileClientProps = {
  clientId: string
  clientCreatedAt: string
  onboardingCompleted: boolean
  age: number | null
  heightCm: number | null
  conditionNotes: string | null
  platformUser: PlatformUserData
  subscription: SubscriptionData
  flashCard: FlashCardData
  logs: LogData[]
  photoUrlMap: Record<string, string>
  planAssignments: PlanAssignmentData[]
  messages: MessageData[]
  absenceEvents: AbsenceEventData[]
  mealEntries: MealEntryData[]
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
  age,
  heightCm,
  conditionNotes,
  platformUser,
  subscription,
  flashCard,
  logs,
  photoUrlMap,
  planAssignments,
  messages,
  absenceEvents,
  mealEntries,
}: ClientProfileClientProps) {
  const [displayStatus, setDisplayStatus] = useState<UserStatus>(platformUser.status as UserStatus)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)

  const [notesValue, setNotesValue] = useState(flashCard?.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'overview' | 'meals' | 'report'>('overview')

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

  async function handleDeactivate() {
    setActionLoading(true)
    setActionError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.rpc('deactivate_client', { p_client_id: clientId })
    setActionLoading(false)
    setConfirmingDeactivate(false)
    if (error) setActionError('Could not deactivate client. Try again.')
    else setDisplayStatus('deactivated')
  }

  async function handleReactivate() {
    setActionLoading(true)
    setActionError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.rpc('reactivate_client', { p_client_id: clientId })
    setActionLoading(false)
    if (error) setActionError('Could not reactivate client. Try again.')
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

  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const
  const MEAL_LABELS: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
  }

  const groupedMealsByDate = (mealEntries ?? []).reduce<Record<string, MealEntryData[]>>((acc, entry) => {
    if (!acc[entry.log_date]) acc[entry.log_date] = []
    acc[entry.log_date].push(entry)
    return acc
  }, {})

  const sortedMealDates = Object.keys(groupedMealsByDate).sort((a, b) => b.localeCompare(a))

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
              <StatusWord status={displayStatus} />
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
              {(displayStatus === 'active' || displayStatus === 'paused') && !confirmingDeactivate && (
                <Btn small variant="secondary" onClick={() => setConfirmingDeactivate(true)} disabled={actionLoading}>
                  Deactivate
                </Btn>
              )}
              {displayStatus === 'deactivated' && (
                <Btn small variant="success" onClick={handleReactivate} disabled={actionLoading}>
                  {actionLoading ? '...' : 'Reactivate'}
                </Btn>
              )}
            </div>
          </div>
          {confirmingDeactivate && (
            <div style={{ marginTop: 12, padding: 12, background: T.redBg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: T.red, fontWeight: 600 }}>
                This marks the client as deactivated. Their data is preserved and they can be reactivated anytime. Confirm?
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn small variant="danger" onClick={handleDeactivate} disabled={actionLoading}>
                  {actionLoading ? '...' : 'Confirm Deactivate'}
                </Btn>
                <Btn small variant="secondary" onClick={() => setConfirmingDeactivate(false)} disabled={actionLoading}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}
          {actionError && <p style={{ color: T.red, fontSize: 12, marginTop: 10 }}>{actionError}</p>}
          {subscription && (
            <div style={{ marginTop: 14, padding: 12, background: T.surfaceLow, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusWord status={subscription.status} />
              <span style={{ fontSize: 12, color: T.onSurfaceVar }}>
                {fmtDate(subscription.start_date)} – {fmtDate(subscription.end_date)}
              </span>
            </div>
          )}
        </Card>

        <div
          style={{
            background: T.white,
            borderRadius: 8,
            overflow: 'hidden',
            borderLeft: `4px solid ${flashCard ? (BORDER_COLOR[flashCard.status] ?? '#d1d5db') : '#d1d5db'}`,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Flash Card</span>
            {flashCard && <StatusWord status={flashCard.status} />}
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
                    borderRadius: '8px 8px 0 0',
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

      <div style={{ display: 'flex', gap: 20, padding: '10px 16px', background: T.surfaceLow, borderRadius: 8, marginBottom: 18, fontSize: 12, flexWrap: 'wrap' }}>
        <span><span style={{ color: T.muted }}>Age: </span><span style={{ fontWeight: 600, color: T.onSurface }}>{age !== null ? `${age} yrs` : 'Not set'}</span></span>
        <span><span style={{ color: T.muted }}>Height: </span><span style={{ fontWeight: 600, color: T.onSurface }}>{heightCm !== null ? `${heightCm} cm` : 'Not set'}</span></span>
        <span><span style={{ color: T.muted }}>Conditions: </span><span style={{ fontWeight: 600, color: T.onSurface }}>{conditionNotes && conditionNotes.trim().length > 0 ? conditionNotes : 'None reported'}</span></span>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 18 }}>
        {(['overview', 'meals', 'report'] as const).map(tab => (
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
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? T.primary : T.muted,
              textDecoration: activeTab === tab ? 'underline' : 'none',
              textUnderlineOffset: 3,
            }}
          >
            {tab === 'overview' ? 'Overview' : tab === 'meals' ? 'Meals' : 'Report'}
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
                const dayMeals = groupedMealsByDate[log.log_date] ?? []
                const dayMealWithPhoto = dayMeals.find(m => m.photo_key)
                const photoUrl = dayMealWithPhoto?.photo_key ? photoUrlMap[dayMealWithPhoto.photo_key] : undefined
                const weightPhotoUrl = log.weight_photo_key ? photoUrlMap[log.weight_photo_key] : undefined
                const mealSummary = dayMeals.length > 0
                  ? dayMeals.filter(m => m.description).map(m => m.description).join(' · ') || null
                  : null
                return (
                  <Card key={log.id} style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 14, color: T.onSurface }}>{fmtLogDate(log.log_date)}</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: T.muted }}>{log.weight != null ? `${log.weight.toFixed(1)} kg` : '—'}</span>
                          {weightPhotoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={weightPhotoUrl}
                              alt="Weight scale photo"
                              width={24}
                              height={24}
                              style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                              onClick={() => setLightboxUrl(weightPhotoUrl)}
                            />
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: T.muted }}>{log.steps ?? '—'} steps</span>
                        {photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoUrl}
                            alt="Meal photo"
                            width={40}
                            height={40}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                            onClick={() => setLightboxUrl(photoUrl)}
                          />
                        )}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: T.onSurfaceVar, lineHeight: 1.6 }}>{truncate(mealSummary, 200)}</p>
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

      {activeTab === 'meals' && (
        <>
          <SectionHeader>Meal Entries Timeline</SectionHeader>
          {sortedMealDates.length === 0 ? (
            <Card style={{ color: T.muted, fontSize: 13 }}>No meal entries recorded yet.</Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedMealDates.map(date => {
                const dayEntries = groupedMealsByDate[date] ?? []
                return (
                  <Card key={date} style={{ padding: '16px 20px' }}>
                    <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 14, color: T.onSurface, marginBottom: 12 }}>
                      {fmtLogDate(date)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {MEAL_ORDER.map(mType => {
                        const entry = dayEntries.find(e => e.meal_type === mType)
                        if (!entry) return null
                        const photoUrl = entry.photo_key ? photoUrlMap[entry.photo_key] : undefined
                        return (
                          <div
                            key={mType}
                            style={{
                              padding: '10px 14px',
                              background: T.surfaceLow,
                              borderRadius: 8,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 12,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                {MEAL_LABELS[mType]}
                              </div>
                              <p style={{ margin: 0, fontSize: 13, color: T.onSurfaceVar, lineHeight: 1.5 }}>
                                {entry.description ? truncate(entry.description, 300) : <span style={{ color: T.muted, fontStyle: 'italic' }}>No description</span>}
                              </p>
                            </div>
                            {photoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoUrl}
                                alt={`${MEAL_LABELS[mType]} photo`}
                                width={48}
                                height={48}
                                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                                onClick={() => setLightboxUrl(photoUrl)}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
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

function TrendChart({ points, unit, color }: { points: { date: string; value: number | null }[]; unit: string; color: string }) {
  const hasData = points.some(p => p.value !== null)
  if (!hasData) {
    return <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No data in this window.</p>
  }
  const data = points.map(p => ({
    label: new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    value: p.value,
  }))
  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={T.border} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: T.muted }}
            tickLine={false}
            axisLine={{ stroke: T.border }}
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 11, fill: T.muted }}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip
            contentStyle={{ borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 12, fontFamily: font.body, boxShadow: 'none' }}
            labelStyle={{ color: T.muted }}
            formatter={(value) => [`${value} ${unit}`, '']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
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
              <StatusWord status={flashCard.status} />
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
          <TrendChart points={weightPoints} unit="kg" color={T.primary} />
        </Card>
      </div>

      <div>
        <SectionLabelRow left="Steps Trend" right={`last ${chronoLogs.length} logs`} />
        <Card>
          <TrendChart points={stepsPoints} unit="steps" color={T.successMid} />
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
                  <StatusWord status={p.status} />
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
                  <StatusWord status={ABSENCE_LEVEL_STATUS[e.level] ?? 'pending'} labelOverride={e.level} />
                  <span style={{ fontSize: 12, color: T.muted }}>triggered {fmtDate(e.trigger_date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {e.resolved_at && <span style={{ fontSize: 12, color: T.muted }}>resolved {fmtDate(e.resolved_at)}</span>}
                  <StatusWord status={e.action_taken} />
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
