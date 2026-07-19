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
  const [invited, setInvited] = useState<{ emailSent: boolean; warning?: string } | null>(null);

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

      setInvited({ emailSent: json.email_sent, warning: json.warning });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invite Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {invited ? (
          <div className="space-y-3">
            {invited.emailSent ? (
              <p className="text-sm text-gray-700">
                Client invited successfully. An activation email has been sent to them.
              </p>
            ) : (
              <p className="text-sm text-yellow-700">
                Client record was created, but the invite email could not be sent.
                Ask an admin to check email configuration before inviting real clients.
              </p>
            )}
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
          aria-label="Filter by status"
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
          aria-label="Filter by flash status"
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
          aria-label="Sort by"
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
