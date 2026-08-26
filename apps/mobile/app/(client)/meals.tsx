import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';

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

  const todayISO = new Date().toISOString().slice(0, 10);

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

  const handleRemovePhoto = (type: MealType) => {
    setCards((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        photoUri: null,
        photoKey: null,
        existingPhotoKey: null,
        success: false,
        error: null,
      },
    }));
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
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.backLink}>{'< Back'}</Text>
        </TouchableOpacity>
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
            color="#111"
            style={styles.loadingIndicator}
          />
        ) : (
          MEAL_TYPES.map(({ type, label }) => {
            const card = cards[type];
            return (
              <View key={type} style={styles.mealCard}>
                <Text style={styles.mealTitle}>{label}</Text>

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
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
                  placeholder={`What did you have for ${label.toLowerCase()}?`}
                  multiline
                  numberOfLines={3}
                  maxLength={1000}
                  textAlignVertical="top"
                />

                <Text style={styles.inputLabel}>Meal Photo</Text>
                {card.photoUri ? (
                  <View style={styles.photoRow}>
                    <Image
                      source={{ uri: card.photoUri }}
                      style={styles.thumbnail}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePhoto(type)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : card.existingPhotoKey ? (
                  <View style={styles.photoRow}>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => handlePickPhoto(type)}
                    >
                      <Text style={styles.photoButtonText}>
                        Photo uploaded — tap to replace
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePhoto(type)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
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

                {card.error !== null && (
                  <Text style={styles.errorText}>{card.error}</Text>
                )}

                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      card.saving && styles.buttonDisabled,
                    ]}
                    onPress={() => handleSaveMeal(type)}
                    disabled={card.saving}
                    accessibilityRole="button"
                    accessibilityLabel={`Save ${label}`}
                  >
                    {card.saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save {label}</Text>
                    )}
                  </TouchableOpacity>

                  {card.success && (
                    <Text style={styles.successText}>Saved ✓</Text>
                  )}
                </View>
              </View>
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
  mealCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#fafafa',
    marginBottom: 18,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
  },
  multiline: {
    minHeight: 72,
    paddingTop: 10,
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
    borderColor: '#d1d5db',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  removeButtonText: {
    fontSize: 13,
    color: '#555',
  },
  photoButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  photoButtonText: {
    fontSize: 14,
    color: '#555',
  },
  errorText: {
    color: '#dc2626',
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
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  successText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '600',
  },
});
