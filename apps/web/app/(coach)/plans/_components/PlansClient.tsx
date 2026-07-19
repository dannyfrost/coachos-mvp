'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, Card, Badge, Btn, FieldLabel, inputStyle } from '../../../../lib/design-system'

type PlanType = 'meal' | 'workout'
type PlanStatus = 'active' | 'archived'

export type PlanRow = {
  id: string
  title: string
  type: PlanType
  status: PlanStatus
  is_template: boolean
  created_at: string
  updated_at: string
  content: unknown
  hasActiveAssignments: boolean
}

export type ActiveClientOption = { id: string; full_name: string }

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function contentToText(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'object' && content !== null && 'body' in (content as Record<string, unknown>)) {
    const body = (content as Record<string, unknown>).body
    return typeof body === 'string' ? body : ''
  }
  return typeof content === 'string' ? content : ''
}

function PlanFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: PlanRow | null
  onClose: () => void
  onSaved: (plan: PlanRow) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<PlanType>(initial?.type ?? 'meal')
  const [body, setBody] = useState(contentToText(initial?.content))
  const [isTemplate, setIsTemplate] = useState(initial?.is_template ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()

    if (initial) {
      const { data, error: updateError } = await supabase
        .from('plans')
        .update({ title, type, content: { body }, is_template: isTemplate, updated_at: new Date().toISOString() })
        .eq('id', initial.id)
        .select()
        .single()

      setSaving(false)
      if (updateError || !data) {
        setError(updateError?.message ?? 'Could not save plan.')
        return
      }
      onSaved({ ...initial, title, type, content: { body }, is_template: isTemplate, updated_at: data.updated_at })
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSaving(false)
        setError('Session expired. Refresh and try again.')
        return
      }

      const { data, error: insertError } = await supabase
        .from('plans')
        .insert({ coach_id: user.id, title, type, content: { body }, is_template: isTemplate })
        .select()
        .single()

      setSaving(false)
      if (insertError || !data) {
        setError(insertError?.message ?? 'Could not create plan.')
        return
      }
      onSaved({
        id: data.id,
        title: data.title,
        type: data.type,
        status: data.status,
        is_template: data.is_template,
        created_at: data.created_at,
        updated_at: data.updated_at,
        content: data.content,
        hasActiveAssignments: false,
      })
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ background: T.white, borderRadius: 14, boxShadow: shadow.float, width: '100%', maxWidth: 480, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 16px', fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: T.onSurface }}>
          {initial ? 'Edit Plan' : 'Create Plan'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Title</FieldLabel>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Type</FieldLabel>
            <select value={type} onChange={e => setType(e.target.value as PlanType)} style={inputStyle}>
              <option value="meal">Meal</option>
              <option value="workout">Workout</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Content</FieldLabel>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              placeholder="Plan details..."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: T.onSurfaceVar, cursor: 'pointer' }}>
            <input type="checkbox" checked={isTemplate} onChange={e => setIsTemplate(e.target.checked)} />
            Mark as reusable template
          </label>
          {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn type="submit" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
            <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssignModal({
  plan,
  clients,
  onClose,
}: {
  plan: PlanRow
  clients: ActiveClientOption[]
  onClose: () => void
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsReplace, setNeedsReplace] = useState(false)
  const [done, setDone] = useState(false)

  async function doAssign() {
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: assignError } = await supabase.rpc('assign_plan', { p_client_id: clientId, p_plan_id: plan.id })
    setLoading(false)
    if (assignError) {
      if (assignError.message.includes('already has an active')) {
        setNeedsReplace(true)
      } else {
        setError(assignError.message)
      }
      return
    }
    setDone(true)
  }

  async function doReplace() {
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: replaceError } = await supabase.rpc('replace_active_plan', {
      p_client_id: clientId,
      p_plan_type: plan.type,
      p_new_plan_id: plan.id,
    })
    setLoading(false)
    if (replaceError) {
      setError(replaceError.message)
      return
    }
    setDone(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ background: T.white, borderRadius: 14, boxShadow: shadow.float, width: '100%', maxWidth: 400, padding: 24 }}>
        <h2 style={{ margin: '0 0 6px', fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: T.onSurface }}>Assign Plan</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: T.muted }}>{plan.title}</p>

        {done ? (
          <>
            <p style={{ fontSize: 13, color: T.success, fontWeight: 600, marginBottom: 16 }}>Plan assigned successfully.</p>
            <Btn full variant="secondary" onClick={onClose}>
              Done
            </Btn>
          </>
        ) : needsReplace ? (
          <>
            <p style={{ fontSize: 13, color: T.amber, marginBottom: 16 }}>
              This client already has an active {plan.type} plan. Replace it with this one?
            </p>
            {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={doReplace} disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Replacing…' : 'Replace'}
              </Btn>
              <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>Client</FieldLabel>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={doAssign} disabled={loading || !clientId} style={{ flex: 1 }}>
                {loading ? 'Assigning…' : 'Assign'}
              </Btn>
              <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PlansClient({
  plans: initialPlans,
  activeClients,
  isCoach,
}: {
  plans: PlanRow[]
  activeClients: ActiveClientOption[]
  isCoach: boolean
}) {
  const [plans, setPlans] = useState(initialPlans)
  const [typeFilter, setTypeFilter] = useState<'all' | PlanType>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [formPlan, setFormPlan] = useState<PlanRow | null | undefined>(undefined)
  const [assignPlan, setAssignPlan] = useState<PlanRow | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const filtered = plans.filter(p => {
    if (!showArchived && p.status === 'archived') return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    return true
  })

  function handleSaved(plan: PlanRow) {
    setPlans(prev => {
      const exists = prev.some(p => p.id === plan.id)
      return exists ? prev.map(p => (p.id === plan.id ? plan : p)) : [plan, ...prev]
    })
    setFormPlan(undefined)
  }

  async function handleArchive(plan: PlanRow) {
    setArchiveError(null)
    if (plan.hasActiveAssignments) {
      setArchiveError(`Cannot archive "${plan.title}" — it has active client assignments.`)
      return
    }
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.from('plans').update({ status: 'archived' }).eq('id', plan.id)
    if (error) {
      setArchiveError(error.message)
      return
    }
    setPlans(prev => prev.map(p => (p.id === plan.id ? { ...p, status: 'archived' } : p)))
  }

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
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | PlanType)} style={selectStyle}>
          <option value="all">All types</option>
          <option value="meal">Meal</option>
          <option value="workout">Workout</option>
        </select>
        <button
          onClick={() => setShowArchived(v => !v)}
          style={{
            ...selectStyle,
            background: showArchived ? T.primary : T.white,
            color: showArchived ? '#fff' : T.onSurfaceVar,
          }}
        >
          {showArchived ? 'Showing archived' : 'Active only'}
        </button>
        {isCoach && (
          <Btn onClick={() => setFormPlan(null)} style={{ marginLeft: 'auto' }}>
            + New Plan
          </Btn>
        )}
      </div>

      {archiveError && (
        <div style={{ background: T.redBg, color: T.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          {archiveError}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '40px 24px' }}>No plans yet.</Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 90px 90px 90px 1fr 1fr',
              padding: '10px 20px',
              background: T.surfaceLow,
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            {['Title', 'Type', 'Status', 'Template', 'Updated', 'Actions'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {h}
              </span>
            ))}
          </div>
          {filtered.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 90px 90px 90px 1fr 1fr',
                padding: '13px 20px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14, color: T.onSurface }}>{p.title}</span>
              <Badge status={p.type} small labelOverride={p.type === 'meal' ? 'Meal' : 'Workout'} />
              <Badge status={p.status} small />
              <span style={{ fontSize: 13, color: T.muted }}>{p.is_template ? 'Yes' : 'No'}</span>
              <span style={{ fontSize: 13, color: T.onSurface }}>{fmtDate(p.updated_at)}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small variant="secondary" onClick={() => setAssignPlan(p)} disabled={p.status !== 'active' || activeClients.length === 0}>
                  Assign
                </Btn>
                {isCoach && p.status === 'active' && (
                  <Btn small variant="secondary" onClick={() => setFormPlan(p)}>
                    Edit
                  </Btn>
                )}
                {isCoach && p.status === 'active' && (
                  <Btn small variant="danger" onClick={() => handleArchive(p)}>
                    Archive
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {formPlan !== undefined && <PlanFormModal initial={formPlan} onClose={() => setFormPlan(undefined)} onSaved={handleSaved} />}
      {assignPlan && <AssignModal plan={assignPlan} clients={activeClients} onClose={() => setAssignPlan(null)} />}
    </div>
  )
}
