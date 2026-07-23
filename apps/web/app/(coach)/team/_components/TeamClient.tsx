'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, Card, Badge, Btn, FieldLabel, inputStyle } from '../../../../lib/design-system'

export type StaffRow = {
  id: string
  userId: string
  fullName: string
  email: string
  roleName: string
  status: 'active' | 'disabled'
  assignedTimezones: string[] | null
  assignedRegions: string[] | null
  assignedClients: { id: string; name: string }[]
}

export type ActiveClientOption = { id: string; full_name: string }

const ROLE_LABEL: Record<string, string> = {
  assistant: 'Assistant',
  senior_assistant: 'Senior Assistant',
  billing_operations: 'Billing Operations',
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleName, setRoleName] = useState('assistant')
  const [timezones, setTimezones] = useState('')
  const [regions, setRegions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      setLoading(false)
      setError('Session expired. Refresh and try again.')
      return
    }

    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email,
        full_name: fullName,
        role_name: roleName,
        assigned_timezones: timezones.trim() ? timezones.split(',').map(s => s.trim()) : null,
        assigned_regions: regions.trim() ? regions.split(',').map(s => s.trim()) : null,
      }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong.')
      return
    }
    setDone(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
      <div style={{ background: T.white, borderRadius: 14, boxShadow: shadow.float, width: '100%', maxWidth: 440, padding: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: T.onSurface }}>Invite Staff</h2>

        {done ? (
          <>
            <p style={{ fontSize: 13, color: T.success, marginBottom: 16 }}>
              Invite sent. They&apos;ll receive an email to set their password and join your workspace.
            </p>
            <Btn
              full
              variant="secondary"
              onClick={() => {
                onInvited()
                onClose()
              }}
            >
              Done
            </Btn>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Full Name</FieldLabel>
              <input type="text" required minLength={2} maxLength={100} value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Email</FieldLabel>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Role</FieldLabel>
              <select value={roleName} onChange={e => setRoleName(e.target.value)} style={inputStyle}>
                <option value="assistant">Assistant (assigned clients only)</option>
                <option value="senior_assistant">Senior Assistant (full team scope)</option>
                <option value="billing_operations">Billing Operations (no client data)</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Timezones (comma-separated, optional)</FieldLabel>
              <input type="text" value={timezones} onChange={e => setTimezones(e.target.value)} placeholder="America/New_York, Europe/London" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>Regions (comma-separated, optional)</FieldLabel>
              <input type="text" value={regions} onChange={e => setRegions(e.target.value)} placeholder="North America, EU" style={inputStyle} />
            </div>
            {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Sending…' : 'Send Invite'}
              </Btn>
              <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ManageClientsModal({
  staffMember,
  activeClients,
  onClose,
  onChanged,
}: {
  staffMember: StaffRow
  activeClients: ActiveClientOption[]
  onClose: () => void
  onChanged: () => void
}) {
  const [assignClientId, setAssignClientId] = useState(activeClients[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unassigned = activeClients.filter(c => !staffMember.assignedClients.some(ac => ac.id === c.id))

  async function handleAssign() {
    if (!assignClientId) return
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: rpcError } = await supabase.rpc('assign_staff_to_client', { p_staff_id: staffMember.userId, p_client_id: assignClientId })
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onChanged()
  }

  async function handleRemove(clientId: string) {
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: rpcError } = await supabase.rpc('remove_staff_from_client', { p_staff_id: staffMember.userId, p_client_id: clientId })
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onChanged()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
      <div style={{ background: T.white, borderRadius: 14, boxShadow: shadow.float, width: '100%', maxWidth: 420, padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: T.onSurface }}>Manage Clients</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: T.muted }}>{staffMember.fullName}</p>

        <div style={{ marginBottom: 16 }}>
          {staffMember.assignedClients.length === 0 ? (
            <p style={{ fontSize: 13, color: T.muted }}>No clients assigned.</p>
          ) : (
            staffMember.assignedClients.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontSize: 13, color: T.onSurface }}>{c.name}</span>
                <Btn small variant="danger" onClick={() => handleRemove(c.id)} disabled={loading}>
                  Remove
                </Btn>
              </div>
            ))
          )}
        </div>

        {unassigned.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={assignClientId} onChange={e => setAssignClientId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              {unassigned.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            <Btn small onClick={handleAssign} disabled={loading}>
              Add
            </Btn>
          </div>
        )}

        {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <Btn full variant="secondary" onClick={onClose}>
          Close
        </Btn>
      </div>
    </div>
  )
}

export default function TeamClient({ staff, activeClients }: { staff: StaffRow[]; activeClients: ActiveClientOption[] }) {
  const [showInvite, setShowInvite] = useState(false)
  const [manageStaff, setManageStaff] = useState<StaffRow | null>(null)
  const [statusLoading, setStatusLoading] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  function refresh() {
    window.location.reload()
  }

  async function handleToggleStatus(s: StaffRow) {
    setStatusLoading(s.id)
    setStatusError(null)
    const supabase = createSupabaseBrowserClient()
    const newStatus = s.status === 'active' ? 'disabled' : 'active'
    const { error } = await supabase.rpc('update_staff_status', { p_assignment_id: s.id, p_status: newStatus })
    setStatusLoading(null)
    if (error) {
      setStatusError(error.message)
      return
    }
    if (newStatus === 'disabled' && s.assignedClients.length > 0) {
      await supabase.rpc('reassign_staff_clients', { p_from_staff_id: s.userId })
    }
    refresh()
  }

  return (
    <div className="page-pad">
      <div style={{ display: 'flex', marginBottom: 20 }}>
        <Btn onClick={() => setShowInvite(true)} style={{ marginLeft: 'auto' }}>
          + Invite Staff
        </Btn>
      </div>

      {statusError && (
        <div style={{ background: T.redBg, color: T.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          {statusError}
        </div>
      )}

      {staff.length === 0 ? (
        <Card style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '40px 24px' }}>No team members yet.</Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
         <div className="table-scroll">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.3fr 90px 90px 1fr',
              minWidth: 560,
              padding: '10px 20px',
              background: T.surfaceLow,
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            {['Name', 'Role', 'Status', 'Clients', 'Actions'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {h}
              </span>
            ))}
          </div>
          {staff.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.3fr 90px 90px 1fr',
                minWidth: 560,
                padding: '13px 20px',
                borderBottom: i < staff.length - 1 ? `1px solid ${T.border}` : 'none',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: T.onSurface }}>{s.fullName}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{s.email}</div>
              </div>
              <span style={{ fontSize: 13, color: T.onSurfaceVar }}>{ROLE_LABEL[s.roleName] ?? s.roleName}</span>
              <Badge status={s.status === 'active' ? 'active' : 'deactivated'} small />
              <span style={{ fontSize: 13, color: T.onSurface }}>{s.assignedClients.length}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small variant="secondary" onClick={() => setManageStaff(s)}>
                  Clients
                </Btn>
                <Btn small variant={s.status === 'active' ? 'danger' : 'success'} onClick={() => handleToggleStatus(s)} disabled={statusLoading === s.id}>
                  {s.status === 'active' ? 'Disable' : 'Enable'}
                </Btn>
              </div>
            </div>
          ))}
         </div>
        </Card>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={refresh} />}
      {manageStaff && (
        <ManageClientsModal staffMember={manageStaff} activeClients={activeClients} onClose={() => setManageStaff(null)} onChanged={refresh} />
      )}
    </div>
  )
}
