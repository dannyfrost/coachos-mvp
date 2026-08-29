import { useEffect, useState, useCallback, useRef } from 'react';
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
import { router } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  T,
  fontFamily,
  Card,
  Btn,
  FieldLabel,
  inputStyle,
} from '../../lib/design-system';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type MealCardState = {
  description: string;
  photoUri: string | null;
  photoKey: string | null;
  existingPhotoKey: string | null;
  saving: boolean;
  error: string | null;
  success: boolean;
};

const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snack' },
];

export default function MealsScreen() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);

  const [cards, setCards] = useState<Record<MealType, MealCardState>>({
    breakfast: {
      description: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
    },
    lunch: {
      description: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
    },
    dinner: {
      description: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
    },
    snack: {
      description: '',
      photoUri: null,
      photoKey: null,
      existingPhotoKey: null,
      saving: false,
      error: null,
      success: false,
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
      const [mealsResult, clientResult] = await Promise.all([
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
      ]);

      if (mealsResult.error || clientResult.error) {
        setFetchError(true);
      }

      if (clientResult.data) {
        setCoachId(clientResult.data.coach_id);
      }

      if (mealsResult.data) {
        setCards((prev) => {
          const updated = { ...prev };
          for (const row of mealsResult.data) {
            const mType = row.meal_type as MealType;
            if (updated[mType]) {
              updated[mType] = {
                ...updated[mType],
                description: row.description ?? '',
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

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: T.surface }}
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
          MEAL_TYPES.map(({ type, label }) => {
            const card = cards[type];
            const hasSavedDescription = card.description.trim().length > 0;
            const isFocused = focusedField === type;
            const showMutedTint = hasSavedDescription && !isFocused;
            const hasPhoto = !!card.photoUri || !!card.existingPhotoKey;

            return (
              <Card key={type} style={styles.mealCard}>
                <Text style={styles.mealTitle}>{label}</Text>

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
                      <ActivityIndicator color={T.white} size="small" />
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
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 56,
    backgroundColor: T.surface,
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
  mealCard: {
    marginBottom: 18,
  },
  mealTitle: {
    fontSize: 16,
    fontFamily: fontFamily.headingBold,
    fontWeight: '700',
    color: T.onSurface,
    marginBottom: 12,
  },
  input: {
    ...inputStyle,
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
    backgroundColor: T.white,
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
