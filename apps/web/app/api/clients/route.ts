import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient, createUserClient } from '@coaching/supabase/auth-server'

const FLASH_SEVERITY: Record<string, number> = { red: 0, yellow: 1, green: 2 }
const VALID_STATUSES = ['active', 'pending', 'paused', 'deactivated'] as const
type ClientStatus = typeof VALID_STATUSES[number]

export async function GET(req: NextRequest) {
  try {
    // 1. Extract and validate Bearer token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    // 2. Validate token with anon client
    const anonClient = createAnonServerClient()
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Create RLS-scoped DB client
    const db = createUserClient(token)

    // 4. Coach guard
    const { data: platformUser, error: puGuardError } = await db
      .from('platform_users')
      .select('id, role_type, status')
      .eq('id', user.id)
      .single()

    if (puGuardError || !platformUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (platformUser.role_type !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (platformUser.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 5. Parse optional ?status filter
    const { searchParams } = new URL(req.url)
    const rawStatus = searchParams.get('status')
    let statusFilter: ClientStatus | null = null
    if (rawStatus !== null) {
      if (!VALID_STATUSES.includes(rawStatus as ClientStatus)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
      }
      statusFilter = rawStatus as ClientStatus
    }

    // 6. Fetch clients (RLS enforces coach_id = auth.uid())
    const { data: clientRows, error: clientsError } = await db
      .from('clients')
      .select('id, onboarding_completed, created_at')
      .limit(500)

    if (clientsError) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const clientIds = (clientRows ?? []).map(c => c.id)

    if (clientIds.length === 0) {
      return NextResponse.json({ clients: [], total: 0 })
    }

    // 7. Parallel queries for all related data
    const [puResult, fcResult, csResult, csaResult] = await Promise.all([
      db.from('platform_users')
        .select('id, full_name, email, status')
        .in('id', clientIds),
      db.from('flash_cards')
        .select('client_id, status, reason, last_log_at')
        .in('client_id', clientIds),
      db.from('client_subscriptions')
        .select('client_id, status, end_date, created_at')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false }),
      db.from('client_staff_assignments')
        .select('client_id, staff_id')
        .in('client_id', clientIds),
    ])

    if (puResult.error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    if (csaResult.error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    // fcResult.error and csResult.error are non-fatal - data may not exist yet for new clients

    // 8. Fetch staff platform_users (only if assignments exist)
    const staffUserIds = [...new Set((csaResult.data ?? []).map(r => r.staff_id))]
    let staffPuData: Array<{ id: string; full_name: string; email: string }> = []
    if (staffUserIds.length > 0) {
      const { data: staffRows, error: staffError } = await db
        .from('platform_users')
        .select('id, full_name, email')
        .in('id', staffUserIds)
      if (staffError) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
      staffPuData = staffRows ?? []
    }

    // 9. Build lookup structures
    const puMap = new Map((puResult.data ?? []).map(pu => [pu.id, pu]))
    const fcMap = new Map((fcResult.data ?? []).map(fc => [fc.client_id, fc]))
    const staffMap = new Map(staffPuData.map(s => [s.id, s]))

    // Latest subscription per client (rows already ordered by created_at DESC)
    const subMap = new Map<string, { status: string; end_date: string | null }>()
    for (const sub of (csResult.data ?? [])) {
      if (!subMap.has(sub.client_id)) {
        subMap.set(sub.client_id, { status: String(sub.status), end_date: sub.end_date ?? null })
      }
    }

    // Staff IDs per client
    const csaMap = new Map<string, string[]>()
    for (const csa of (csaResult.data ?? [])) {
      const arr = csaMap.get(csa.client_id) ?? []
      arr.push(csa.staff_id)
      csaMap.set(csa.client_id, arr)
    }

    // 10. Assemble client list
    let clients = (clientRows ?? [])
      .map(client => {
        const pu = puMap.get(client.id)
        if (!pu) return null

        const fc = fcMap.get(client.id) ?? null
        const sub = subMap.get(client.id) ?? null
        const clientStaffIds = csaMap.get(client.id) ?? []
        const assignedStaff = clientStaffIds
          .map(sid => staffMap.get(sid))
          .filter((s): s is NonNullable<typeof s> => s !== undefined)
          .map(s => ({ id: s.id, full_name: s.full_name, email: s.email }))

        return {
          id: client.id,
          full_name: pu.full_name,
          email: pu.email,
          status: pu.status,
          onboarding_completed: client.onboarding_completed,
          created_at: client.created_at,
          flash_card: fc
            ? { status: String(fc.status), reason: fc.reason ?? null, last_log_at: fc.last_log_at ?? null }
            : null,
          subscription: sub,
          assigned_staff: assignedStaff,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    // 11. Apply optional status filter
    if (statusFilter) {
      clients = clients.filter(c => c.status === statusFilter)
    }

    // 12. Sort: flash severity ASC then full_name ASC
    clients.sort((a, b) => {
      const fa = a.flash_card ? (FLASH_SEVERITY[a.flash_card.status] ?? 3) : 3
      const fb = b.flash_card ? (FLASH_SEVERITY[b.flash_card.status] ?? 3) : 3
      if (fa !== fb) return fa - fb
      return a.full_name.localeCompare(b.full_name)
    })

    return NextResponse.json({ clients, total: clients.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
