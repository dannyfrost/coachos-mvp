import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server';
import ClientsClient, { ClientRow } from './_components/ClientsClient';

export default async function ClientsPage() {
  const cookieStore = cookies();
  const supabase = createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll() {},
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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

  const [subsResult, flashResult, staffResult] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('client_subscriptions').select('*').in('client_id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length > 0
      ? supabase.from('flash_cards').select('id, client_id, status, last_log_at, computed_at').in('client_id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length > 0
      ? supabase.from('client_staff_assignments').select('client_id, platform_users!client_staff_assignments_staff_id_fkey(full_name)').in('client_id', clientIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const allSubs = subsResult.data ?? [];
  const allFlash = flashResult.data ?? [];
  const allStaff = staffResult.data ?? [];

  const sortedSubs = [...allSubs].sort((a, b) =>
    (b.start_date ?? '').localeCompare(a.start_date ?? '')
  );
  const subByClient = new Map<string, typeof sortedSubs[0]>();
  for (const sub of sortedSubs) {
    if (!subByClient.has(sub.client_id)) {
      subByClient.set(sub.client_id, sub);
    }
  }

  const flashByClient = new Map<string, typeof allFlash[0]>();
  for (const fc of allFlash) {
    const existing = flashByClient.get(fc.client_id);
    if (!existing || (fc.computed_at ?? '') > (existing.computed_at ?? '')) {
      flashByClient.set(fc.client_id, fc);
    }
  }

  const staffByClient = new Map<string, string>();
  for (const sa of allStaff) {
    const staffName = (sa.platform_users as { full_name: string } | null)?.full_name;
    if (staffName && !staffByClient.has(sa.client_id)) {
      staffByClient.set(sa.client_id, staffName);
    }
  }

  const today = new Date();
  const threshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
      assistantName: staffByClient.get(c.id) ?? null,
    };
  });

  return <ClientsClient clients={merged} />;
}
