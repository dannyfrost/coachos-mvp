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
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';

type DailyLogRow = {
  client_id: string;
  coach_id: string;
  created_at: string;
  id: string;
  log_date: string;
  meal_description: string | null;
  meal_photo_key: string | null;
  questions: string | null;
  steps: number | null;
  weight: number | null;
};
type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated';
type SubStatus = 'active' | 'expired' | 'overdue';

type TodayLogArgs = {
  p_steps?: number;
  p_weight?: number;
  p_meal_description?: string;
  p_meal_photo_key?: string;
  p_questions?: string;
};

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

function getBanner(
  userStatus: UserStatus | null,
  subStatus: SubStatus | null,
): { text: string; color: string } | null {
  if (!userStatus) return null;
  if (userStatus === 'paused') {
    return {
      text: 'Your account is paused. Contact your coach to resume.',
      color: '#FFF3CD',
    };
  }
  if (
    userStatus === 'deactivated' ||
    userStatus === 'suspended' ||
    userStatus === 'banned'
  ) {
    return {
      text: 'Your account is not active. Contact your coach.',
      color: '#F8D7DA',
    };
  }
  if (subStatus === 'expired' || subStatus === 'overdue') {
    return {
      text: 'Your subscription has expired. Contact your coach.',
      color: '#F8D7DA',
    };
  }
  return null;
}

function isSubmitBlocked(
  userStatus: UserStatus | null,
  subStatus: SubStatus | null,
): boolean {
  if (!userStatus) return false;
  if (userStatus === 'paused') return true;
  if (
    userStatus === 'deactivated' ||
    userStatus === 'suspended' ||
    userStatus === 'banned'
  )
    return true;
  if (subStatus === 'expired' || subStatus === 'overdue') return true;
  return false;
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);

  const [steps, setSteps] = useState('');
  const [weight, setWeight] = useState('');
  const [mealDescription, setMealDescription] = useState('');
  const [questions, setQuestions] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [existingPhotoKey, setExistingPhotoKey] = useState<string | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);

    const supabase = createMobileSupabaseClient();
    const { data: { session: sess } } = await supabase.auth.getSession();

    if (!sess?.user?.id) {
      router.replace('/activate');
      return;
    }

    const uid = sess.user.id;
    setUserId(uid);
    setSession({ access_token: sess.access_token });

    // Non-blocking, silent push token registration
    (async () => {
      try {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;

        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );

        if (tokenData?.data) {
          await fetch(`${API_BASE}/api/push/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sess.access_token}`,
            },
            body: JSON.stringify({
              expo_push_token: tokenData.data,
              platform: Platform.OS,
            }),
          });
        }
      } catch {
        // Silently ignore push registration failures (e.g. before EAS project is configured)
      }
    })();

    const todayISO = new Date().toISOString().slice(0, 10);

    try {
      const [logResult, puResult, subResult, clientResult] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('log_date', todayISO)
          .maybeSingle(),
        supabase
          .from('platform_users')
          .select('status')
          .eq('id', uid)
          .single(),
        supabase
          .from('client_subscriptions')
          .select('status')
          .eq('id', uid)
          .maybeSingle(),
        supabase
          .from('clients')
          .select('coach_id')
          .eq('id', uid)
          .single(),
      ]);

      if (logResult.error || puResult.error || clientResult.error) {
        setFetchError(true);
      }

      const log = logResult.data as DailyLogRow | null;
      if (log) {
        setSteps(log.steps !== null ? String(log.steps) : '');
        setWeight(log.weight !== null ? log.weight.toFixed(1) : '');
        setMealDescription(log.meal_description ?? '');
        setQuestions(log.questions ?? '');
        setExistingPhotoKey(log.meal_photo_key ?? null);
      }

      if (puResult.data) {
        setUserStatus(puResult.data.status as UserStatus);
      }
      if (subResult.data) {
        setSubStatus(subResult.data.status as SubStatus);
      }
      if (clientResult.data) {
        setCoachId(clientResult.data.coach_id);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoKey(null);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setPhotoKey(null);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(false);

    let parsedSteps: number | null = null;
    let parsedWeight: number | null = null;

    if (steps.trim()) {
      if (steps.includes('.')) {
        setSubmitError('Steps must be a whole number.');
        return;
      }
      const n = parseInt(steps, 10);
      if (isNaN(n)) {
        setSubmitError('Steps must be a whole number.');
        return;
      }
      if (n < 0 || n > 99999) {
        setSubmitError('Steps must be between 0 and 99999.');
        return;
      }
      parsedSteps = n;
    }

    if (weight.trim()) {
      const w = parseFloat(weight);
      if (isNaN(w)) {
        setSubmitError('Enter a valid weight.');
        return;
      }
      if (w < 0 || w > 999.9) {
        setSubmitError('Weight must be between 0 and 999.9 kg.');
        return;
      }
      parsedWeight = w;
    }

    if (mealDescription.length > 1000) {
      setSubmitError('Meal description is too long (max 1000 characters).');
      return;
    }

    if (questions.length > 2000) {
      setSubmitError('Questions field is too long (max 2000 characters).');
      return;
    }

    setSubmitting(true);
    let finalPhotoKey: string | null = photoKey;

    try {
      if (photoUri && !photoKey) {
        if (!coachId || !userId || !session) {
          setSubmitError('Photo upload failed. Try again or remove the photo.');
          return;
        }

        const ext = photoUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

        const imageBlob = await fetch(photoUri).then((r) => r.blob());
        const size = imageBlob.size;

        const filename = `${Date.now()}.${ext}`;
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
          setSubmitError('Photo upload failed. Try again or remove the photo.');
          return;
        }

        const { signed_url, path: confirmedPath } = (await urlRes.json()) as {
          signed_url: string;
          path: string;
          expires_in: null;
        };

        const putRes = await fetch(signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: imageBlob,
        });

        if (!putRes.ok) {
          setSubmitError('Photo upload failed. Try again or remove the photo.');
          return;
        }

        setPhotoKey(confirmedPath);
        finalPhotoKey = confirmedPath;
      }

      const supabase = createMobileSupabaseClient();
      const args: TodayLogArgs = {};
      if (parsedSteps !== null) args.p_steps = parsedSteps;
      if (parsedWeight !== null) args.p_weight = parsedWeight;
      if (mealDescription.trim()) args.p_meal_description = mealDescription.trim();
      if (finalPhotoKey) args.p_meal_photo_key = finalPhotoKey;
      else if (existingPhotoKey) args.p_meal_photo_key = existingPhotoKey;
      if (questions.trim()) args.p_questions = questions.trim();

      const { error: rpcError } = await supabase.rpc('update_today_log', args);
      if (rpcError) {
        setSubmitError('Could not save your log. Check your connection and try again.');
        return;
      }

      setSubmitSuccess(true);
    } catch {
      setSubmitError('Could not save your log. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const banner = getBanner(userStatus, subStatus);
  const blocked = isSubmitBlocked(userStatus, subStatus);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Today's Log</Text>
          <View style={styles.headerLinks}>
            <TouchableOpacity
              onPress={() => router.push('/meals')}
              accessibilityRole="button"
              accessibilityLabel="View and log meals"
            >
              <Text style={styles.reportLink}>Meals</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/report')}
              accessibilityRole="button"
              accessibilityLabel="View my progress report"
            >
              <Text style={styles.reportLink}>My Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="View settings"
            >
              <Text style={styles.reportLink}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {fetchError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              Could not load your data. Pull to retry.
            </Text>
          </View>
        )}

        {banner && (
          <View style={[styles.statusBanner, { backgroundColor: banner.color }]}>
            <Text style={styles.statusBannerText}>{banner.text}</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#111" style={styles.loadingIndicator} />
        ) : (
          <>
            <Text style={styles.label}>Steps</Text>
            <TextInput
              style={styles.input}
              value={steps}
              onChangeText={(v) => {
                setSteps(v);
                setSubmitSuccess(false);
              }}
              placeholder="e.g. 8000"
              keyboardType="numeric"
              returnKeyType="next"
            />

            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={(v) => {
                setWeight(v);
                setSubmitSuccess(false);
              }}
              placeholder="e.g. 72.5"
              keyboardType="decimal-pad"
              returnKeyType="next"
            />

            <Text style={styles.label}>Meal description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={mealDescription}
              onChangeText={(v) => {
                setMealDescription(v);
                setSubmitSuccess(false);
              }}
              placeholder="Describe your meals today"
              multiline
              numberOfLines={4}
              maxLength={1000}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Meal photo</Text>
            {photoUri ? (
              <View style={styles.photoRow}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.thumbnail}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={handleRemovePhoto}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : existingPhotoKey ? (
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handlePickPhoto}
              >
                <Text style={styles.photoButtonText}>
                  Photo already uploaded — tap to replace
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handlePickPhoto}
              >
                <Text style={styles.photoButtonText}>Add meal photo</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Questions for your coach</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={questions}
              onChangeText={(v) => {
                setQuestions(v);
                setSubmitSuccess(false);
              }}
              placeholder="Any questions or notes for your coach"
              multiline
              numberOfLines={4}
              maxLength={2000}
              textAlignVertical="top"
            />

            {submitError !== null && (
              <Text style={styles.submitError}>{submitError}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (blocked || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={blocked || submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit daily log"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Save Log</Text>
              )}
            </TouchableOpacity>

            {submitSuccess && (
              <Text style={styles.successText}>Logged ✓</Text>
            )}
          </>
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  reportLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a56db',
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
  statusBanner: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  statusBannerText: {
    fontSize: 14,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  multiline: {
    minHeight: 96,
    paddingTop: 11,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
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
  },
  removeButtonText: {
    fontSize: 14,
    color: '#555',
  },
  photoButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  photoButtonText: {
    fontSize: 14,
    color: '#555',
  },
  submitError: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successText: {
    color: '#16a34a',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});
