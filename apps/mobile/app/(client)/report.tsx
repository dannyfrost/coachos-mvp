import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import LineChart from './_components/LineChart';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

type DailyLogRow = {
  log_date: string;
  steps: number | null;
  weight: number | null;
};

type PlanRow = {
  plan_id: string;
  status: string;
  assigned_at: string;
  plan_type: string;
  plans: {
    title: string;
    content: {
      body?: string;
      file?: {
        path?: string;
        filename?: string;
        content_type?: string;
        size?: number;
      };
    } | null;
  } | null;
};

type AbsenceEventRow = {
  id: string;
  trigger_date: string;
  level: string;
  action_taken: string;
  resolved_at: string | null;
};

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function ReportScreen() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [logs, setLogs] = useState<DailyLogRow[]>([]);
  const [activePlan, setActivePlan] = useState<PlanRow | null>(null);
  const [absenceEvents, setAbsenceEvents] = useState<AbsenceEventRow[]>([]);
  const [session, setSession] = useState<{ access_token: string } | null>(null);

  const [openingPlan, setOpeningPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);

    const supabase = createMobileSupabaseClient();
    const {
      data: { session: sess },
    } = await supabase.auth.getSession();
    if (!sess?.user?.id) {
      router.replace('/activate');
      return;
    }
    setSession({ access_token: sess.access_token });

    try {
      const [logsResult, planResult, absenceResult] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('log_date, steps, weight')
          .order('log_date', { ascending: false })
          .limit(14),
        supabase
          .from('plan_assignments')
          .select(
            'plan_id, status, assigned_at, plan_type, plans!plan_assignments_plan_id_fkey(title, content)'
          )
          .eq('status', 'active')
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('absence_events')
          .select('id, trigger_date, level, action_taken, resolved_at')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (logsResult.error || absenceResult.error) {
        setFetchError(true);
      }

      setLogs(((logsResult.data ?? []) as DailyLogRow[]).reverse());
      setActivePlan((planResult.data as unknown as PlanRow | null) ?? null);
      setAbsenceEvents((absenceResult.data ?? []) as AbsenceEventRow[]);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenPlan = async () => {
    if (!activePlan?.plan_id || !session?.access_token) return;
    setOpeningPlan(true);
    setPlanError(null);

    try {
      const res = await fetch(`${API_BASE}/api/plans/download-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan_id: activePlan.plan_id }),
      });

      if (!res.ok) {
        setPlanError('Could not open plan file. Try again.');
        return;
      }

      const { signed_url } = (await res.json()) as { signed_url?: string };
      if (signed_url) {
        await Linking.openURL(signed_url);
      } else {
        setPlanError('Could not open plan file. Try again.');
      }
    } catch {
      setPlanError('Could not open plan file. Try again.');
    } finally {
      setOpeningPlan(false);
    }
  };

  const weightPoints = logs.map((l) => ({ date: l.log_date, value: l.weight }));
  const stepsPoints = logs.map((l) => ({ date: l.log_date, value: l.steps }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.backLink}>{'< Back'}</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>My Progress</Text>

      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Could not load your data. Pull to retry.</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#111" style={styles.loadingIndicator} />
      ) : (
        <>
          <Text style={styles.sectionLabel}>WEIGHT — LAST {logs.length} LOGS</Text>
          <View style={styles.card}>
            <LineChart points={weightPoints} color="#1a56db" />
          </View>

          <Text style={styles.sectionLabel}>STEPS — LAST {logs.length} LOGS</Text>
          <View style={styles.card}>
            <LineChart points={stepsPoints} color="#16a34a" />
          </View>

          <Text style={styles.sectionLabel}>CURRENT PLAN</Text>
          <View style={styles.card}>
            {activePlan ? (
              <>
                <Text style={styles.planTitle}>{activePlan.plans?.title ?? 'Untitled plan'}</Text>
                <Text style={styles.planMeta}>
                  {activePlan.plan_type} · assigned {fmtDate(activePlan.assigned_at)}
                </Text>
                {activePlan.plans?.content?.file && (
                  <View style={styles.planFileSection}>
                    <TouchableOpacity
                      style={[styles.viewPlanButton, openingPlan && styles.buttonDisabled]}
                      onPress={handleOpenPlan}
                      disabled={openingPlan}
                      accessibilityRole="button"
                      accessibilityLabel="View plan file"
                    >
                      {openingPlan ? (
                        <ActivityIndicator size="small" color="#111" />
                      ) : (
                        <Text style={styles.viewPlanButtonText}>View Plan</Text>
                      )}
                    </TouchableOpacity>
                    {planError !== null && (
                      <Text style={styles.planErrorText}>{planError}</Text>
                    )}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>No active plan assigned.</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>ABSENCE / CHECK-IN ALERTS</Text>
          {absenceEvents.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No alerts on your account.</Text>
            </View>
          ) : (
            absenceEvents.map((e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.planTitle}>{e.level} — {e.action_taken.replace(/_/g, ' ')}</Text>
                <Text style={styles.planMeta}>
                  triggered {fmtDate(e.trigger_date)}
                  {e.resolved_at ? ` · resolved ${fmtDate(e.resolved_at)}` : ' · open'}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 56,
    backgroundColor: '#fff',
  },
  backLink: {
    fontSize: 15,
    color: '#1a56db',
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 20,
  },
  loadingIndicator: {
    marginTop: 40,
  },
  errorBanner: {
    backgroundColor: '#F8D7DA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#721c24',
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fafafa',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  planMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  planFileSection: {
    marginTop: 12,
  },
  viewPlanButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  viewPlanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  planErrorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
