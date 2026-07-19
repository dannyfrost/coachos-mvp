import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@coaching/supabase/server'
import { createAnonServerClient } from '@coaching/supabase/auth-server'

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    const rawToken = (body as Record<string, unknown>)?.token
    const rawPassword = (body as Record<string, unknown>)?.password

    if (rawToken === undefined || rawToken === null || typeof rawToken !== 'string' ||
        rawPassword === undefined || rawPassword === null || typeof rawPassword !== 'string') {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    const token = rawToken.trim()
    const password = rawPassword

    if (token.length === 0) {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')

    const serviceClient = createServiceRoleClient()

    // Token lookup
    const { data: clientRow, error: clientLookupError } = await serviceClient
      .from('clients')
      .select('id, activation_expires_at')
      .eq('activation_token_hash', tokenHash)
      .single()

    if (clientLookupError || !clientRow) {
      return NextResponse.json({ error: 'Invalid or expired activation token' }, { status: 401 })
    }

    // Expiry check
    const expiresAt = clientRow.activation_expires_at
    if (!expiresAt || new Date(expiresAt) <= new Date()) {
      return NextResponse.json({ error: 'Invalid or expired activation token' }, { status: 401 })
    }

    const clientId = clientRow.id

    // Fetch platform_users for status + email
    const { data: platformUser, error: puError } = await serviceClient
      .from('platform_users')
      .select('id, email, status')
      .eq('id', clientId)
      .single()

    if (puError || !platformUser) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Already-activated guard
    if (platformUser.status === 'active') {
      return NextResponse.json({ error: 'Already activated' }, { status: 409 })
    }
    if (platformUser.status === 'suspended' || platformUser.status === 'banned' || platformUser.status === 'deactivated') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'pending') {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 1: Set password
    const { error: passwordError } = await serviceClient.auth.admin.updateUserById(clientId, { password })
    if (passwordError) {
      const msg = passwordError.message ?? ''
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('weak')) {
        return NextResponse.json({ error: 'Password not accepted' }, { status: 422 })
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 2: Activate platform_users.status
    const { error: statusError } = await serviceClient
      .from('platform_users')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', clientId)
    if (statusError) {
      console.error('PARTIAL ACTIVATION — auth password set but platform_users.status not updated: ' + clientId)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 3: Clear token fields
    const { error: clearError } = await serviceClient
      .from('clients')
      .update({ activation_token_hash: null, activation_expires_at: null })
      .eq('id', clientId)
    if (clearError) {
      console.error('PARTIAL ACTIVATION — status active but token not cleared: ' + clientId)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Step 4: Sign in
    const anonClient = createAnonServerClient()
    const { data: sessionData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: platformUser.email,
      password,
    })
    if (signInError || !sessionData.session) {
      console.error('ACTIVATION COMPLETE BUT SIGN-IN FAILED: ' + clientId)
      return NextResponse.json({ error: 'Activation completed but sign-in failed' }, { status: 500 })
    }

    return NextResponse.json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_in: sessionData.session.expires_in,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
