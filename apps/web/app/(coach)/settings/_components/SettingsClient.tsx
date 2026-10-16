'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, font, Card, Btn, FieldLabel, inputStyle } from '../../../../lib/design-system'

const TIMEZONES =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC', 'America/New_York', 'Europe/London']

type Props = {
  coachName: string
  coachEmail: string
  workspaceName: string
  timezone: string
  absenceWarningDays: number
  absenceCriticalDays: number
  weightStagnationDays: number
  escalation24h: boolean
  escalation48h: boolean
  escalation72h: boolean
}

function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.border}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.onSurface }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div
        onClick={() => onChange(!on)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 8,
          background: on ? T.primary : T.surfaceHigh,
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: 8,
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </div>
    </div>
  )
}

export default function SettingsClient(initial: Props) {
  const [workspaceName, setWorkspaceName] = useState(initial.workspaceName)
  const [timezone, setTimezone] = useState(initial.timezone)
  const [absenceWarningDays, setAbsenceWarningDays] = useState(initial.absenceWarningDays)
  const [absenceCriticalDays, setAbsenceCriticalDays] = useState(initial.absenceCriticalDays)
  const [weightStagnationDays, setWeightStagnationDays] = useState(initial.weightStagnationDays)
  const [escalation24h, setEscalation24h] = useState(initial.escalation24h)
  const [escalation48h, setEscalation48h] = useState(initial.escalation48h)
  const [escalation72h, setEscalation72h] = useState(initial.escalation72h)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError('Session expired. Refresh and try again.')
      return
    }

    const { error: updateError } = await supabase
      .from('coaches')
      .update({
        workspace_name: workspaceName,
        timezone,
        settings: {
          absence_warning_days: absenceWarningDays,
          absence_critical_days: absenceCriticalDays,
          weight_stagnation_days: weightStagnationDays,
          escalation_24h: escalation24h,
          escalation_48h: escalation48h,
          escalation_72h: escalation72h,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page-pad" style={{ maxWidth: 560 }}>
      <form onSubmit={handleSave}>
        <Card style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: T.onSurface }}>Account</h2>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Full name</FieldLabel>
            <input type="text" value={initial.coachName} readOnly style={{ ...inputStyle, color: T.muted, cursor: 'not-allowed' }} />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input type="email" value={initial.coachEmail} readOnly style={{ ...inputStyle, color: T.muted, cursor: 'not-allowed' }} />
            <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Your name and sign-in email. Contact support to change these.</p>
          </div>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: T.onSurface }}>Workspace</h2>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Workspace name</FieldLabel>
            <input type="text" required minLength={2} maxLength={50} value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <FieldLabel>Timezone</FieldLabel>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle}>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: T.onSurface }}>
            Flash Card &amp; Absence Thresholds
          </h2>
          <div className="grid-stats" style={{ marginBottom: 4 }}>
            <div>
              <FieldLabel>Warning (days)</FieldLabel>
              <input
                type="number"
                min={1}
                required
                value={absenceWarningDays}
                onChange={e => setAbsenceWarningDays(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Critical (days)</FieldLabel>
              <input
                type="number"
                min={1}
                required
                value={absenceCriticalDays}
                onChange={e => setAbsenceCriticalDays(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Stagnation (days)</FieldLabel>
              <input
                type="number"
                min={1}
                required
                value={weightStagnationDays}
                onChange={e => setWeightStagnationDays(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
            Controls flash card status: yellow after Warning days with no check-in, red after Critical days. Weight stagnation
            flags unchanged weight over the stagnation window.
          </p>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: T.onSurface }}>Escalation</h2>
          <Toggle on={escalation24h} onChange={setEscalation24h} label="24h escalation" sub="Notify on first missed check-in" />
          <Toggle on={escalation48h} onChange={setEscalation48h} label="48h escalation" sub="Notify on second missed check-in" />
          <Toggle on={escalation72h} onChange={setEscalation72h} label="72h escalation" sub="Urgent — third missed check-in" />
        </Card>

        {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Btn type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </Btn>
          {saved && <span style={{ fontSize: 13, color: T.success, fontWeight: 600 }}>Saved</span>}
        </div>
      </form>
    </div>
  )
}
