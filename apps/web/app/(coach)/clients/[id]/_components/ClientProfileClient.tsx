'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@coaching/supabase/browser';

// ── Types ──────────────────────────────────────────────────────────────────

type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated';
type FlashStatus = 'green' | 'yellow' | 'red';
type SubStatus = 'active' | 'expired' | 'overdue';

type PlatformUserData = {
  full_name: string;
  email: string;
  status: string;
  created_at: string;
};

type SubscriptionData = {
  status: string;
  start_date: string | null;
  end_date: string | null;
} | null;

type FlashCardData = {
  id: string;
  status: string;
  last_log_at: string | null;
  computed_at: string | null;
  notes: string | null;
} | null;

type LogData = {
  id: string;
  log_date: string;
  steps: number | null;
  weight: number | null;
  meal_description: string | null;
  meal_photo_key: string | null;
  questions: string | null;
};

export type ClientProfileClientProps = {
  clientId: string;
  clientCreatedAt: string;
  onboardingCompleted: boolean;
  platformUser: PlatformUserData;
  subscription: SubscriptionData;
  flashCard: FlashCardData;
  logs: LogData[];
  photoUrlMap: Record<string, string>;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtLogDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function truncate(str: string | null, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function StatusBadge({ status }: { status: UserStatus }) {
  const map: Record<UserStatus, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-800',
    banned: 'bg-red-100 text-red-800',
    deactivated: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function SubBadge({ status }: { status: SubStatus }) {
  const map: Record<SubStatus, string> = {
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    overdue: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function FlashBadge({ status }: { status: FlashStatus }) {
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

// ── Main component ─────────────────────────────────────────────────────────

export default function ClientProfileClient({
  clientId,
  clientCreatedAt,
  platformUser,
  subscription,
  flashCard,
  logs,
  photoUrlMap,
}: ClientProfileClientProps) {
  const [displayStatus, setDisplayStatus] = useState<UserStatus>(
    platformUser.status as UserStatus,
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [notesValue, setNotesValue] = useState(flashCard?.notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  async function handlePause() {
    setActionLoading(true);
    setActionError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('pause_client', { p_client_id: clientId });
    setActionLoading(false);
    if (error) {
      setActionError('Could not pause client. Try again.');
    } else {
      setDisplayStatus('paused');
    }
  }

  async function handleUnpause() {
    setActionLoading(true);
    setActionError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('unpause_client', { p_client_id: clientId });
    setActionLoading(false);
    if (error) {
      setActionError('Could not unpause client. Try again.');
    } else {
      setDisplayStatus('active');
    }
  }

  async function handleSaveNotes() {
    if (!flashCard) return;
    setNotesSaving(true);
    setNotesSaved(false);
    setNotesError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('update_flash_card_notes', {
      p_card_id: flashCard.id,
      p_notes: notesValue,
    });
    setNotesSaving(false);
    if (error) {
      setNotesError('Could not save notes. Try again.');
    } else {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Section 1: Client header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{platformUser.full_name}</h1>
        <p className="text-sm text-gray-500">{platformUser.email}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusBadge status={displayStatus} />
          {subscription && (
            <SubBadge status={subscription.status as SubStatus} />
          )}
          <span className="text-xs text-gray-400">
            Member since {fmtDate(clientCreatedAt)}
          </span>
        </div>
      </div>

      {/* Section 2: Quick actions */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Quick Actions</h2>
        {displayStatus === 'active' && (
          <button
            onClick={handlePause}
            disabled={actionLoading}
            className="px-4 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            {actionLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin align-middle mr-1" />
            ) : null}
            Pause client
          </button>
        )}
        {displayStatus === 'paused' && (
          <button
            onClick={handleUnpause}
            disabled={actionLoading}
            className="px-4 py-2 text-sm bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
          >
            {actionLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin align-middle mr-1" />
            ) : null}
            Unpause client
          </button>
        )}
        {actionError && (
          <p className="text-sm text-red-600">{actionError}</p>
        )}
      </div>

      {/* Section 3: Flash card */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Flash Card</h2>
        {flashCard === null ? (
          <p className="text-sm text-gray-500">Flash card data not yet computed.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
              <FlashBadge status={flashCard.status as FlashStatus} />
              <span>Last log: {fmtDate(flashCard.last_log_at)}</span>
              <span>Computed: {fmtDate(flashCard.computed_at)}</span>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Notes</label>
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-y"
                placeholder="Add notes about this client…"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {notesSaving ? 'Saving…' : 'Save notes'}
                </button>
                {notesSaved && (
                  <span className="text-sm text-green-700 font-medium">Saved ✓</span>
                )}
                {notesError && (
                  <span className="text-sm text-red-600">{notesError}</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Section 4: Daily log timeline */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Daily Log Timeline</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No logs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Steps</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Weight</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Meal</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Photo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Questions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {logs.map((log) => {
                  const photoUrl = log.meal_photo_key
                    ? photoUrlMap[log.meal_photo_key]
                    : undefined;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {fmtLogDate(log.log_date)}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {log.steps ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {log.weight != null ? log.weight.toFixed(1) + ' kg' : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-[200px]">
                        {truncate(log.meal_description, 80)}
                      </td>
                      <td className="px-3 py-2">
                        {log.meal_photo_key ? (
                          photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoUrl}
                              alt="Meal photo"
                              width={60}
                              height={60}
                              className="object-cover rounded cursor-pointer"
                              style={{ width: 60, height: 60 }}
                              onClick={() => setLightboxUrl(photoUrl)}
                            />
                          ) : (
                            <div
                              className="bg-gray-100 rounded"
                              style={{ width: 60, height: 60 }}
                            />
                          )
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-[180px]">
                        {truncate(log.questions, 60)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl !== null && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Meal photo"
            className="max-h-screen max-w-screen-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setLightboxUrl(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
