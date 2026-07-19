# T1-11 Claude IDE Implementation Prompt
# Coach Dashboard (/dashboard) + Login Page (/login)

**Task:** T1-11 — Coach Dashboard + Login Page
**Date:** 2026-05-24
**Status:** Ready for implementation — all decisions locked in DECISIONS.md (D-T1-11-01 through D-T1-11-20)

---

## Files to create

- `packages/supabase/browser.ts`
- `packages/supabase/ssr-server.ts`
- `apps/web/middleware.ts`
- `apps/web/app/login/page.tsx`
- `apps/web/app/(coach)/layout.tsx`
- `apps/web/app/(coach)/dashboard/page.tsx`
- `apps/web/app/(coach)/dashboard/loading.tsx`
- `apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx`
- `apps/web/app/(coach)/dashboard/_components/FlashCard.tsx`

## Files to modify

- `packages/supabase/package.json` — add `./browser` and `./ssr-server` exports (pnpm step adds `@supabase/ssr` dep automatically)
- `apps/web/package.json` — `@supabase/ssr` added by pnpm step

## Files explicitly NOT to modify

- Any migration file (`supabase/migrations/`)
- Any RLS policy file
- `packages/supabase/database.types.ts`
- `packages/supabase/client.ts`
- `packages/supabase/auth-server.ts`
- `packages/supabase/server.ts`
- Any existing file under `apps/web/app/api/`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `DECISIONS.md` — already updated by Claude CMD
- `PROJECT_STATE.md`, `TASK_LOG.md`, `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md` — update in Step 12 only

---

## Acceptance criteria

1. `pnpm build` passes — `/login` and `/dashboard` appear in route table output
2. TypeScript: zero errors
3. Lint: passes or fails only due to missing `.eslintrc.json` (known non-blocking)
4. `packages/supabase/package.json` exports `./browser` and `./ssr-server`; `@supabase/ssr` in dependencies
5. `apps/web/package.json` has `@supabase/ssr` in dependencies
6. `GET /dashboard` with no session cookie → 307 redirect to `/login`
7. `GET /login` with valid session cookie → 307 redirect to `/dashboard`
8. `GET /login` with no session → 200, login form renders
9. Login with wrong credentials → error message "Invalid email or password."
10. Login with valid coach credentials → redirect to `/dashboard`, dashboard renders with flash cards
11. Dashboard: flash cards sorted by severity (red → yellow → green → paused → no-card); secondary sort `last_log_at DESC NULLS LAST`
12. Dashboard: summary stats show active client count and missing check-ins today
13. Dashboard: status filter reduces flash card grid to matching status
14. Dashboard: name search filters cards by client name
15. Refresh button on a flash card calls `refresh_flash_card({ p_client_id })` RPC and updates card in-place without page reload

---

## Pre-flight

```bash
git --no-pager status --short
git --no-pager log --oneline -5
```

Expected: clean working tree. Latest commit is T1-10 (`feat(api): add POST /api/storage/signed-download-url signed download URL route`) or later.

---

## Step 0 — Install @supabase/ssr

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
cd /e/Claude-project-Coaching-app-MVP
pnpm add @supabase/ssr --filter @coaching/supabase
pnpm add @supabase/ssr --filter web
```

Expected: both `packages/supabase/package.json` and `apps/web/package.json` now list `@supabase/ssr` in `dependencies`. Stop if either command fails.

---

## Step 1 — Update packages/supabase/package.json exports

After Step 0, `packages/supabase/package.json` already has the `@supabase/ssr` dependency line added by pnpm. Only the `exports` object needs to be updated. Keep the `@supabase/ssr` version exactly as pnpm wrote it.

**File:** `packages/supabase/package.json` — replace the `exports` object only:

```json
{
  "name": "@coaching/supabase",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./client": "./client.ts",
    "./server": "./server.ts",
    "./auth-server": "./auth-server.ts",
    "./browser": "./browser.ts",
    "./ssr-server": "./ssr-server.ts"
  }
}
```

The `dependencies` and `devDependencies` blocks are unchanged from what pnpm wrote — do not overwrite them.

---

## Step 2 — Create Supabase utility files

### 2a. packages/supabase/browser.ts

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 2b. packages/supabase/ssr-server.ts

```typescript
// Server-only. Do not import from client components.
import { createServerClient } from '@supabase/ssr'
import type { Database } from './database.types'

type CookieAdapter = {
  getAll(): { name: string; value: string }[]
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void
}

export function createSupabaseServerClient(cookieAdapter: CookieAdapter) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter }
  )
}
```

---

## Step 3 — Create middleware

**File:** `apps/web/middleware.ts`

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createSupabaseServerClient({
    getAll() {
      return request.cookies.getAll()
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
      supabaseResponse = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(
          name,
          value,
          options as Parameters<typeof supabaseResponse.cookies.set>[2]
        )
      )
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login'],
}
```

---

## Step 4 — Create login page

**File:** `apps/web/app/login/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'

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
        fontFamily: 'sans-serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ width: 360, padding: '2rem', border: '1px solid #dee2e6', borderRadius: 8 }}
      >
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Sign in</h1>
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
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
        />
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1.5rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
```

---

## Step 5 — Create coach route group layout and loading

Create the directory `apps/web/app/(coach)/` — the route group name is excluded from the URL so `/dashboard` resolves from `(coach)/dashboard/page.tsx`.

### 5a. apps/web/app/(coach)/layout.tsx

Belt-and-suspenders server-side auth check. Middleware handles most cases; layout is insurance for cases where middleware misses.

```typescript
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll() {},
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <>{children}</>
}
```

### 5b. apps/web/app/(coach)/dashboard/loading.tsx

```typescript
export default function DashboardLoading() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#6c757d' }}>Loading dashboard...</p>
    </div>
  )
}
```

---

## Step 6 — Create dashboard components

### 6a. apps/web/app/(coach)/dashboard/_components/FlashCard.tsx

RPC parameter confirmed from `packages/supabase/database.types.ts`:
`refresh_flash_card Args: { p_client_id: string }`

```typescript
'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'

type FlashCardData = {
  id: string
  client_id: string
  status: string
  reason: string | null
  food_summary: string | null
  interpretation: string | null
  notes: string | null
  last_log_at: string | null
  computed_at: string
}

const STATUS_COLORS: Record<string, string> = {
  red: '#dc3545',
  yellow: '#ffc107',
  green: '#28a745',
  paused: '#6c757d',
}

const NOTES_MAX = 120

export default function FlashCard({
  card: initialCard,
  clientName,
  onRefresh,
}: {
  card: FlashCardData
  clientName: string
  onRefresh: (card: FlashCardData) => void
}) {
  const [card, setCard] = useState(initialCard)
  const [loading, setLoading] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const isStale =
    new Date(card.computed_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)
  const statusColor = STATUS_COLORS[card.status] ?? '#6c757d'
  const truncatedNotes =
    card.notes && card.notes.length > NOTES_MAX
      ? card.notes.slice(0, NOTES_MAX) + '...'
      : card.notes

  async function handleRefresh() {
    setLoading(true)
    setRefreshError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error: rpcError } = await supabase.rpc('refresh_flash_card', {
        p_client_id: card.client_id,
      })
      if (rpcError || !data || (data as FlashCardData[]).length === 0) {
        setRefreshError('Refresh failed.')
      } else {
        const updated = (data as FlashCardData[])[0]
        setCard(updated)
        onRefresh(updated)
      }
    } catch {
      setRefreshError('Refresh failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: `2px solid ${statusColor}`,
        borderRadius: 8,
        padding: '1rem',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{clientName}</strong>
        <span
          style={{
            background: statusColor,
            color: card.status === 'yellow' ? '#000' : '#fff',
            padding: '0.2rem 0.6rem',
            borderRadius: 12,
            fontSize: '0.8rem',
            textTransform: 'uppercase',
          }}
        >
          {card.status}
        </span>
      </div>

      {isStale && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#856404',
            background: '#fff3cd',
            padding: '0.25rem 0.5rem',
            borderRadius: 4,
          }}
        >
          Stale — computed &gt;24h ago
        </div>
      )}

      {card.reason && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>
          <strong>Reason:</strong> {card.reason}
        </p>
      )}
      {card.food_summary && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6c757d' }}>{card.food_summary}</p>
      )}
      {card.interpretation && (
        <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#495057' }}>
          {card.interpretation}
        </p>
      )}
      {truncatedNotes && (
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6c757d',
            borderTop: '1px solid #e9ecef',
            paddingTop: '0.25rem',
          }}
        >
          <strong>Notes:</strong> {truncatedNotes}
        </p>
      )}
      {card.last_log_at && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#adb5bd' }}>
          Last log: {new Date(card.last_log_at).toLocaleString()}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem', gap: '0.5rem' }}>
        <a
          href={`/clients/${card.client_id}`}
          style={{ fontSize: '0.85rem', color: '#0d6efd', textDecoration: 'none' }}
        >
          Open Profile
        </a>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '0.25rem 0.75rem',
            fontSize: '0.85rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: '#0d6efd',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {refreshError && (
        <p style={{ color: '#dc3545', fontSize: '0.8rem', margin: 0 }}>{refreshError}</p>
      )}
    </div>
  )
}
```

### 6b. apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx

```typescript
'use client'

import { useState, useMemo } from 'react'
import FlashCard from './FlashCard'

type FlashCardData = {
  id: string
  client_id: string
  status: string
  reason: string | null
  food_summary: string | null
  interpretation: string | null
  notes: string | null
  last_log_at: string | null
  computed_at: string
}

type ClientData = {
  id: string
  status: string
  first_name: string | null
  last_name: string | null
}

type SubscriptionData = {
  plan_type: string
  trial_ends_at: string | null
  current_period_end: string | null
  status: string
} | null

type Props = {
  flashCards: FlashCardData[]
  clients: ClientData[]
  missingCheckIns: number
  subscription: SubscriptionData
}

const SEVERITY_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, paused: 3 }

export default function DashboardClient({
  flashCards: initialCards,
  clients,
  missingCheckIns,
  subscription,
}: Props) {
  const [cards, setCards] = useState<FlashCardData[]>(initialCards)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const clientMap = useMemo(() => {
    const map = new Map<string, ClientData>()
    clients.forEach(c => map.set(c.id, c))
    return map
  }, [clients])

  const activeCount = useMemo(
    () => clients.filter(c => c.status === 'active').length,
    [clients]
  )

  const stats = useMemo(
    () => ({
      red: cards.filter(c => c.status === 'red').length,
      yellow: cards.filter(c => c.status === 'yellow').length,
      green: cards.filter(c => c.status === 'green').length,
    }),
    [cards]
  )

  const sortedAndFiltered = useMemo(() => {
    let filtered = cards

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    if (search.trim()) {
      const term = search.toLowerCase()
      filtered = filtered.filter(c => {
        const client = clientMap.get(c.client_id)
        if (!client) return false
        const name = `${client.first_name ?? ''} ${client.last_name ?? ''}`.toLowerCase()
        return name.includes(term)
      })
    }

    return [...filtered].sort((a, b) => {
      const aOrder = SEVERITY_ORDER[a.status] ?? 4
      const bOrder = SEVERITY_ORDER[b.status] ?? 4
      if (aOrder !== bOrder) return aOrder - bOrder
      if (!a.last_log_at && !b.last_log_at) return 0
      if (!a.last_log_at) return 1
      if (!b.last_log_at) return -1
      return new Date(b.last_log_at).getTime() - new Date(a.last_log_at).getTime()
    })
  }, [cards, statusFilter, search, clientMap])

  function handleRefresh(updated: FlashCardData) {
    setCards(prev => prev.map(c => (c.id === updated.id ? updated : c)))
  }

  const isTrial = subscription?.plan_type === 'trial' && !!subscription.trial_ends_at

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      {isTrial && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
          }}
        >
          Trial active — ends{' '}
          {new Date(subscription!.trial_ends_at!).toLocaleDateString()}
        </div>
      )}

      <h1 style={{ marginBottom: '1rem' }}>Coach Dashboard</h1>

      <div
        style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
      >
        <StatCard label="Active Clients" value={activeCount} />
        <StatCard label="Missing Check-ins Today" value={missingCheckIns} />
        <StatCard label="Red" value={stats.red} color="#dc3545" />
        <StatCard label="Yellow" value={stats.yellow} color="#856404" />
        <StatCard label="Green" value={stats.green} color="#28a745" />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by client name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            flex: 1,
          }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        >
          <option value="all">All statuses</option>
          <option value="red">Red</option>
          <option value="yellow">Yellow</option>
          <option value="green">Green</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {sortedAndFiltered.length === 0 ? (
        <p style={{ color: '#6c757d' }}>No clients match your filter.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}
        >
          {sortedAndFiltered.map(card => {
            const client = clientMap.get(card.client_id)
            const clientName = client
              ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Unknown'
              : 'Unknown'
            return (
              <FlashCard
                key={card.id}
                card={card}
                clientName={clientName}
                onRefresh={handleRefresh}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div
      style={{
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: color ?? '#212529' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{label}</div>
    </div>
  )
}
```

---

## Step 7 — Create dashboard page (server component)

**File:** `apps/web/app/(coach)/dashboard/page.tsx`

Data notes:
- `flash_cards` RLS scopes to coach's clients via `coach_id = auth.uid()` — no additional filter needed
- `clients` join uses `platform_users(first_name, last_name)` — FK is `clients.id → platform_users.id`
- `daily_logs` RLS scopes to coach's clients — filter by today's date for missing check-in count
- `coach_subscriptions` filtered by `coach_id` — returns one row or null

```typescript
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server'
import DashboardClient from './_components/DashboardClient'

type FlashCardData = {
  id: string
  client_id: string
  status: string
  reason: string | null
  food_summary: string | null
  interpretation: string | null
  notes: string | null
  last_log_at: string | null
  computed_at: string
}

type ClientData = {
  id: string
  status: string
  first_name: string | null
  last_name: string | null
}

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll() {},
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('id, role_type, status')
    .eq('id', user.id)
    .single()

  if (
    !platformUser ||
    platformUser.status !== 'active' ||
    platformUser.role_type !== 'coach'
  ) {
    redirect('/login')
  }

  const today = new Date().toISOString().slice(0, 10)

  const [flashCardsRes, clientsRes, dailyLogsRes, subscriptionRes] = await Promise.all([
    supabase
      .from('flash_cards')
      .select(
        'id, client_id, status, reason, food_summary, interpretation, notes, last_log_at, computed_at'
      ),
    supabase
      .from('clients')
      .select('id, status, platform_users(first_name, last_name)')
      .eq('coach_id', user.id),
    supabase.from('daily_logs').select('client_id').eq('log_date', today),
    supabase
      .from('coach_subscriptions')
      .select('plan_type, trial_ends_at, current_period_end, status')
      .eq('coach_id', user.id)
      .maybeSingle(),
  ])

  const flashCards: FlashCardData[] = (flashCardsRes.data ?? []).map(c => ({
    id: c.id,
    client_id: c.client_id,
    status: c.status as string,
    reason: c.reason ?? null,
    food_summary: c.food_summary ?? null,
    interpretation: c.interpretation ?? null,
    notes: c.notes ?? null,
    last_log_at: c.last_log_at ?? null,
    computed_at: c.computed_at,
  }))

  const clients: ClientData[] = (clientsRes.data ?? []).map(c => {
    const pu = c.platform_users as {
      first_name: string | null
      last_name: string | null
    } | null
    return {
      id: c.id,
      status: c.status as string,
      first_name: pu?.first_name ?? null,
      last_name: pu?.last_name ?? null,
    }
  })

  const todayLogClientIds = new Set((dailyLogsRes.data ?? []).map(l => l.client_id))
  const missingCheckIns = clients
    .filter(c => c.status === 'active')
    .filter(c => !todayLogClientIds.has(c.id)).length

  return (
    <DashboardClient
      flashCards={flashCards}
      clients={clients}
      missingCheckIns={missingCheckIns}
      subscription={subscriptionRes.data ?? null}
    />
  )
}
```

---

## Step 8 — TypeScript typecheck

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
cd /e/Claude-project-Coaching-app-MVP
pnpm --filter web exec tsc --noEmit 2>&1
```

Expected: zero errors. Stop and report any type errors before proceeding.

**Common fix:** if `platform_users` join causes a type error on `c.platform_users`, keep the `as { first_name: string | null; last_name: string | null } | null` cast in `page.tsx` — do not change the query shape.

---

## Step 9 — Build

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web build 2>&1
```

Expected: build completes, no errors. Confirm `/login` and `/dashboard` appear in the route table output. Stop and report any build errors before proceeding.

---

## Step 10 — Lint

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web lint 2>&1
```

Note: `next lint` may fail if `apps/web/.eslintrc.json` is missing (known non-blocking). If it fails for that reason only, note and continue. Stop on any other lint error.

---

## Step 11 — Integration tests (conditional)

**Only run if `apps/web/.env.local` exists.** If not, skip and note in the final report.

```bash
ls /e/Claude-project-Coaching-app-MVP/apps/web/.env.local 2>&1
```

If the file exists, start the dev server:

```bash
export PATH="/c/Users/reda-/AppData/Roaming/npm:$PATH"
pnpm --filter web dev &
sleep 5
```

**Test 1 — /dashboard with no cookie → 307 redirect**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
```
Expected: `307`

**Test 2 — /login renders (200)**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
```
Expected: `200`

**Test 3 — Login page contains sign-in heading**
```bash
curl -s http://localhost:3000/login | grep -c "Sign in"
```
Expected: `1` or more (heading renders in HTML)

After tests, stop the dev server:
```bash
kill %1 2>/dev/null || true
```

---

## Step 12 — Update control docs

### PROJECT_STATE.md
- Change `Current Task` from `T1-11` to `T1-12`
- Add to the completed table:
  ```
  | T1-11 | Coach Dashboard (/dashboard) + Login Page (/login) | COMPLETE (2026-05-24) |
  ```
- Update `State as of` date to `2026-05-24`

### TASK_LOG.md
Append:
```
## Session: 2026-05-24 — T1-11

Task: Coach Dashboard (/dashboard) + Login Page (/login)
Files created:
  packages/supabase/browser.ts
  packages/supabase/ssr-server.ts
  apps/web/middleware.ts
  apps/web/app/login/page.tsx
  apps/web/app/(coach)/layout.tsx
  apps/web/app/(coach)/dashboard/page.tsx
  apps/web/app/(coach)/dashboard/loading.tsx
  apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx
  apps/web/app/(coach)/dashboard/_components/FlashCard.tsx
Files modified:
  packages/supabase/package.json (./browser + ./ssr-server exports; @supabase/ssr dep)
  apps/web/package.json (@supabase/ssr dep)
TypeScript: passed
Build: passed — /login and /dashboard in route table
Lint: [passed / skipped reason]
Integration tests: [passed / skipped — .env.local missing]
Decisions locked: D-T1-11-01 through D-T1-11-20
Commit: [insert hash]
```

### docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
- Add `T1-11 COMPLETE` to the state summary line
- Update resume block: T1-00 through T1-11 COMPLETE, confirm before T1-12

---

## Step 13 — Commit

Paths with parentheses must be quoted in git add:

```bash
git add \
  packages/supabase/browser.ts \
  packages/supabase/ssr-server.ts \
  packages/supabase/package.json \
  apps/web/package.json \
  apps/web/middleware.ts \
  apps/web/app/login/page.tsx \
  "apps/web/app/(coach)/layout.tsx" \
  "apps/web/app/(coach)/dashboard/page.tsx" \
  "apps/web/app/(coach)/dashboard/loading.tsx" \
  "apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx" \
  "apps/web/app/(coach)/dashboard/_components/FlashCard.tsx" \
  PROJECT_STATE.md \
  TASK_LOG.md \
  docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

```bash
git commit -m "feat(web): add /login + /dashboard coach dashboard with @supabase/ssr session auth"
```

```bash
git push origin main
```

```bash
git --no-pager status --short
git --no-pager log --oneline -5
```

---

## Final report

Return:
1. TypeScript result (pass/fail)
2. Build result (pass/fail) — confirm `/login` and `/dashboard` in route table
3. Lint result (pass/fail/skipped reason)
4. Integration test result (each test: pass/fail/skipped + reason)
5. Commit hash
6. Any deviations from this prompt

**Hard constraints — never violate:**
- Do not modify migrations, RLS policies, `database.types.ts`, or any file outside the list above
- Do not modify `packages/supabase/auth-server.ts`, `client.ts`, or `server.ts`
- Do not modify any existing file under `apps/web/app/api/`
- Never use `supabase.auth.getSession()` — only `supabase.auth.getUser()` (D-T1-11-19 locked)
- Never expose the service role key to browser or client components
- Never write or overwrite `flash_cards.notes` under any condition (D-T1-09-11 locked)
- Integration tests target LOCAL DEV ONLY — never run against production
- No OAuth, no magic links — email + password only (D-T1-11-18 locked)
