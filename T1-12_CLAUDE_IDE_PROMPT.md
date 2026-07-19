# T1-12 — Coach Client List Screen (/clients)
## Claude IDE Implementation Prompt

---

## Pre-flight

```bash
git status
git log --oneline -5
```

Expected: clean working tree, latest commit is the T1-11 commit (dashboard + login).

---

## Context

You are continuing the Coaching Platform MVP. T1-11 is complete: `/login` and `/dashboard` are built with `@supabase/ssr` cookie-based auth, `middleware.ts` protects the `(coach)` route group, and `packages/supabase/browser.ts` + `packages/supabase/ssr-server.ts` are already in place.

This task builds the Coach Client List screen at `/clients`.

**Architecture:**
- `(coach)` route group at `apps/web/app/(coach)/` — already exists with `layout.tsx`
- Server components call `createSupabaseServerClient` from `packages/supabase/ssr-server.ts`
- Client components use `createSupabaseBrowserClient` from `packages/supabase/browser.ts`
- Existing API routes use `Authorization: Bearer <token>` header — browser client retrieves token via `createSupabaseBrowserClient().auth.getSession()`
- All data queries use PostgREST via the Supabase client (Layer 1 reads); no new API routes

---

## Step 1 — Verify invite API contract (read-only)

Read `apps/web/app/api/clients/invite/route.ts`.

Confirm:
- Method: `POST`
- Auth: `Authorization: Bearer <token>` header
- Body: `{ email: string, full_name: string }`
- Success 201: `{ client_id: string, activation_token: string }`
- Error body shape: `{ error: string }`

If the contract does not match exactly, **stop and report the mismatch. Do not silently change the API route and do not invent a frontend contract.**

---

## Step 2 — Fix dead-code bug in DashboardClient.tsx

File: `apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx`

Find the flash status filter `<select>` element. Remove exactly this one line:

```tsx
<option value="paused">Paused</option>
```

The `flash_status` enum is `"green" | "yellow" | "red"` only — `"paused"` does not exist and can never match real data.

Do not change any other line in this file.

---

## Step 3 — Create loading skeleton

**File:** `apps/web/app/(coach)/clients/loading.tsx`

```tsx
export default function ClientsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 w-full bg-gray-200 rounded animate-pulse" />
      ))}
    </div>
  );
}
```

---

## Step 4 — Create ClientsClient component

**File:** `apps/web/app/(coach)/clients/_components/ClientsClient.tsx`

```tsx
'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@coaching/supabase/browser';

// ── Types ──────────────────────────────────────────────────────────────────

type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated';
type FlashStatus = 'green' | 'yellow' | 'red';
type SubStatus = 'active' | 'expired' | 'overdue';

export interface ClientRow {
  id: string;
  onboarding_completed: boolean;
  created_at: string;
  platform_users: {
    full_name: string;
    email: string;
    status: UserStatus;
  } | null;
  flash?: {
    status: FlashStatus;
    last_log_at: string | null;
    computed_at: string | null;
  };
  subscription?: {
    status: SubStatus;
    end_date: string | null;
    start_date: string | null;
  };
  expiringSoon?: boolean;
}

// ── Helper formatters ──────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function flashBadge(status: FlashStatus | undefined) {
  if (!status) return <span className="text-gray-400">—</span>;
  const map: Record<FlashStatus, string> = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function statusBadge(status: UserStatus | undefined) {
  if (!status) return <span className="text-gray-400">—</span>;
  const map: Record<UserStatus, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-800',
    banned: 'bg-red-200 text-red-900',
    deactivated: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

// ── Invite Modal ───────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setError('Session expired. Please refresh and try again.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/clients/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, full_name: fullName }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.');
        setLoading(false);
        return;
      }

      setActivationToken(json.activation_token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!activationToken) return;
    await navigator.clipboard.writeText(activationToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invite Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {activationToken ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Client invited successfully. Share this activation token with them:
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={activationToken}
                className="flex-1 font-mono text-sm border border-gray-300 rounded px-3 py-2 bg-gray-50"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-700"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="jane@example.com"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type SortKey = 'name' | 'last_log' | 'subscription';

interface Props {
  clients: ClientRow[];
}

export default function ClientsClient({ clients }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [flashFilter, setFlashFilter] = useState<FlashStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [showModal, setShowModal] = useState(false);

  const filtered = clients
    .filter((c) => {
      const pu = c.platform_users;
      if (!pu) return false;
      if (statusFilter !== 'all' && pu.status !== statusFilter) return false;
      if (flashFilter !== 'all' && c.flash?.status !== flashFilter) return false;
      const q = search.toLowerCase();
      if (q && !pu.full_name.toLowerCase().includes(q) && !pu.email.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'name') {
        return (a.platform_users?.full_name ?? '').localeCompare(b.platform_users?.full_name ?? '');
      }
      if (sortKey === 'last_log') {
        const aT = a.flash?.last_log_at ?? '';
        const bT = b.flash?.last_log_at ?? '';
        return bT.localeCompare(aT);
      }
      if (sortKey === 'subscription') {
        return (a.subscription?.status ?? 'z').localeCompare(b.subscription?.status ?? 'z');
      }
      return 0;
    });

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          Invite Client
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[180px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="paused">Paused</option>
        </select>
        <select
          value={flashFilter}
          onChange={(e) => setFlashFilter(e.target.value as FlashStatus | 'all')}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="all">All flash</option>
          <option value="green">Green</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="name">Sort: Name</option>
          <option value="last_log">Sort: Last Log</option>
          <option value="subscription">Sort: Subscription</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No clients match the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Flash</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Last Log</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Subscription</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map((c) => {
                const pu = c.platform_users!;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{pu.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{pu.email}</td>
                    <td className="px-4 py-3">{statusBadge(pu.status)}</td>
                    <td className="px-4 py-3">{flashBadge(c.flash?.status)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(c.flash?.last_log_at)}</td>
                    <td className="px-4 py-3">
                      {c.subscription ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            c.subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                            c.subscription.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {c.subscription.status}
                          </span>
                          {c.expiringSoon && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              expiring soon
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/clients/${c.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Profile
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <InviteModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
```

---

## Step 5 — Create page.tsx (server component)

**File:** `apps/web/app/(coach)/clients/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server';
import ClientsClient, { ClientRow } from './_components/ClientsClient';

export default async function ClientsPage() {
  const cookieStore = cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch clients
  const { data: rawClients, error: clientsError } = await supabase
    .from('clients')
    .select('id, coach_id, onboarding_completed, created_at, platform_users(full_name, email, status)')
    .eq('coach_id', user.id);

  if (clientsError) {
    console.error('clients fetch error', clientsError);
    return <p className="p-6 text-red-600">Failed to load clients.</p>;
  }

  const clients = rawClients ?? [];
  const clientIds = clients.map((c) => c.id);

  // Parallel fetch subscriptions + flash cards
  const [subsResult, flashResult] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('client_subscriptions').select('*').in('client_id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length > 0
      ? supabase.from('flash_cards').select('id, client_id, status, last_log_at, computed_at').in('client_id', clientIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const allSubs = subsResult.data ?? [];
  const allFlash = flashResult.data ?? [];

  // Latest subscription per client (sort desc by start_date, take first per client)
  const sortedSubs = [...allSubs].sort((a, b) =>
    (b.start_date ?? '').localeCompare(a.start_date ?? '')
  );
  const subByClient = new Map<string, typeof sortedSubs[0]>();
  for (const sub of sortedSubs) {
    if (!subByClient.has(sub.client_id)) {
      subByClient.set(sub.client_id, sub);
    }
  }

  // Latest flash card per client
  const flashByClient = new Map<string, typeof allFlash[0]>();
  for (const fc of allFlash) {
    const existing = flashByClient.get(fc.client_id);
    if (!existing || (fc.computed_at ?? '') > (existing.computed_at ?? '')) {
      flashByClient.set(fc.client_id, fc);
    }
  }

  // Compute "expiring soon" threshold: today UTC + 7 days
  const today = new Date();
  const threshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Merge into ClientRow shape
  const merged: ClientRow[] = clients.map((c) => {
    const sub = subByClient.get(c.id);
    const fc = flashByClient.get(c.id);

    const expiringSoon =
      !!sub &&
      sub.status !== 'expired' &&
      sub.status !== 'overdue' &&
      !!sub.end_date &&
      sub.end_date <= threshold;

    return {
      id: c.id,
      onboarding_completed: c.onboarding_completed,
      created_at: c.created_at,
      platform_users: c.platform_users as ClientRow['platform_users'],
      flash: fc
        ? { status: fc.status as NonNullable<ClientRow['flash']>['status'], last_log_at: fc.last_log_at, computed_at: fc.computed_at }
        : undefined,
      subscription: sub
        ? { status: sub.status as NonNullable<ClientRow['subscription']>['status'], end_date: sub.end_date, start_date: sub.start_date }
        : undefined,
      expiringSoon,
    };
  });

  return <ClientsClient clients={merged} />;
}
```

---

## Step 6 — TypeScript check

```bash
pnpm --filter web exec tsc --noEmit
```

Zero errors required. If errors appear, fix them before proceeding. Common fixes:
- PostgREST returns nested join as array or single object depending on FK cardinality — add null/array guard or cast as needed
- If `createSupabaseServerClient` signature changed, check `packages/supabase/ssr-server.ts` and align the call

**Do not modify `packages/supabase/database.types.ts` or any migration file.**

---

## Step 7 — Build

```bash
pnpm --filter web build
```

Must pass. Confirm `/clients` appears in the route table output. If build fails due to TypeScript errors, fix them. Do not skip or suppress errors.

---

## Step 8 — Lint

```bash
pnpm --filter web lint
```

Passes or fails only on `.eslintrc.json` missing — that is a known non-blocking issue. Any other lint errors must be fixed.

---

## Step 9 — Integration tests (conditional)

Only run if `apps/web/.env.local` exists:

```bash
test -f apps/web/.env.local && echo "EXISTS" || echo "SKIP"
```

If EXISTS, run smoke tests against local dev (`http://localhost:3000`):
1. Confirm `/clients` renders the client table (200 response, table element present)
2. Open invite modal — confirm form renders
3. Submit with missing email → expect validation error displayed in modal
4. Submit with duplicate email (a known existing email) → expect 409 error displayed in modal
5. Submit with valid new email + name → expect 201 and activation_token displayed

If SKIP, log: `Integration tests skipped — apps/web/.env.local not present (non-blocking, consistent with T1-07 through T1-11).`

**Never run integration tests against production.**

---

## Step 10 — Update control documents

### `PROJECT_STATE.md`
- Mark T1-12 complete under the task list
- Update "Latest completed task" to T1-12
- Update "Next task" to T1-13

### `TASK_LOG.md`
- Append T1-12 entry with: task ID, description (Client List screen /clients), files created/modified, commit hash, date, result (PASS/FAIL), deviations (if any)

### `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md`
- Update "Last completed" to T1-12 — Coach Client List (/clients)
- Update "Next task" to T1-13
- Add any deviations or schema findings discovered during T1-12

---

## Step 11 — Commit

Stage exactly these files (use quoted paths to handle the `(coach)` directory):

```bash
git add "apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx"
git add "apps/web/app/(coach)/clients/loading.tsx"
git add "apps/web/app/(coach)/clients/_components/ClientsClient.tsx"
git add "apps/web/app/(coach)/clients/page.tsx"
git add PROJECT_STATE.md TASK_LOG.md docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md
```

Then commit:

```bash
git commit -m "feat(web): add /clients coach client list screen with invite modal (T1-12)"
```

Confirm commit hash and report it.

---

## Acceptance Criteria

- [ ] `pnpm --filter web exec tsc --noEmit` → zero errors
- [ ] `pnpm --filter web build` → passes; `/clients` in route table
- [ ] `pnpm --filter web lint` → passes (or only the known `.eslintrc.json` non-blocking failure)
- [ ] `/clients` renders: table with Name, Email, Status, Flash, Last Log, Subscription, Actions columns
- [ ] Search filters by name or email (client-side)
- [ ] Status filter works (all/active/pending/paused)
- [ ] Flash filter works (all/green/yellow/red)
- [ ] Sort works (name, last log, subscription)
- [ ] "Expiring soon" yellow badge shown when `end_date <= today + 7 days` and sub not expired/overdue
- [ ] "Invite Client" button opens inline modal
- [ ] Modal calls `POST /api/clients/invite` with `Authorization: Bearer <token>` header and `{ email, full_name }` body
- [ ] On 201: modal shows activation_token in read-only field with copy button; no navigation away
- [ ] On error: modal shows `error.error` string, stays open
- [ ] "View Profile" links to `/clients/[id]` (link only — page not built yet)
- [ ] `<option value="paused">` removed from DashboardClient.tsx flash filter
- [ ] No new API routes created
- [ ] No migrations, RLS policies, or `database.types.ts` modified
- [ ] Control docs updated (PROJECT_STATE.md, TASK_LOG.md, CLAUDE_IDE_CONTEXT_HANDOFF.md)
- [ ] Commit created with all modified files staged

---

## Files to Modify

| File | Action |
|------|--------|
| `apps/web/app/(coach)/dashboard/_components/DashboardClient.tsx` | Remove 1 line (`<option value="paused">`) |
| `apps/web/app/(coach)/clients/loading.tsx` | **Create** |
| `apps/web/app/(coach)/clients/_components/ClientsClient.tsx` | **Create** |
| `apps/web/app/(coach)/clients/page.tsx` | **Create** |
| `PROJECT_STATE.md` | Update |
| `TASK_LOG.md` | Append |
| `docs/continuity/CLAUDE_IDE_CONTEXT_HANDOFF.md` | Update |

## Files Explicitly NOT to Modify

- `supabase/migrations/*`
- RLS policies
- `packages/supabase/database.types.ts`
- `packages/supabase/client.ts`
- `packages/supabase/server.ts`
- `packages/supabase/ssr-server.ts`
- `packages/supabase/browser.ts`
- `apps/web/app/api/**` (all existing API routes)
- `apps/web/app/(coach)/dashboard/page.tsx`
- `apps/web/app/(coach)/layout.tsx`
- `apps/web/middleware.ts`
- `apps/mobile/**`
