'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'
import { T, shadow, font, Btn, FieldLabel, inputStyle } from '../../lib/design-system'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('Invalid email or password.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Invalid email or password.')
    } finally {
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
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ width: 380, padding: '2.5rem', background: T.white, borderRadius: 16, boxShadow: shadow.float }}
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
          Sign in
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
        <div style={{ marginBottom: '1.75rem' }}>
          <FieldLabel>Password</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </div>
        <Btn type="submit" full disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Btn>
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: T.muted }}>
          New coach?{' '}
          <a href="/signup" style={{ color: T.primary, fontWeight: 600, textDecoration: 'none' }}>
            Create an account
          </a>
        </div>
      </form>
    </div>
  )
}
