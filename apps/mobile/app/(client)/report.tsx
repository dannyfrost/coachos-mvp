import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import WeightTrendChart from '../../components/WeightTrendChart';
import StepsBarChart from '../../components/StepsBarChart';
import LoggingHeatmap from '../../components/LoggingHeatmap';
import {
  T,
  fontFamily,
  Card,
  Btn,
  Badge,
  SectionLabel,
} from '../../lib/design-system';

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
    const uid = sess.user.id;
    setSession({ access_token: sess.access_token });

    try {
      const [logsResult, planResult, absenceResult] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('log_date, steps, weight')
          .eq('client_id', uid)
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
      <Text style={styles.heading}>My Progress</Text>

      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            Could not load your data. Pull to retry.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={T.primary}
          style={styles.loadingIndicator}
        />
      ) : (
        <>
          {/* ── Weight Trend (Smooth Catmull-Rom Curve) ── */}
          <SectionLabel style={styles.sectionHeader}>WEIGHT PROGRESS</SectionLabel>
          <Card style={styles.card}>
            <WeightTrendChart points={weightPoints} />
          </Card>

          {/* ── Steps Trend (Dual-tone Bar Chart) ── */}
          <SectionLabel style={styles.sectionHeader}>STEPS PROGRESS</SectionLabel>
          <Card style={styles.card}>
            <StepsBarChart points={stepsPoints} />
          </Card>

          {/* ── 7-Day Logging Consistency Heatmap ── */}
          <SectionLabel style={styles.sectionHeader}>CONSISTENCY</SectionLabel>
          <Card style={styles.card}>
            <LoggingHeatmap logs={logs} />
          </Card>

          {/* ── Current Plan ── */}
          <SectionLabel style={styles.sectionHeader}>CURRENT PLAN</SectionLabel>
          <Card style={styles.card}>
            {activePlan ? (
              <>
                <Text style={styles.planTitle}>
                  {activePlan.plans?.title ?? 'Untitled plan'}
                </Text>
                <Text style={styles.planMeta}>
                  {activePlan.plan_type} · assigned {fmtDate(activePlan.assigned_at)}
                </Text>
                {activePlan.plans?.content?.file && (
                  <View style={styles.planFileSection}>
                    <Btn
                      variant="primary"
                      small
                      onPress={handleOpenPlan}
                      disabled={openingPlan}
                      accessibilityLabel="View plan file"
                      style={styles.viewPlanButton}
                    >
                      {openingPlan ? (
                        <ActivityIndicator size="small" color={T.white} />
                      ) : (
                        'View Plan'
                      )}
                    </Btn>
                    {planError !== null && (
                      <Text style={styles.planErrorText}>{planError}</Text>
                    )}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>No active plan assigned.</Text>
            )}
          </Card>

          {/* ── Absence / Check-in Alerts ── */}
          <SectionLabel style={styles.sectionHeader}>
            ABSENCE / CHECK-IN ALERTS
          </SectionLabel>
          {absenceEvents.length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.emptyText}>No alerts on your account.</Text>
            </Card>
          ) : (
            absenceEvents.map((e) => (
              <Card key={e.id} style={[styles.card, styles.alertCard]}>
                <View style={styles.alertHeaderRow}>
                  <Badge status={e.level} small />
                  <Text style={styles.alertTitle}>
                    {e.action_taken.replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text style={styles.planMeta}>
                  triggered {fmtDate(e.trigger_date)}
                  {e.resolved_at
                    ? ` · resolved ${fmtDate(e.resolved_at)}`
                    : ' · open'}
                </Text>
              </Card>
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
    padding: 20,
    paddingTop: 52,
    backgroundColor: T.surface,
  },
  heading: {
    fontSize: 22,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    color: T.onSurface,
    marginBottom: 16,
  },
  loadingIndicator: {
    marginTop: 40,
  },
  errorBanner: {
    backgroundColor: T.redBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    marginBottom: 12,
  },
  alertCard: {
    marginBottom: 10,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: fontFamily.headingBold,
    fontWeight: '700',
    color: T.onSurface,
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyRegular,
    color: T.muted,
  },
  planTitle: {
    fontSize: 15,
    fontFamily: fontFamily.headingBold,
    fontWeight: '700',
    color: T.onSurface,
  },
  planMeta: {
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
    color: T.onSurfaceVar,
    marginTop: 4,
  },
  planFileSection: {
    marginTop: 12,
  },
  viewPlanButton: {
    alignSelf: 'flex-start',
  },
  planErrorText: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    marginTop: 6,
  },
});
