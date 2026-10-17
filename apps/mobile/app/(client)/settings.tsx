import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  Theme,
  useTheme,
  fontFamily,
  Card,
  Btn,
  StatusWord,
  SectionLabel,
  FieldLabel,
  Avatar,
  initialsOf,
  inputStyleFor,
  TAB_BAR_CLEARANCE,
} from '../../lib/design-system';
import { Chip } from '../../lib/icons';
import { computeStreak, fmtDateShort, getTodayISO } from '../../lib/stats';

type SubRow = {
  status: string;
  start_date: string;
  end_date: string;
};

export default function SettingsScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [coachName, setCoachName] = useState('Not assigned');
  const [clientAge, setClientAge] = useState<number | null>(null);
  const [clientHeight, setClientHeight] = useState<number | null>(null);
  const [conditionNotes, setConditionNotes] = useState<string | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editAge, setEditAge] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editConditions, setEditConditions] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [subscription, setSubscription] = useState<SubRow | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setFetchError(false);

    const supabase = createMobileSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      router.replace('/login');
      return;
    }

    const uid = session.user.id;

    try {
      const [
        userResult,
        clientResult,
        subResult,
        logsCountResult,
        recentLogsResult,
      ] = await Promise.all([
        supabase
          .from('platform_users')
          .select('full_name, email')
          .eq('id', uid)
          .single(),
        supabase
          .from('clients')
          .select('coach_id, age, height_cm, condition_notes')
          .eq('id', uid)
          .single(),
        supabase
          .from('client_subscriptions')
          .select('status, start_date, end_date')
          .eq('client_id', uid)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('daily_logs')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', uid),
        supabase
          .from('daily_logs')
          .select('log_date')
          .eq('client_id', uid)
          .order('log_date', { ascending: false })
          .limit(30),
      ]);

      if (userResult.error || !userResult.data) {
        setFetchError(true);
      } else {
        setFullName(userResult.data.full_name ?? '');
        setEmail(userResult.data.email ?? '');
      }

      if (clientResult.data) {
        setClientAge(clientResult.data.age ?? null);
        setClientHeight(clientResult.data.height_cm ?? null);
        setConditionNotes(clientResult.data.condition_notes ?? null);

        if (clientResult.data.coach_id) {
          const { data: coachData } = await supabase
            .from('platform_users')
            .select('full_name')
            .eq('id', clientResult.data.coach_id)
            .single();

          if (coachData?.full_name) {
            setCoachName(coachData.full_name);
          }
        }
      }

      if (typeof logsCountResult.count === 'number') {
        setTotalLogsCount(logsCountResult.count);
      }

      const logDates = (recentLogsResult.data ?? []).map((l) => l.log_date);
      const computedStreak = computeStreak(logDates, getTodayISO());
      setStreak(computedStreak);

      if (subResult.data) {
        setSubscription(subResult.data as SubRow);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData({ silent: true });
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startEditingProfile = () => {
    setEditAge(clientAge !== null ? String(clientAge) : '');
    setEditHeight(clientHeight !== null ? String(clientHeight) : '');
    setEditConditions(conditionNotes ?? '');
    setProfileError(null);
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setProfileError(null);

    let parsedAge: number | undefined;
    if (editAge.trim()) {
      const n = parseInt(editAge, 10);
      if (isNaN(n) || n < 1 || n > 120) {
        setProfileError('Age must be between 1 and 120.');
        return;
      }
      parsedAge = n;
    }

    let parsedHeight: number | undefined;
    if (editHeight.trim()) {
      const h = parseInt(editHeight, 10);
      if (isNaN(h) || h < 50 || h > 250) {
        setProfileError('Height must be between 50 and 250 cm.');
        return;
      }
      parsedHeight = h;
    }

    setSavingProfile(true);
    try {
      const supabase = createMobileSupabaseClient();
      const { error } = await supabase.rpc('update_client_profile', {
        p_age: parsedAge,
        p_height_cm: parsedHeight,
        p_condition_notes: editConditions.trim() || undefined,
      });

      if (error) {
        setProfileError('Could not save. Try again.');
        return;
      }

      setClientAge(parsedAge ?? null);
      setClientHeight(parsedHeight ?? null);
      setConditionNotes(editConditions.trim() || null);
      setEditingProfile(false);
    } catch {
      setProfileError('Network error. Check your connection and try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createMobileSupabaseClient();
      await supabase.auth.signOut();
      router.replace('/login');
    } catch {
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  // Subscription timeline calculations
  let daysLeft = 0;
  let subProgressPct = 0;
  let startDateLabel = '';
  let endDateLabel = '';

  if (subscription?.start_date && subscription?.end_date) {
    const start = new Date(subscription.start_date).getTime();
    const end = new Date(subscription.end_date).getTime();
    const now = new Date().getTime();
    const totalDuration = Math.max(1, end - start);
    const elapsed = Math.max(0, Math.min(totalDuration, now - start));
    subProgressPct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    const msPerDay = 1000 * 60 * 60 * 24;
    daysLeft = Math.max(0, Math.ceil((end - now) / msPerDay));
    startDateLabel = fmtDateShort(subscription.start_date);
    endDateLabel = fmtDateShort(subscription.end_date);
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.screenBg }}>
      <LinearGradient
        colors={T.washColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
      >
        <Text style={styles.heading}>Settings</Text>

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
            {/* ── Profile Header Card (Name & Email) ── */}
            <SectionLabel style={styles.sectionHeader}>PROFILE</SectionLabel>
            <Card style={styles.card}>
              <View style={styles.avatarRow}>
                {fullName ? (
                  <Avatar initials={initialsOf(fullName)} size={42} style={styles.avatar} />
                ) : null}
                <View style={styles.profileTextContainer}>
                  <FieldLabel>Name</FieldLabel>
                  <Text style={styles.fieldValue}>{fullName || '—'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <FieldLabel>Email</FieldLabel>
              <Text style={styles.fieldValue}>{email || '—'}</Text>
            </Card>

            {/* ── Stats Row (Streak & Total Logs) ── */}
            <SectionLabel style={styles.sectionHeader}>ACTIVITY STATS</SectionLabel>
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>STREAK</Text>
                  <Chip
                    iconKey="flame"
                    size={13}
                    bg={T.amberBg}
                    color={T.amberMid}
                    chipSize={26}
                    radius={6}
                  />
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{streak}</Text>
                  <Text style={styles.statUnit}>
                    {streak === 1 ? 'day' : 'days'}
                  </Text>
                </View>
              </Card>

              <Card style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>TOTAL LOGS</Text>
                  <Chip
                    iconKey="check"
                    size={13}
                    bg={T.successBg}
                    color={T.success}
                    chipSize={26}
                    radius={6}
                  />
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{totalLogsCount}</Text>
                  <Text style={styles.statUnit}>
                    {totalLogsCount === 1 ? 'log' : 'logs'}
                  </Text>
                </View>
              </Card>
            </View>

            {/* ── Subscription Card ── */}
            <SectionLabel style={styles.sectionHeader}>SUBSCRIPTION</SectionLabel>
            <Card style={styles.card}>
              {subscription ? (
                <>
                  <View style={styles.subHeaderRow}>
                    <FieldLabel style={styles.subFieldLabel}>PLAN STATUS</FieldLabel>
                    <StatusWord status={subscription.status} />
                  </View>

                  <View style={styles.subDetailsRow}>
                    <Text style={styles.subPlanText}>
                      Coaching Plan · Renews {endDateLabel}
                    </Text>
                    <Text style={styles.subDaysLeftText}>
                      {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBarBg}>
                    <LinearGradient
                      colors={[T.primary, T.primaryMid]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressBarFill,
                        { width: `${subProgressPct}%` },
                      ]}
                    />
                  </View>

                  <View style={styles.subDatesRow}>
                    <Text style={styles.subDateText}>{startDateLabel}</Text>
                    <Text style={styles.subDateText}>{endDateLabel}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptySubText}>No active subscription found.</Text>
              )}
            </Card>

            {/* ── Profile Info List (Coach, Age, Height, Conditions) ── */}
            <View style={styles.sectionHeaderRow}>
              <SectionLabel style={styles.sectionHeaderNoMargin}>PROFILE DETAILS</SectionLabel>
              {!editingProfile && (
                <TouchableOpacity
                  onPress={startEditingProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile details"
                >
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <Card style={styles.infoCard}>
              {/* Coach Row (read-only always) */}
              <View style={styles.infoRow}>
                <Chip
                  iconKey="user"
                  size={15}
                  bg={T.primaryLight}
                  color={T.primary}
                  chipSize={34}
                  radius={10}
                />
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Coach</Text>
                  <Text style={styles.infoValue}>{coachName}</Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              {editingProfile ? (
                <View style={styles.editSection}>
                  <FieldLabel>Age</FieldLabel>
                  <TextInput
                    style={styles.editInput}
                    value={editAge}
                    onChangeText={setEditAge}
                    placeholder="e.g. 32"
                    placeholderTextColor={T.muted}
                    keyboardType="number-pad"
                  />

                  <FieldLabel>Height (cm)</FieldLabel>
                  <TextInput
                    style={styles.editInput}
                    value={editHeight}
                    onChangeText={setEditHeight}
                    placeholder="e.g. 175"
                    placeholderTextColor={T.muted}
                    keyboardType="number-pad"
                  />

                  <FieldLabel>Medical conditions</FieldLabel>
                  <TextInput
                    style={[styles.editInput, styles.editMultiline]}
                    value={editConditions}
                    onChangeText={setEditConditions}
                    placeholder="Leave blank if none"
                    placeholderTextColor={T.muted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  {profileError !== null && (
                    <Text style={styles.profileError}>{profileError}</Text>
                  )}

                  <View style={styles.editButtonRow}>
                    <Btn
                      variant="secondary"
                      onPress={() => {
                        setEditingProfile(false);
                        setProfileError(null);
                      }}
                      disabled={savingProfile}
                      accessibilityLabel="Cancel editing profile details"
                      style={styles.editButtonHalf}
                    >
                      Cancel
                    </Btn>
                    <Btn
                      variant="primary"
                      onPress={handleSaveProfile}
                      disabled={savingProfile}
                      accessibilityLabel="Save profile details"
                      style={styles.editButtonHalf}
                    >
                      {savingProfile ? <ActivityIndicator color={T.onPrimary} /> : 'Save'}
                    </Btn>
                  </View>
                </View>
              ) : (
                <>
                  {/* Age Row */}
                  <View style={styles.infoRow}>
                    <Chip
                      iconKey="calendar"
                      size={15}
                      bg={T.surfaceLow}
                      color={T.onSurfaceVar}
                      chipSize={34}
                      radius={10}
                    />
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Age</Text>
                      <Text style={styles.infoValue}>
                        {clientAge !== null ? `${clientAge} years` : 'Not set'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoDivider} />

                  {/* Height Row */}
                  <View style={styles.infoRow}>
                    <Chip
                      iconKey="scale"
                      size={15}
                      bg={T.surfaceLow}
                      color={T.onSurfaceVar}
                      chipSize={34}
                      radius={10}
                    />
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Height</Text>
                      <Text style={styles.infoValue}>
                        {clientHeight !== null ? `${clientHeight} cm` : 'Not set'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoDivider} />

                  {/* Conditions Row */}
                  <View style={styles.infoRow}>
                    <Chip
                      iconKey="cross"
                      size={15}
                      bg={T.redBg}
                      color={T.redMid}
                      chipSize={34}
                      radius={10}
                    />
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Conditions</Text>
                      <Text style={styles.infoValue}>
                        {conditionNotes && conditionNotes.trim().length > 0
                          ? conditionNotes
                          : 'None reported'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Card>

            {/* ── Account Section (Change Password & Log Out) ── */}
            <View style={styles.accountDivider} />
            <SectionLabel style={styles.accountSectionHeader}>ACCOUNT</SectionLabel>
            <Card style={styles.infoCard}>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => router.push('/change-password')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Change password"
              >
                <Chip
                  iconKey="lock"
                  size={15}
                  bg={T.primaryLight}
                  color={T.primary}
                  chipSize={34}
                  radius={10}
                />
                <View style={styles.infoCol}>
                  <Text style={styles.settingsRowLabel}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={T.muted} />
              </TouchableOpacity>
            </Card>

            {/* ── Log Out Button ── */}
            <Btn
              variant="danger"
              onPress={handleLogout}
              disabled={loggingOut}
              accessibilityLabel="Log out"
              style={styles.logoutButton}
            >
              {loggingOut ? (
                <ActivityIndicator color={T.red} />
              ) : (
                'Log Out'
              )}
            </Btn>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (T: Theme) =>
  StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 52,
    // Bottom padding clears the floating capsule tab bar (~64px tall,
    // floated `insets.bottom + 16` above the screen edge — see
    // (client)/_layout.tsx) plus breathing room for the largest expected
    // safe-area inset.
    paddingBottom: TAB_BAR_CLEARANCE,
    backgroundColor: 'transparent',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderNoMargin: {
    marginTop: 0,
    marginBottom: 0,
  },
  editLink: {
    fontSize: 13,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.primary,
  },
  editSection: {
    paddingVertical: 12,
  },
  editInput: {
    ...inputStyleFor(T),
    marginBottom: 14,
  },
  editMultiline: {
    minHeight: 70,
    paddingTop: 10,
  },
  profileError: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    marginBottom: 10,
  },
  editButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  editButtonHalf: {
    flex: 1,
  },
  card: {
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 12,
  },
  profileTextContainer: {
    flex: 1,
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: fontFamily.bodyMedium,
    fontWeight: '500',
    color: T.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: T.border,
    marginVertical: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.6,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    fontSize: 22,
    color: T.onSurface,
  },
  statUnit: {
    fontSize: 12,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subFieldLabel: {
    marginBottom: 0,
  },
  subDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subPlanText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyMedium,
    color: T.onSurfaceVar,
  },
  subDaysLeftText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    color: T.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: T.surfaceLow,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subDateText: {
    fontSize: 10,
    fontFamily: fontFamily.bodyRegular,
    color: T.muted,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyRegular,
    color: T.muted,
  },
  infoCard: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    color: T.muted,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: fontFamily.bodyMedium,
    color: T.onSurface,
  },
  infoDivider: {
    height: 1,
    backgroundColor: T.border,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  settingsRowLabel: {
    fontSize: 14,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.onSurface,
  },
  accountDivider: {
    height: 1,
    backgroundColor: T.border,
    marginTop: 18,
    marginBottom: 4,
  },
  accountSectionHeader: {
    marginTop: 12,
    marginBottom: 8,
  },
  logoutButton: {
    marginTop: 14,
    marginBottom: 28,
  },
});
