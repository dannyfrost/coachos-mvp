import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@coaching/supabase/ssr-server';
import { createServiceRoleClient } from '@coaching/supabase/server';
import ClientProfileClient, { type ClientProfileClientProps } from './_components/ClientProfileClient';

export default async function ClientProfilePage({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const supabase = createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll() {},
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('id, coach_id, onboarding_completed, created_at, age, height_cm, condition_notes')
    .eq('id', params.id)
    .eq('coach_id', user.id)
    .single();

  if (clientError || !clientRow) redirect('/clients');

  const [
    { data: platformUser },
    { data: subscription },
    { data: flashCard },
    { data: logs },
    { data: planAssignments },
    { data: messages },
    { data: absenceEvents },
    { data: mealEntries },
  ] = await Promise.all([
    supabase
      .from('platform_users')
      .select('full_name, email, status, created_at')
      .eq('id', params.id)
      .single(),

    supabase
      .from('client_subscriptions')
      .select('status, start_date, end_date')
      .eq('client_id', params.id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('flash_cards')
      .select('id, status, last_log_at, computed_at, notes')
      .eq('client_id', params.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('daily_logs')
      .select('id, log_date, steps, weight, meal_description, meal_photo_key, questions, weight_photo_key')
      .eq('client_id', params.id)
      .order('log_date', { ascending: false })
      .limit(30),

    supabase
      .from('plan_assignments')
      .select('id, plan_type, status, assigned_at, plans!plan_assignments_plan_id_fkey(title)')
      .eq('client_id', params.id)
      .order('assigned_at', { ascending: false }),

    supabase
      .from('messages')
      .select('id, sender_id, content, read_at, created_at')
      .or(`sender_id.eq.${params.id},recipient_id.eq.${params.id}`)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('absence_events')
      .select('id, trigger_date, level, action_taken, created_at, resolved_at')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('meal_entries')
      .select('id, log_date, meal_type, description, photo_key')
      .eq('client_id', params.id)
      .order('log_date', { ascending: false })
      .limit(60),
  ]);

  if (!platformUser) redirect('/clients');

  const logPhotoKeys = (logs ?? []).map((l) => l.meal_photo_key);
  const weightPhotoKeys = (logs ?? []).map((l) => l.weight_photo_key);
  const mealPhotoKeys = (mealEntries ?? []).map((m) => m.photo_key);
  const photoKeys = [...logPhotoKeys, ...weightPhotoKeys, ...mealPhotoKeys].filter(
    (k): k is string => k !== null && k !== undefined
  );

  const photoUrlMap: Record<string, string> = {};

  if (photoKeys.length > 0) {
    const serviceClient = createServiceRoleClient();
    const { data: signedUrls } = await serviceClient
      .storage
      .from('tenant-media')
      .createSignedUrls(photoKeys, 300);

    signedUrls?.forEach(({ path, signedUrl }) => {
      if (path && signedUrl) photoUrlMap[path] = signedUrl;
    });
  }

  const props: ClientProfileClientProps = {
    clientId: clientRow.id,
    clientCreatedAt: clientRow.created_at,
    onboardingCompleted: clientRow.onboarding_completed,
    age: clientRow.age ?? null,
    heightCm: clientRow.height_cm ?? null,
    conditionNotes: clientRow.condition_notes ?? null,
    platformUser: {
      full_name: platformUser.full_name,
      email: platformUser.email,
      status: platformUser.status as string,
      created_at: platformUser.created_at,
    },
    subscription: subscription
      ? {
          status: subscription.status as string,
          start_date: subscription.start_date ?? null,
          end_date: subscription.end_date ?? null,
        }
      : null,
    flashCard: flashCard
      ? {
          id: flashCard.id,
          status: flashCard.status as string,
          last_log_at: flashCard.last_log_at ?? null,
          computed_at: flashCard.computed_at ?? null,
          notes: flashCard.notes ?? null,
        }
      : null,
    logs: (logs ?? []).map((l) => ({
      id: l.id,
      log_date: l.log_date,
      steps: l.steps ?? null,
      weight: l.weight ?? null,
      meal_description: l.meal_description ?? null,
      meal_photo_key: l.meal_photo_key ?? null,
      questions: l.questions ?? null,
      weight_photo_key: l.weight_photo_key ?? null,
    })),
    photoUrlMap,
    planAssignments: (planAssignments ?? []).map((p) => ({
      id: p.id,
      title: (p.plans as { title: string } | null)?.title ?? 'Untitled plan',
      plan_type: p.plan_type,
      status: p.status as string,
      assigned_at: p.assigned_at,
    })),
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      fromClient: m.sender_id === params.id,
      content: m.content,
      read_at: m.read_at ?? null,
      created_at: m.created_at,
    })),
    absenceEvents: (absenceEvents ?? []).map((e) => ({
      id: e.id,
      trigger_date: e.trigger_date,
      level: e.level as string,
      action_taken: e.action_taken as string,
      created_at: e.created_at,
      resolved_at: e.resolved_at ?? null,
    })),
    mealEntries: (mealEntries ?? []).map((m) => ({
      id: m.id,
      log_date: m.log_date,
      meal_type: m.meal_type,
      description: m.description ?? null,
      photo_key: m.photo_key ?? null,
    })),
  };

  return <ClientProfileClient {...props} />;
}
