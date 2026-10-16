import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  Theme,
  useTheme,
  fontFamily,
  Card,
  Btn,
  FieldLabel,
  SectionLabel,
  inputStyleFor,
  TAB_BAR_CLEARANCE,
} from '../../lib/design-system';
import { notify } from '../../lib/haptics';
import {
  MEAL_TYPE_ORDER,
  MealType,
  PlanMealBudget,
  computeKcalLeft,
  parsePlanMealBudget,
  mealKcalMap,
  mealCap,
} from '../../lib/mealBudget';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

type MealCardState = {
  description: string;
  // Server-confirmed description, set only on initial load (from the
  // meal_entries row) and after a successful save — never on keystrokes.
  // loggedMealTypes below is derived from this, not `description`, so a
  // sitting's slice only fills (and kcal-left only drops) once the save
  // actually persists, not while the user is mid-edit.
  savedDescription: string;
  photoUri: string | null;
  photoKey: string | null;
  existingPhotoKey: string | null;
  saving: boolean;
  error: string | null;
  success: boolean;
  // True once the user has edited `description` since the last successful
  // load/save for this card. loadData() fires silently on every tab focus
  // (not just mount), so while dirty it must skip overwriting `description`
  // from the server — otherwise a background refetch can silently discard
  // an unsaved keystroke. Cleared on a successful save for this card, since
  // the saved value becomes the new server-agreed baseline.
  dirty: boolean;
};

const MEAL_TYPES = MEAL_TYPE_ORDER;

export default function MealsScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [planMealBudget, setPlanMealBudget] = useState<PlanMealBudget | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);

  const [cards, setCards] = useState<Record<MealType, MealCardState>>({
    breakfast: {
      description: '',
      savedDescription: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
      dirty: false,
    },
    lunch: {
      description: '',
      savedDescription: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
      dirty: false,
    },
    dinner: {
      description: '',
      savedDescription: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
      dirty: false,
    },
    snack: {
      description: '',
      savedDescription: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
      dirty: false,
    },
  });

  const [focusedField, setFocusedField] = useState<MealType | null>(null);

  const successAnimRefs = useRef<Record<MealType, Animated.Value>>({
    breakfast: new Animated.Value(0),
    lunch: new Animated.Value(0),
    dinner: new Animated.Value(0),
    snack: new Animated.Value(0),
  });

  const playSuccessAnim = (type: MealType) => {
    notify(); // success haptic paired with the "Saved ✓" confirmation
    const anim = successAnimRefs.current[type];
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(anim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const todayISO = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setFetchError(false);

    const supabase = createMobileSupabaseClient();
    const {
      data: { session: sess },
    } = await supabase.auth.getSession();

    if (!sess?.user?.id) {
      router.replace('/login');
      return;
    }

    const uid = sess.user.id;
    setUserId(uid);
    setSession({ access_token: sess.access_token });

    try {
      const [mealsResult, clientResult, mealPlanResult] = await Promise.all([
        supabase
          .from('meal_entries')
          .select('id, meal_type, description, photo_key')
          .eq('client_id', uid)
          .eq('log_date', todayISO),
        supabase
          .from('clients')
          .select('coach_id')
          .eq('id', uid)
          .single(),
        supabase
          .from('plan_assignments')
          .select('assigned_at, plans!plan_assignments_plan_id_fkey(content)')
          .eq('client_id', uid)
          .eq('plan_type', 'meal')
          .eq('status', 'active')
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (mealsResult.error || clientResult.error) {
        setFetchError(true);
      }

      if (clientResult.data) {
        setCoachId(clientResult.data.coach_id);
      }

      const mealPlan = mealPlanResult.data?.plans as { content: unknown } | null | undefined;
      setPlanMealBudget(parsePlanMealBudget(mealPlan?.content));

      if (mealsResult.data) {
        setCards((prev) => {
          const updated = { ...prev };
          for (const row of mealsResult.data) {
            const mType = row.meal_type as MealType;
            if (updated[mType]) {
              const isDirty = updated[mType].dirty;
              updated[mType] = {
                ...updated[mType],
                // Skip overwriting the live-edited description while the
                // user is mid-edit on this card (see MealCardState.dirty
                // above) — savedDescription still tracks the true
                // server value regardless, so kcal-left stays correct.
                description: isDirty
                  ? updated[mType].description
                  : row.description ?? '',
                savedDescription: row.description ?? '',
                existingPhotoKey: row.photo_key ?? null,
                photoKey: row.photo_key ?? null,
              };
            }
          }
          return updated;
        });
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [todayISO]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData({ silent: true });
    setRefreshing(false);
  }, [loadData]);

  // Refetch on every tab focus (silent — no full-screen spinner), not just
  // mount, so switching between Home and Meals never shows stale
  // meal_entries data or a kcal-left number that disagrees between tabs.
  useFocusEffect(
    useCallback(() => {
      loadData({ silent: true });
    }, [loadData])
  );

  const handlePickPhoto = async (type: MealType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCards((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          photoUri: result.assets[0].uri,
          photoKey: null,
          success: false,
          error: null,
        },
      }));
    }
  };

  const handleSaveMeal = async (type: MealType) => {
    const card = cards[type];
    if (!userId || !coachId || !session) return;

    if (card.description.length > 1000) {
      setCards((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          error: 'Description is too long (max 1000 characters).',
          success: false,
        },
      }));
      return;
    }

    setCards((prev) => ({
      ...prev,
      [type]: { ...prev[type], saving: true, error: null, success: false },
    }));

    let finalPhotoKey: string | null = card.photoKey ?? card.existingPhotoKey;

    try {
      if (card.photoUri && !card.photoKey) {
        const ext = card.photoUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

        const imageBlob = await fetch(card.photoUri).then((r) => r.blob());
        const size = imageBlob.size;
        const filename = `${Date.now()}_${type}.${ext}`;
        const path = `${coachId}/${userId}/${filename}`;

        const urlRes = await fetch(`${API_BASE}/api/storage/signed-upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ path, content_type: contentType, size }),
        });

        if (!urlRes.ok) {
          setCards((prev) => ({
            ...prev,
            [type]: {
              ...prev[type],
              saving: false,
              error: 'Photo upload failed. Try again.',
            },
          }));
          return;
        }

        const { signed_url, path: confirmedPath } = (await urlRes.json()) as {
          signed_url: string;
          path: string;
        };

        const putRes = await fetch(signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: imageBlob,
        });

        if (!putRes.ok) {
          setCards((prev) => ({
            ...prev,
            [type]: {
              ...prev[type],
              saving: false,
              error: 'Photo upload failed. Try again.',
            },
          }));
          return;
        }

        finalPhotoKey = confirmedPath;
      }

      const supabase = createMobileSupabaseClient();
      const { error: upsertError } = await supabase
        .from('meal_entries')
        .upsert(
          {
            client_id: userId,
            coach_id: coachId,
            log_date: todayISO,
            meal_type: type,
            description: card.description.trim() || null,
            photo_key: finalPhotoKey,
          },
          { onConflict: 'client_id,log_date,meal_type' }
        );

      if (upsertError) {
        setCards((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            saving: false,
            error: 'Could not save meal. Try again.',
          },
        }));
        return;
      }

      setCards((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          saving: false,
          photoKey: finalPhotoKey,
          existingPhotoKey: finalPhotoKey,
          photoUri: null,
          success: true,
          error: null,
          savedDescription: card.description.trim(),
          // Saved value is now the server-agreed baseline — future silent
          // loadData() calls may sync this card's description again.
          dirty: false,
        },
      }));
      playSuccessAnim(type);
    } catch {
      setCards((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          saving: false,
          error: 'Could not save meal. Check connection and try again.',
        },
      }));
    }
  };

  // Which sittings are logged today, for the meal-limit hero + progress bar.
  // Derived from `savedDescription` (server-confirmed: set on load and after
  // a successful save only) rather than the live-edited `description` field,
  // so a slice fills — and kcal-left drops — only once a save actually
  // persists, not on every keystroke. Home's `loggedMealTypes` derivation
  // (home.tsx) uses the equivalent `savedDescription` marker on its own
  // `mealEntries` state, so the two screens' kcal-left numbers agree.
  const loggedMealTypes: MealType[] = (Object.keys(cards) as MealType[]).filter(
    (t) => cards[t].savedDescription.trim().length > 0
  );
  const effectiveMealCap = mealCap(planMealBudget);
  const effectiveMealKcalMap = mealKcalMap(planMealBudget);
  const kcalLeft = computeKcalLeft(loggedMealTypes, effectiveMealCap, effectiveMealKcalMap);

  return (
    <View style={{ flex: 1, backgroundColor: T.screenBg }}>
      <LinearGradient
        colors={T.washColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
      >
        <Text style={styles.heading}>Today's Meals</Text>

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
            <Card style={styles.limitCard}>
              <SectionLabel>TODAY'S MEAL LIMIT</SectionLabel>
              <View style={styles.mealHeroRow}>
                <Text style={styles.mealHeroNumber}>{kcalLeft}</Text>
                <Text style={styles.mealHeroUnit}>kcal left</Text>
              </View>
              <View style={styles.mealHeroBarTrack}>
                <View
                  style={[
                    styles.mealHeroBarFill,
                    {
                      width: `${Math.max(
                        0,
                        Math.min(100, (kcalLeft / effectiveMealCap) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
            </Card>

            {MEAL_TYPES.map(({ type, label }) => {
            const card = cards[type];
            const hasSavedDescription = card.description.trim().length > 0;
            const isFocused = focusedField === type;
            const showMutedTint = hasSavedDescription && !isFocused;
            const hasPhoto = !!card.photoUri || !!card.existingPhotoKey;

            return (
              <Card key={type} style={styles.mealCard}>
                <View style={styles.mealTitleRow}>
                  <Text style={styles.mealTitle}>{label}</Text>
                  <Text style={styles.mealKcalBudget}>{effectiveMealKcalMap[type]} kcal</Text>
                </View>

                <FieldLabel>Description</FieldLabel>
                <TextInput
                  style={[
                    styles.input,
                    styles.multiline,
                    showMutedTint && styles.inputSaved,
                  ]}
                  value={card.description}
                  onChangeText={(v) => {
                    setCards((prev) => ({
                      ...prev,
                      [type]: {
                        ...prev[type],
                        description: v,
                        dirty: true,
                        success: false,
                        error: null,
                      },
                    }));
                  }}
                  onFocus={() => setFocusedField(type)}
                  onBlur={() => setFocusedField((f) => (f === type ? null : f))}
                  placeholder={`What did you have for ${label.toLowerCase()}?`}
                  placeholderTextColor={T.muted}
                  multiline
                  numberOfLines={3}
                  maxLength={1000}
                  textAlignVertical="top"
                />

                <View style={{ marginTop: 8 }}>
                  <FieldLabel>Meal Photo</FieldLabel>
                  {hasPhoto ? (
                    <View style={styles.photoRow}>
                      {card.photoUri ? (
                        <Image
                          source={{ uri: card.photoUri }}
                          style={styles.thumbnail}
                        />
                      ) : (
                        <View style={styles.photoChip}>
                          <Ionicons name="image" size={16} color={T.onSurfaceVar} />
                          <Text style={styles.photoChipText}>Photo added</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.editPhotoButton}
                        onPress={() => handlePickPhoto(type)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${label.toLowerCase()} photo`}
                      >
                        <Ionicons name="pencil" size={15} color={T.primary} />
                        <Text style={styles.editPhotoButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => handlePickPhoto(type)}
                    >
                      <Text style={styles.photoButtonText}>Add {label.toLowerCase()} photo</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {card.error !== null && (
                  <Text style={styles.errorText}>{card.error}</Text>
                )}

                <View style={styles.cardActionRow}>
                  <Btn
                    variant="primary"
                    small
                    onPress={() => handleSaveMeal(type)}
                    disabled={card.saving}
                    accessibilityLabel={`Save ${label}`}
                    style={styles.saveButton}
                  >
                    {card.saving ? (
                      <ActivityIndicator color={T.onPrimary} size="small" />
                    ) : (
                      `Save ${label}`
                    )}
                  </Btn>

                  <Animated.Text
                    style={[
                      styles.successText,
                      { opacity: successAnimRefs.current[type] },
                    ]}
                  >
                    Saved ✓
                  </Animated.Text>
                </View>
              </Card>
              );
            })}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (T: Theme) =>
  StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 56,
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
    marginBottom: 20,
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
  // Card's own 24px radius/frosted-fill/border (lib/design-system.tsx) is
  // left unmodified here — only spacing overrides, same as mealCard below.
  limitCard: {
    marginBottom: 18,
  },
  mealHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  mealHeroNumber: {
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    fontSize: 34,
    color: T.onSurface,
  },
  mealHeroUnit: {
    fontSize: 13,
    fontFamily: fontFamily.bodyMedium,
    color: T.muted,
  },
  mealHeroBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: T.surfaceLow,
    overflow: 'hidden',
  },
  mealHeroBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: T.primary,
  },
  mealCard: {
    marginBottom: 18,
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mealTitle: {
    fontSize: 16,
    fontFamily: fontFamily.headingBold,
    fontWeight: '700',
    color: T.onSurface,
  },
  mealKcalBudget: {
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
    color: T.muted,
  },
  input: {
    ...inputStyleFor(T),
    marginBottom: 8,
  },
  multiline: {
    minHeight: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  inputSaved: {
    backgroundColor: T.surfaceLow,
    color: T.onSurfaceVar,
    borderBottomColor: T.border,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  photoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: T.surfaceLow,
  },
  photoChipText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyMedium,
    color: T.onSurfaceVar,
  },
  editPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surfaceHigh,
  },
  editPhotoButtonText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyMedium,
    color: T.primary,
  },
  photoButton: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: T.surfaceLow,
  },
  photoButtonText: {
    fontSize: 14,
    fontFamily: fontFamily.bodyMedium,
    color: T.onSurfaceVar,
  },
  errorText: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  saveButton: {
    alignSelf: 'flex-start',
  },
  successText: {
    color: T.success,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
});
