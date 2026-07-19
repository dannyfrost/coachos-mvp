'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, Btn, FieldLabel, inputStyle } from '../../lib/design-system'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          workspace_name: workspaceName,
          invite_code: inviteCode,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Signup failed. Please try again.')
        setLoading(false)
        return
      }

      const supabase = createSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        router.push('/login')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Signup failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: T.surface,
        fontFamily: font.body,
        padding: '2rem 0',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ width: 400, padding: '2.5rem', background: T.white, borderRadius: 16, boxShadow: shadow.float }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: T.primary,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          CoachOS
        </div>
        <h1 style={{ margin: '0 0 1.5rem', fontFamily: font.heading, fontWeight: 800, fontSize: 22, color: T.onSurface }}>
          Create your coach account
        </h1>
        {error && (
          <div
            style={{
              background: T.redBg,
              color: T.red,
              padding: '0.75rem',
              borderRadius: 8,
              marginBottom: '1rem',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <FieldLabel>Full name</FieldLabel>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <FieldLabel>Workspace name</FieldLabel>
          <input
            type="text"
            value={workspaceName}
            onChange={e => setWorkspaceName(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <FieldLabel>Password</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1.75rem' }}>
          <FieldLabel>Invitation code</FieldLabel>
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <Btn type="submit" full disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Btn>
      </form>
    </div>
  )
}
