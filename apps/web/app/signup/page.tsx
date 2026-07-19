'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  marginBottom: '1rem',
  border: '1px solid #ccc',
  borderRadius: 4,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  fontSize: '0.9rem',
}

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
        fontFamily: 'sans-serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ width: 360, padding: '2rem', border: '1px solid #dee2e6', borderRadius: 8 }}
      >
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Create your coach account</h1>
        {error && (
          <div
            style={{
              background: '#f8d7da',
              border: '1px solid #f5c2c7',
              color: '#842029',
              padding: '0.75rem',
              borderRadius: 4,
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        <label style={labelStyle}>Full name</label>
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

        <label style={labelStyle}>Workspace name</label>
        <input
          type="text"
          value={workspaceName}
          onChange={e => setWorkspaceName(e.target.value)}
          required
          minLength={2}
          maxLength={50}
          style={inputStyle}
        />

        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={inputStyle}
        />

        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          style={inputStyle}
        />

        <label style={labelStyle}>Invitation code</label>
        <input
          type="text"
          value={inviteCode}
          onChange={e => setInviteCode(e.target.value)}
          required
          style={{ ...inputStyle, marginBottom: '1.5rem' }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.6rem',
            background: '#0d6efd',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
