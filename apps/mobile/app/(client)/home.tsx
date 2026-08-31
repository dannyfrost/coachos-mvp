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
  LayoutAnimation,
  UIManager,
  ActionSheetIOS,
  Alert,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import * as ImagePicker from 'expo-image-picker';
import { recognizeText } from 'rn-mlkit-ocr';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  T,
  fontFamily,
  Card,
  FieldLabel,
  SectionLabel,
  Btn,
  Avatar,
  initialsOf,
  inputStyle,
  cardShadow,
  screenBackground,
  screenWashColors,
  StatusWord,
} from '../../lib/design-system';
import {
  MEAL_CAP,
  MEAL_KCAL,
  MealType,
  computeKcalLeft,
  sittingSliceState,
} from '../../lib/mealBudget';
import {
  Chip,
  IconFlame,
  IconCheck,
  IconKey,
} from '../../lib/icons';
import {
  computeStreak,
  getTodayISO,
  getYesterdayISO,
} from '../../lib/stats';
import { extractWeightCandidate } from '../../lib/weightOcr';
import {
  isPedometerAvailable,
  hasStepsPermission,
  requestStepsPermission,
  readTodaySteps,
} from '../../lib/stepsPedometer';
import { decideStepsSync } from '../../lib/stepsSync';
import {
  markManualOverrideToday,
  isManualOverrideActiveToday,
} from '../../lib/stepsManualOverride';
import { registerStepsBackgroundTask } from '../../lib/stepsBackgroundTask';
import {
  initialWeightOcrState,
  reduceWeightOcrState,
} from '../../lib/weightOcrState';
import CompletionRing from '../../components/CompletionRing';

const MEAL_OPTIONS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snack' },
];

type MealEntryState = {
  description: string;
  photoUri: string | null;
  photoKey: string | null;
  existingPhotoKey: string | null;
};

type DailyLogRow = {
  client_id: string;
  coach_id: string;
  created_at: string;
  id: string;
  log_date: string;
  questions: string | null;
  steps: number | null;
  weight: number | null;
};

type MessagePreview = {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  read_at: string | null;
};

type UserStatus = 'pending' | 'active' | 'paused' | 'suspended' | 'banned' | 'deactivated';
type SubStatus = 'active' | 'expired' | 'overdue';

type TodayLogArgs = {
  p_steps?: number;
  p_weight?: number;
  p_questions?: string;
  p_weight_photo_key?: string;
};

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

// Maps account/subscription status onto a single StatusWord key (see
// lib/design-system.tsx's BADGE_MAP). Spec: "Status = one underlined word
// under the date. No paragraph banner." — 'green' (label "On Track") is the
// default healthy state; problem states take priority over it.
function getStatusKey(
  userStatus: UserStatus | null,
  subStatus: SubStatus | null,
): string {
  if (!userStatus) return 'green';
  if (userStatus === 'paused') return 'paused';
  if (
    userStatus === 'deactivated' ||
    userStatus === 'suspended' ||
    userStatus === 'banned'
  ) {
    return userStatus;
  }
  if (userStatus === 'pending') return 'pending';
  if (subStatus === 'expired' || subStatus === 'overdue') return subStatus;
  return 'green';
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

function fmtMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [clientFullName, setClientFullName] = useState('');
  const [coachName, setCoachName] = useState('Coach');
  const [coachInitials, setCoachInitials] = useState('C');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);

  const [todayLog, setTodayLog] = useState<DailyLogRow | null>(null);
  const [yesterdayLog, setYesterdayLog] = useState<DailyLogRow | null>(null);
  const [streak, setStreak] = useState(0);
  const [latestMessage, setLatestMessage] = useState<MessagePreview | null>(null);

  const [steps, setSteps] = useState('');
  const [weight, setWeight] = useState('');
  const [questions, setQuestions] = useState('');

  const [weightOcrState, setWeightOcrState] = useState(initialWeightOcrState);
  const [weightOcrBusy, setWeightOcrBusy] = useState(false);

  // Meal state for Today's Log quick-add
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [mealDescription, setMealDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [existingPhotoKey, setExistingPhotoKey] = useState<string | null>(null);

  const [mealEntries, setMealEntries] = useState<Record<MealType, MealEntryState>>({
    breakfast: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
    lunch: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
    dinner: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
    snack: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [mealDescriptionFocused, setMealDescriptionFocused] = useState(false);

  const submitSuccessAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!submitSuccess) return;
    submitSuccessAnim.setValue(0);
    Animated.sequence([
      Animated.timing(submitSuccessAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(submitSuccessAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [submitSuccess, submitSuccessAnim]);

  // Field input refs for checklist scroll / focus
  const scrollViewRef = useRef<ScrollView>(null);
  const stepsInputRef = useRef<TextInput>(null);
  const weightInputRef = useRef<TextInput>(null);
  const mealInputRef = useRef<TextInput>(null);
  const questionsInputRef = useRef<TextInput>(null);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setFetchError(false);

    const supabase = createMobileSupabaseClient();
    const { data: { session: sess } } = await supabase.auth.getSession();

    if (!sess?.user?.id) {
      router.replace('/login');
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
        // Silently ignore push registration failures
      }
    })();

    const todayISO = getTodayISO();
    const yesterdayISO = getYesterdayISO(todayISO);

    try {
      const [
        logsResult,
        puResult,
        subResult,
        clientResult,
        mealsResult,
        unreadResult,
        latestMsgResult,
      ] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('client_id, coach_id, created_at, id, log_date, questions, steps, weight')
          .eq('client_id', uid)
          .order('log_date', { ascending: false })
          .limit(30),
        supabase
          .from('platform_users')
          .select('full_name, status')
          .eq('id', uid)
          .single(),
        supabase
          .from('client_subscriptions')
          .select('status')
          .eq('client_id', uid)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('clients')
          .select('coach_id')
          .eq('id', uid)
          .single(),
        supabase
          .from('meal_entries')
          .select('id, meal_type, description, photo_key')
          .eq('client_id', uid)
          .eq('log_date', todayISO),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', uid)
          .is('read_at', null),
        supabase
          .from('messages')
          .select('id, content, sender_id, recipient_id, created_at, read_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (logsResult.error || puResult.error || clientResult.error || mealsResult.error) {
        setFetchError(true);
      }

      if (typeof unreadResult.count === 'number') {
        setUnreadCount(unreadResult.count);
      }

      const allLogs = (logsResult.data ?? []) as DailyLogRow[];
      const todayRow = allLogs.find((l) => l.log_date === todayISO) ?? null;
      const yesterdayRow = allLogs.find((l) => l.log_date === yesterdayISO) ?? null;

      setTodayLog(todayRow);
      setYesterdayLog(yesterdayRow);

      const computedStreak = computeStreak(
        allLogs.map((l) => l.log_date),
        todayISO
      );
      setStreak(computedStreak);

      if (todayRow) {
        setSteps(todayRow.steps !== null ? String(todayRow.steps) : '');
        setWeight(todayRow.weight !== null ? todayRow.weight.toFixed(1) : '');
        setQuestions(todayRow.questions ?? '');
      }

      if (puResult.data) {
        setClientFullName(puResult.data.full_name ?? '');
        setUserStatus(puResult.data.status as UserStatus);
      }
      if (subResult.data) {
        setSubStatus(subResult.data.status as SubStatus);
      }
      if (clientResult.data?.coach_id) {
        const cId = clientResult.data.coach_id;
        setCoachId(cId);

        // Fetch coach full name
        const { data: coachData } = await supabase
          .from('platform_users')
          .select('full_name')
          .eq('id', cId)
          .single();

        if (coachData?.full_name) {
          setCoachName(coachData.full_name);
          setCoachInitials(initialsOf(coachData.full_name));
        }
      }

      if (latestMsgResult.data) {
        setLatestMessage(latestMsgResult.data as MessagePreview);
      }

      if (mealsResult.data) {
        const loadedMap: Record<MealType, MealEntryState> = {
          breakfast: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
          lunch: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
          dinner: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
          snack: { description: '', photoUri: null, photoKey: null, existingPhotoKey: null },
        };
        for (const row of mealsResult.data) {
          const mType = row.meal_type as MealType;
          if (loadedMap[mType]) {
            loadedMap[mType] = {
              description: row.description ?? '',
              photoUri: null,
              photoKey: row.photo_key ?? null,
              existingPhotoKey: row.photo_key ?? null,
            };
          }
        }
        setMealEntries(loadedMap);
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

  const stepsSyncRanRef = useRef(false);
  useEffect(() => {
    if (!userId || stepsSyncRanRef.current) return;
    stepsSyncRanRef.current = true;

    (async () => {
      try {
        const available = await isPedometerAvailable();
        if (!available) return;

        let granted = await hasStepsPermission();
        if (!granted) {
          granted = await requestStepsPermission();
        }
        if (!granted) return;

        const today = getTodayISO();
        const result = await readTodaySteps();
        const overrideActive = await isManualOverrideActiveToday(today);
        const decision = decideStepsSync(today, overrideActive, result);

        if (__DEV__) {
          console.log('[stepsForegroundSync]', { today, result, overrideActive, decision });
        }

        if (decision.action === 'update') {
          setSteps(String(decision.value));
          setSubmitSuccess(false);
          const supabase = createMobileSupabaseClient();
          const { error } = await supabase.rpc('update_today_log', {
            p_steps: decision.value,
          });
          if (__DEV__ && error) {
            console.log('[stepsForegroundSync] update_today_log failed', error);
          }
        }

        await registerStepsBackgroundTask();
      } catch (err) {
        if (__DEV__) {
          console.log('[stepsForegroundSync] unexpected error', err);
        }
        // Never let steps auto-sync crash or block the Daily Log.
      }
    })();
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          const supabase = createMobileSupabaseClient();
          const {
            data: { session: sess },
          } = await supabase.auth.getSession();
          if (!sess?.user?.id || !isMounted) return;

          const [{ count }, { data: latestMsg }] = await Promise.all([
            supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('recipient_id', sess.user.id)
              .is('read_at', null),
            supabase
              .from('messages')
              .select('id, content, sender_id, recipient_id, created_at, read_at')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          if (isMounted) {
            if (typeof count === 'number') {
              setUnreadCount(count);
            }
            if (latestMsg) {
              setLatestMessage(latestMsg as MessagePreview);
            }
          }
        } catch {
          // Silently ignore background badge refresh errors
        }
      })();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const runWeightOcr = async (photoUri: string) => {
    setWeightOcrBusy(true);
    try {
      const ocrResult = await recognizeText(photoUri, 'latin');
      const value = extractWeightCandidate(ocrResult);

      if (value === null) {
        setWeightOcrState((s) => reduceWeightOcrState(s, { type: 'OCR_FAILURE', photoUri }));
        return;
      }

      setWeightOcrState((s) =>
        reduceWeightOcrState(s, { type: 'OCR_SUCCESS', photoUri, value })
      );
      setWeight(String(value));
      setSubmitSuccess(false);
    } catch (err) {
      console.warn('[weight-ocr] recognizeText failed:', err instanceof Error ? err.message : err);
      setWeightOcrState((s) => reduceWeightOcrState(s, { type: 'OCR_FAILURE', photoUri }));
    } finally {
      setWeightOcrBusy(false);
    }
  };

  const handleWeightCameraPress = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setWeightOcrState((s) => reduceWeightOcrState(s, { type: 'PERMISSION_DENIED' }));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;
    await runWeightOcr(result.assets[0].uri);
  };

  const handleWeightGalleryPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setWeightOcrState((s) => reduceWeightOcrState(s, { type: 'PERMISSION_DENIED' }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;
    await runWeightOcr(result.assets[0].uri);
  };

  // Single "From photo" entry point (spec: one quiet control, no visible
  // Camera / Gallery pair). Offers both existing capture paths via an action
  // sheet; handleWeightCameraPress / handleWeightGalleryPress are unchanged.
  const handleFromPhotoPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take Photo', 'Choose from Library', 'Cancel'], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) handleWeightCameraPress();
          if (index === 1) handleWeightGalleryPress();
        }
      );
    } else {
      Alert.alert('From photo', undefined, [
        { text: 'Take Photo', onPress: handleWeightCameraPress },
        { text: 'Choose from Library', onPress: handleWeightGalleryPress },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleMealTypeChange = (type: MealType | null) => {
    setSelectedMealType(type);
    setSubmitSuccess(false);
    setSubmitError(null);

    if (!type) {
      setMealDescription('');
      setPhotoUri(null);
      setPhotoKey(null);
      setExistingPhotoKey(null);
    } else {
      const entry = mealEntries[type];
      setMealDescription(entry?.description ?? '');
      setPhotoUri(entry?.photoUri ?? null);
      setPhotoKey(entry?.photoKey ?? null);
      setExistingPhotoKey(entry?.existingPhotoKey ?? null);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      setPhotoKey(null);
      setSubmitSuccess(false);
      if (selectedMealType) {
        setMealEntries((prev) => ({
          ...prev,
          [selectedMealType]: {
            ...prev[selectedMealType],
            photoUri: uri,
            photoKey: null,
          },
        }));
      }
    }
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

    const hasMealContent =
      mealDescription.trim().length > 0 ||
      !!photoUri ||
      !!photoKey ||
      !!existingPhotoKey;

    if (hasMealContent && !selectedMealType) {
      setSubmitError('Select which meal this is before saving.');
      return;
    }

    setSubmitting(true);
    let finalPhotoKey: string | null = photoKey ?? existingPhotoKey;

    try {
      if (selectedMealType && photoUri && !photoKey) {
        if (!coachId || !userId || !session) {
          setSubmitError('Photo upload failed. Try again or remove the photo.');
          setSubmitting(false);
          return;
        }

        const ext = photoUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

        const imageBlob = await fetch(photoUri).then((r) => r.blob());
        const size = imageBlob.size;

        const filename = `${Date.now()}_${selectedMealType}.${ext}`;
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
          setSubmitting(false);
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
          setSubmitError('Photo upload failed. Try again or remove the photo.');
          setSubmitting(false);
          return;
        }

        finalPhotoKey = confirmedPath;
        setPhotoKey(confirmedPath);
      }

      let finalWeightPhotoKey: string | null = null;
      if (weightOcrState.retainedPhotoUri) {
        if (!coachId || !userId || !session) {
          setSubmitError('Weight photo upload failed. Try again.');
          setSubmitting(false);
          return;
        }

        const wExt = weightOcrState.retainedPhotoUri.toLowerCase().endsWith('.png')
          ? 'png'
          : 'jpeg';
        const wContentType = wExt === 'png' ? 'image/png' : 'image/jpeg';

        const wImageBlob = await fetch(weightOcrState.retainedPhotoUri).then((r) => r.blob());
        const wSize = wImageBlob.size;

        const wFilename = `${Date.now()}_weight.${wExt}`;
        const wPath = `${coachId}/${userId}/${wFilename}`;

        const wUrlRes = await fetch(`${API_BASE}/api/storage/signed-upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ path: wPath, content_type: wContentType, size: wSize }),
        });

        if (!wUrlRes.ok) {
          setSubmitError('Weight photo upload failed. Try again.');
          setSubmitting(false);
          return;
        }

        const { signed_url: wSignedUrl, path: wConfirmedPath } = (await wUrlRes.json()) as {
          signed_url: string;
          path: string;
        };

        const wPutRes = await fetch(wSignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': wContentType },
          body: wImageBlob,
        });

        if (!wPutRes.ok) {
          setSubmitError('Weight photo upload failed. Try again.');
          setSubmitting(false);
          return;
        }

        finalWeightPhotoKey = wConfirmedPath;
      }

      const supabase = createMobileSupabaseClient();
      const todayISO = getTodayISO();

      const args: TodayLogArgs = {};
      if (parsedSteps !== null) args.p_steps = parsedSteps;
      if (parsedWeight !== null) args.p_weight = parsedWeight;
      if (questions.trim()) args.p_questions = questions.trim();
      if (finalWeightPhotoKey !== null) args.p_weight_photo_key = finalWeightPhotoKey;

      let dailyLogSuccess = false;
      let mealSuccess = false;

      const { error: rpcError } = await supabase.rpc('update_today_log', args);
      if (!rpcError) {
        dailyLogSuccess = true;
        setTodayLog((prev) => ({
          ...(prev ?? {
            client_id: userId ?? '',
            coach_id: coachId ?? '',
            created_at: new Date().toISOString(),
            id: '',
            log_date: todayISO,
            questions: null,
            steps: null,
            weight: null,
          }),
          weight: parsedWeight,
          steps: parsedSteps,
          questions: questions.trim() || null,
        }));
        if (finalWeightPhotoKey !== null) {
          setWeightOcrState((s) => reduceWeightOcrState(s, { type: 'RESET' }));
        }
      }

      if (selectedMealType && userId && coachId) {
        const { error: upsertError } = await supabase
          .from('meal_entries')
          .upsert(
            {
              client_id: userId,
              coach_id: coachId,
              log_date: todayISO,
              meal_type: selectedMealType,
              description: mealDescription.trim() || null,
              photo_key: finalPhotoKey,
            },
            { onConflict: 'client_id,log_date,meal_type' }
          );

        if (!upsertError) {
          mealSuccess = true;
          setPhotoKey(finalPhotoKey);
          setExistingPhotoKey(finalPhotoKey);
          setPhotoUri(null);
          setMealEntries((prev) => ({
            ...prev,
            [selectedMealType]: {
              description: mealDescription.trim(),
              photoUri: null,
              photoKey: finalPhotoKey,
              existingPhotoKey: finalPhotoKey,
            },
          }));
        }
      }

      if (selectedMealType) {
        if (dailyLogSuccess && mealSuccess) {
          setSubmitSuccess(true);
          // Refresh today log in background for summary cards
          loadData();
        } else if (dailyLogSuccess && !mealSuccess) {
          setSubmitError(
            'Steps and weight saved, but the meal could not be saved. Try again.'
          );
        } else if (!dailyLogSuccess && mealSuccess) {
          setSubmitError(
            'Meal saved, but steps and weight could not be saved. Try again.'
          );
        } else {
          setSubmitError(
            'Could not save your log. Check your connection and try again.'
          );
        }
      } else {
        if (dailyLogSuccess) {
          setSubmitSuccess(true);
          // Refresh today log in background for summary cards
          loadData();
        } else {
          setSubmitError(
            'Could not save your log. Check your connection and try again.'
          );
        }
      }
    } catch {
      setSubmitError(
        'Could not save your log. Check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived completion states for Checklist ──
  const weightDone =
    (todayLog?.weight ?? null) !== null || (weight.trim().length > 0 && submitSuccess);
  const stepsDone =
    (todayLog?.steps ?? null) !== null || (steps.trim().length > 0 && submitSuccess);

  // Which sittings are actually logged today, for the meal-budget hero + slices.
  // `mealEntries` is server-confirmed data loaded from the `meal_entries` table
  // (loadData's mealsResult query, keyed by today's log_date) and kept in sync
  // locally after every successful save — it is NOT separate local/ephemeral
  // state. Deriving loggedMealTypes from it (rather than a fresh useState, as
  // the brief's illustrative snippet suggested) keeps this screen and the
  // Meals tab (Task 4) reading the same underlying source of truth, since both
  // screens query the same table and both mark a sitting "logged" by a
  // non-empty description — matching the existing `mealsDone` check below.
  const loggedMealTypes: MealType[] = (Object.keys(mealEntries) as MealType[]).filter(
    (t) => mealEntries[t].description.trim().length > 0
  );
  const kcalLeft = computeKcalLeft(loggedMealTypes);

  const mealsDone =
    Object.values(mealEntries).some((m) => m.description.trim().length > 0) ||
    (mealDescription.trim().length > 0 && submitSuccess);
  const photoDone =
    Object.values(mealEntries).some(
      (m) => !!m.photoKey || !!m.existingPhotoKey || !!m.photoUri
    ) ||
    !!photoKey ||
    !!photoUri ||
    !!existingPhotoKey;

  const tasks: {
    id: string;
    label: string;
    iconKey: IconKey;
    done: boolean;
    optional: boolean;
    chipBg: string;
    chipColor: string;
    onTap: () => void;
  }[] = [
    {
      id: 'weight',
      label: 'Log Weight',
      iconKey: 'scale',
      done: weightDone,
      optional: false,
      chipBg: '#e8f1fb',
      chipColor: T.primary,
      onTap: () => {
        weightInputRef.current?.focus();
      },
    },
    {
      id: 'steps',
      label: 'Log Steps',
      iconKey: 'steps',
      done: stepsDone,
      optional: false,
      chipBg: T.successBg,
      chipColor: T.success,
      onTap: () => {
        stepsInputRef.current?.focus();
      },
    },
    {
      id: 'meals',
      label: 'Describe Meals',
      iconKey: 'utensils',
      done: mealsDone,
      optional: false,
      chipBg: T.amberBg,
      chipColor: T.amber,
      onTap: () => {
        mealInputRef.current?.focus();
      },
    },
    {
      id: 'photo',
      label: 'Meal Photo',
      iconKey: 'camera',
      done: photoDone,
      optional: true,
      chipBg: T.surfaceLow,
      chipColor: T.onSurfaceVar,
      onTap: () => {
        handlePickPhoto();
      },
    },
  ];

  const doneCount = tasks.filter((t) => t.done).length;
  const allTasksDone = doneCount === tasks.length;

  const [collapsed, setCollapsed] = useState(true);
  const hasUserToggledRef = useRef(false);
  const initialCollapseSetRef = useRef(false);

  useEffect(() => {
    if (!loading && !initialCollapseSetRef.current) {
      initialCollapseSetRef.current = true;
      if (!hasUserToggledRef.current && allTasksDone) {
        setCollapsed(true);
      }
    }
  }, [loading, allTasksDone]);

  const toggleCollapsed = () => {
    hasUserToggledRef.current = true;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => !prev);
  };

  // ── Greeting calculations ──
  const hour = new Date().getHours();
  const greetingText =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const clientFirstName = clientFullName
    ? clientFullName.trim().split(' ')[0]
    : 'there';
  const todayFormattedDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const greetGradColors =
    hour < 12
      ? (['rgba(232,241,251,0.9)', 'rgba(247,249,251,0)'] as const)
      : hour < 17
      ? (['rgba(254,243,199,0.55)', 'rgba(247,249,251,0)'] as const)
      : (['rgba(237,233,254,0.6)', 'rgba(247,249,251,0)'] as const);

  // ── Stats row weight & steps delta calculations ──
  const currentWeightVal =
    todayLog?.weight ?? (weight.trim() ? parseFloat(weight) : null);
  const yesterdayWeightVal = yesterdayLog?.weight ?? null;
  let weightDeltaText = 'No prev log';
  let weightDeltaIsGood = true;
  if (currentWeightVal !== null && yesterdayWeightVal !== null) {
    const diff = currentWeightVal - yesterdayWeightVal;
    if (diff === 0) {
      weightDeltaText = '0.0 kg today';
      weightDeltaIsGood = true;
    } else if (diff < 0) {
      weightDeltaText = `−${Math.abs(diff).toFixed(1)} kg today`;
      weightDeltaIsGood = true;
    } else {
      weightDeltaText = `+${diff.toFixed(1)} kg today`;
      weightDeltaIsGood = false;
    }
  }

  const currentStepsVal =
    todayLog?.steps ?? (steps.trim() ? parseInt(steps, 10) : null);
  const yesterdayStepsVal = yesterdayLog?.steps ?? null;
  let stepsDeltaText = 'No prev log';
  let stepsDeltaIsGood = true;
  if (currentStepsVal !== null && yesterdayStepsVal !== null) {
    const diff = currentStepsVal - yesterdayStepsVal;
    if (diff >= 0) {
      stepsDeltaText = `+${diff.toLocaleString()} today`;
      stepsDeltaIsGood = true;
    } else {
      stepsDeltaText = `−${Math.abs(diff).toLocaleString()} today`;
      stepsDeltaIsGood = false;
    }
  }

  const statusKey = getStatusKey(userStatus, subStatus);
  const blocked = isSubmitBlocked(userStatus, subStatus);

  return (
    <View style={screenBackground}>
      <LinearGradient
        colors={screenWashColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
      >
        {/* ── Greeting Header ── */}
        <LinearGradient
          colors={greetGradColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.greetingHeader}
        >
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingSub}>{greetingText}</Text>
            <Text style={styles.greetingName}>{clientFirstName}</Text>
            <Text style={styles.greetingDate}>{todayFormattedDate}</Text>
            <StatusWord status={statusKey} style={styles.statusWord} />
          </View>
          <View style={styles.greetingRight}>
            <TouchableOpacity
              onPress={() => router.push('/messages')}
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0
                  ? `View messages, ${unreadCount} unread`
                  : 'View messages'
              }
              style={styles.topMessageBtn}
            >
              <Avatar
                initials={clientFullName ? initialsOf(clientFullName) : 'ME'}
                size={40}
              />
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.streakBadge}>
              <IconFlame size={12} color={T.amberMid} />
              <Text style={styles.streakBadgeText}>
                {streak} day streak
              </Text>
            </View>
          </View>
        </LinearGradient>

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
            {/* ── Coach Message Preview Card ── */}
            {latestMessage && (
              <TouchableOpacity
                onPress={() => router.push('/messages')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Open coach conversation"
                style={styles.coachCard}
              >
                <Avatar initials={coachInitials} size={36} />
                <View style={styles.coachCardContent}>
                  <View style={styles.coachCardHeaderRow}>
                    <Text style={styles.coachNameText}>{coachName}</Text>
                    <Text style={styles.coachTimeText}>
                      {fmtMessageTime(latestMessage.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.coachSnippetText} numberOfLines={2}>
                    {latestMessage.content}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ── Today's Tasks Checklist + Completion Ring ── */}
            <Card style={styles.tasksCard}>
              <TouchableOpacity
                onPress={toggleCollapsed}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Today's tasks, ${collapsed ? 'collapsed' : 'expanded'}. Tap to ${
                  collapsed ? 'expand' : 'collapse'
                }`}
                accessibilityState={{ expanded: !collapsed }}
                style={[
                  styles.tasksHeaderRow,
                  collapsed && styles.tasksHeaderRowCollapsed,
                ]}
              >
                <View style={styles.tasksHeaderLeft}>
                  <SectionLabel style={styles.taskSectionLabel}>
                    TODAY'S TASKS
                  </SectionLabel>
                  <Text
                    style={[
                      styles.tasksSubtitle,
                      { color: allTasksDone ? T.successMid : T.onSurface },
                    ]}
                  >
                    {allTasksDone ? (
                      <Text style={{ color: T.successMid }}>✓ All done!</Text>
                    ) : (
                      `${tasks.length - doneCount} task${
                        tasks.length - doneCount !== 1 ? 's' : ''
                      } remaining`
                    )}
                  </Text>
                </View>
                <View style={styles.tasksHeaderRight}>
                  <CompletionRing done={doneCount} total={tasks.length} size={72} />
                  <Ionicons
                    name={collapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={T.muted}
                    style={styles.chevronIcon}
                  />
                </View>
              </TouchableOpacity>

              {!collapsed && (
                <View style={styles.taskList}>
                  {tasks.map((task, i) => (
                    <TouchableOpacity
                      key={task.id}
                      onPress={task.onTap}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${task.label}, ${
                        task.done ? 'completed' : 'incomplete'
                      }`}
                      style={[
                        styles.taskRow,
                        i > 0 && styles.taskRowBorder,
                      ]}
                    >
                      <View
                        style={[
                          styles.taskCheckbox,
                          task.done
                            ? styles.taskCheckboxDone
                            : styles.taskCheckboxEmpty,
                        ]}
                      >
                        {task.done && <IconCheck size={12} color={T.white} strokeWidth={2.5} />}
                      </View>
                      <Chip
                        iconKey={task.iconKey}
                        size={14}
                        bg={task.done ? T.surfaceLow : task.chipBg}
                        color={task.done ? T.muted : task.chipColor}
                        chipSize={28}
                        radius={7}
                      />
                      <Text
                        style={[
                          styles.taskLabel,
                          task.done && styles.taskLabelDone,
                        ]}
                      >
                        {task.label}
                      </Text>
                      {task.optional && (
                        <View style={styles.optionalBadge}>
                          <Text style={styles.optionalBadgeText}>optional</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            {/* ── Stats Row (Weight & Steps) ── */}
            <View style={styles.statsGrid}>
              {/* Weight Stat Card */}
              <Card style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>WEIGHT</Text>
                  <Chip
                    iconKey="scale"
                    size={12}
                    bg="#e8f1fb"
                    color={T.primary}
                    chipSize={24}
                    radius={6}
                  />
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>
                    {currentWeightVal !== null
                      ? currentWeightVal.toFixed(1)
                      : '—'}
                  </Text>
                  <Text style={styles.statUnit}>kg</Text>
                </View>
                <Text
                  style={[
                    styles.statDelta,
                    {
                      color:
                        weightDeltaText === 'No prev log'
                          ? T.muted
                          : weightDeltaIsGood
                          ? T.successMid
                          : T.redMid,
                    },
                  ]}
                >
                  {weightDeltaText}
                </Text>
              </Card>

              {/* Steps Stat Card */}
              <Card style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>STEPS</Text>
                  <Chip
                    iconKey="steps"
                    size={12}
                    bg={T.successBg}
                    color={T.success}
                    chipSize={24}
                    radius={6}
                  />
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>
                    {currentStepsVal !== null
                      ? currentStepsVal.toLocaleString()
                      : '—'}
                  </Text>
                  <Text style={styles.statUnit}>steps</Text>
                </View>
                <Text
                  style={[
                    styles.statDelta,
                    {
                      color:
                        stepsDeltaText === 'No prev log'
                          ? T.muted
                          : stepsDeltaIsGood
                          ? T.successMid
                          : T.redMid,
                    },
                  ]}
                >
                  {stepsDeltaText}
                </Text>
              </Card>
            </View>

            {/* ── One panel titled "Today": Steps+Weight, Weight OCR,
                Meal budget/slices, Questions — one Card, light dividers
                between subsections instead of separate card boundaries. ── */}
            <Card style={styles.todayPanel}>
              <Text style={styles.todayPanelTitle}>Today</Text>

              {/* Subsection 1+2: Steps + Weight, with the Weight-OCR
                  "From photo" control and its feedback (from-photo tag,
                  retake banner, manual-fallback hint) inline on the
                  weight field they belong to — COACHOS.md items 1 and 2
                  describe these as one flowing block, not two card zones. */}
              <View style={styles.panelSubsection}>
              <View style={styles.formCardHeader}>
                <Chip
                  iconKey="scale"
                  size={13}
                  bg="#e8f1fb"
                  color={T.primary}
                  chipSize={26}
                  radius={7}
                />
                <Text style={styles.formCardTitle}>STEPS &amp; WEIGHT</Text>
              </View>

              <FieldLabel>Steps</FieldLabel>
              <TextInput
                ref={stepsInputRef}
                style={[styles.input, submitSuccess && styles.inputSaved]}
                value={steps}
                editable={!submitSuccess}
                onChangeText={(v) => {
                  setSteps(v);
                  setSubmitSuccess(false);
                  markManualOverrideToday(getTodayISO());
                }}
                placeholder="e.g. 8000"
                placeholderTextColor={T.muted}
                keyboardType="numeric"
                returnKeyType="next"
              />

              <FieldLabel>Weight (kg)</FieldLabel>
              <View style={styles.weightRow}>
                <TextInput
                  ref={weightInputRef}
                  style={[
                    styles.input,
                    styles.weightInput,
                    { marginBottom: 0 },
                    submitSuccess && styles.inputSaved,
                  ]}
                  value={weight}
                  editable={!submitSuccess}
                  onChangeText={(v) => {
                    setWeight(v);
                    setSubmitSuccess(false);
                    setWeightOcrState((s) => ({ ...s, suggestedValue: null }));
                  }}
                  placeholder="e.g. 72.5"
                  placeholderTextColor={T.muted}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.weightCameraButton}
                  onPress={handleFromPhotoPress}
                  disabled={weightOcrBusy || submitSuccess}
                  accessibilityRole="button"
                  accessibilityLabel="Log weight from a photo"
                >
                  {weightOcrBusy ? (
                    <ActivityIndicator size="small" color={T.primary} />
                  ) : (
                    <Ionicons name="camera" size={20} color={T.primary} />
                  )}
                </TouchableOpacity>
              </View>

              {weight.length > 0 &&
                weightOcrState.suggestedValue !== null &&
                weight === String(weightOcrState.suggestedValue) && (
                  <View style={styles.fromPhotoRow}>
                    <Ionicons name="image" size={13} color={T.success} />
                    <Text style={styles.fromPhotoText}>From photo</Text>
                  </View>
                )}

              {weightOcrState.status === 'retake_prompt' && (
                <View style={styles.retakeBanner}>
                  <Text style={styles.retakeBannerText}>
                    Couldn't read the number — try again?
                  </Text>
                  <TouchableOpacity
                    onPress={handleFromPhotoPress}
                    accessibilityRole="button"
                    accessibilityLabel="Retake weight photo"
                  >
                    <Text style={styles.retakeBannerAction}>Retake</Text>
                  </TouchableOpacity>
                </View>
              )}

              {weightOcrState.status === 'manual_fallback' && (
                <Text style={styles.manualFallbackHint}>
                  Photo saved — enter your weight below.
                </Text>
              )}
              </View>

              <View style={styles.panelDivider} />

              {/* Subsection 3: Meal */}
              <View style={styles.panelSubsection}>
              <View style={styles.formCardHeader}>
                <Chip
                  iconKey="utensils"
                  size={13}
                  bg={T.amberBg}
                  color={T.amber}
                  chipSize={26}
                  radius={7}
                />
                <Text style={styles.formCardTitle}>MEAL</Text>
              </View>

              {/* Meal limit is the hero — big kcal left + bar */}
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
                        Math.min(100, (kcalLeft / MEAL_CAP) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>

              {/* The four sitting slices ARE the sitting selector — no
                  separate "which sitting" picker. */}
              <View style={styles.sittingSlicesRow}>
                {MEAL_OPTIONS.map((opt) => {
                  const sliceState = sittingSliceState(
                    opt.type,
                    selectedMealType,
                    loggedMealTypes
                  );
                  return (
                    <TouchableOpacity
                      key={opt.type}
                      style={[
                        styles.sittingSlice,
                        sliceState === 'selected' && styles.sittingSliceSelected,
                        sliceState === 'filled' && styles.sittingSliceFilled,
                      ]}
                      onPress={() => handleMealTypeChange(opt.type)}
                      disabled={submitSuccess}
                      accessibilityRole="button"
                      accessibilityLabel={`${opt.label}, ${MEAL_KCAL[opt.type]} kcal, ${
                        sliceState === 'filled'
                          ? 'logged'
                          : sliceState === 'selected'
                          ? 'selected, not yet saved'
                          : 'not logged'
                      }`}
                      accessibilityState={{ selected: sliceState !== 'empty' }}
                    >
                      <Text
                        style={[
                          styles.sittingSliceLabel,
                          sliceState === 'filled' && styles.sittingSliceLabelFilled,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        style={[
                          styles.sittingSliceKcal,
                          sliceState === 'filled' && styles.sittingSliceKcalFilled,
                        ]}
                      >
                        {MEAL_KCAL[opt.type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <FieldLabel style={styles.quietFieldLabel}>Description</FieldLabel>
              <TextInput
                ref={mealInputRef}
                style={[
                  styles.input,
                  styles.multiline,
                  ((mealDescription.trim().length > 0 && !mealDescriptionFocused) ||
                    submitSuccess) &&
                    styles.inputSaved,
                ]}
                value={mealDescription}
                editable={!submitSuccess}
                onChangeText={(v) => {
                  setMealDescription(v);
                  setSubmitSuccess(false);
                  if (selectedMealType) {
                    setMealEntries((prev) => ({
                      ...prev,
                      [selectedMealType]: {
                        ...prev[selectedMealType],
                        description: v,
                      },
                    }));
                  }
                }}
                onFocus={() => setMealDescriptionFocused(true)}
                onBlur={() => setMealDescriptionFocused(false)}
                placeholder={
                  selectedMealType
                    ? `What did you have for ${selectedMealType}?`
                    : 'Tap a sitting above, then describe your meal'
                }
                placeholderTextColor={T.muted}
                multiline
                numberOfLines={4}
                maxLength={1000}
                textAlignVertical="top"
              />

              <FieldLabel style={styles.quietFieldLabel}>Photo (optional)</FieldLabel>
              {photoUri || existingPhotoKey ? (
                <View style={[styles.photoRow, { marginBottom: 0 }]}>
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
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
                    onPress={handlePickPhoto}
                    disabled={submitSuccess}
                    accessibilityRole="button"
                    accessibilityLabel="Edit meal photo"
                  >
                    <Ionicons name="pencil" size={15} color={T.primary} />
                    <Text style={styles.editPhotoButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.photoButton, { marginBottom: 0 }]}
                  onPress={handlePickPhoto}
                  disabled={submitSuccess}
                >
                  <Text style={styles.photoButtonText}>
                    {selectedMealType
                      ? `Add ${selectedMealType} photo`
                      : 'Add meal photo'}
                  </Text>
                </TouchableOpacity>
              )}
              </View>

              <View style={styles.panelDivider} />

              {/* Subsection 4: Questions */}
              <View style={[styles.panelSubsection, styles.panelSubsectionLast]}>
              <View style={styles.formCardHeader}>
                <Chip
                  iconKey="chat"
                  size={13}
                  bg="#ede9fe"
                  color="#6d28d9"
                  chipSize={26}
                  radius={7}
                />
                <Text style={styles.formCardTitle}>QUESTIONS</Text>
              </View>

              <FieldLabel>Questions for your coach</FieldLabel>
              <TextInput
                ref={questionsInputRef}
                style={[
                  styles.input,
                  styles.multiline,
                  { marginBottom: 0 },
                  submitSuccess && styles.inputSaved,
                ]}
                value={questions}
                editable={!submitSuccess}
                onChangeText={(v) => {
                  setQuestions(v);
                  setSubmitSuccess(false);
                }}
                placeholder="Any questions or notes for your coach"
                placeholderTextColor={T.muted}
                multiline
                numberOfLines={4}
                maxLength={2000}
                textAlignVertical="top"
              />
              </View>
            </Card>

            {submitError !== null && (
              <Text style={styles.submitError}>{submitError}</Text>
            )}

            <Btn
              variant="primary"
              onPress={submitSuccess ? () => setSubmitSuccess(false) : handleSubmit}
              disabled={submitting || (!submitSuccess && blocked)}
              accessibilityLabel={
                submitSuccess ? "Edit today's log" : "Submit today's log"
              }
              style={styles.submitButton}
            >
              {submitting ? (
                <ActivityIndicator color={T.white} />
              ) : submitSuccess ? (
                'Edit'
              ) : (
                "Submit today's log"
              )}
            </Btn>

            <Animated.Text
              style={[styles.successText, { opacity: submitSuccessAnim }]}
            >
              Logged ✓
            </Animated.Text>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 52,
    // Bottom padding clears the floating capsule tab bar (~64px tall,
    // floated `insets.bottom + 16` above the screen edge — see
    // (client)/_layout.tsx) plus breathing room for the largest expected
    // safe-area inset.
    paddingBottom: 140,
    // Transparent so the peach -> blue sky wash (screenWashColors, rendered
    // behind this ScrollView) shows through around the frosted Cards.
    backgroundColor: 'transparent',
  },
  greetingHeader: {
    marginHorizontal: -20,
    marginTop: -52,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greetingLeft: {
    flex: 1,
    paddingRight: 12,
  },
  greetingSub: {
    fontSize: 12,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  greetingName: {
    marginTop: 2,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    fontSize: 26,
    letterSpacing: -0.2,
    color: T.onSurface,
  },
  greetingDate: {
    marginTop: 2,
    fontSize: 12,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  greetingRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  topMessageBtn: {
    position: 'relative',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T.amberBg,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakBadgeText: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    color: T.amber,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.redMid,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: T.white,
  },
  unreadBadgeText: {
    color: T.white,
    fontSize: 10,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  // coachCard stays a TouchableOpacity (not wrapped in the Card component,
  // which renders a View) so it matches Card's exact recipe by hand: 24px
  // radius, translucent white fill, translucent white border, cardShadow.
  // The navy left-accent border is layered on top of that base border.
  coachCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: T.primary,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    ...cardShadow,
  },
  coachCardContent: {
    flex: 1,
    minWidth: 0,
  },
  coachCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  coachNameText: {
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    fontSize: 13,
    color: T.primary,
  },
  coachTimeText: {
    fontSize: 10,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  coachSnippetText: {
    fontSize: 12,
    color: T.onSurfaceVar,
    fontFamily: fontFamily.bodyRegular,
    lineHeight: 17,
  },
  // tasksCard/statCard are now rendered through the <Card> primitive
  // (lib/design-system.tsx) — these style objects only carry overrides
  // (padding/margin/flex) layered on top of Card's own 24px radius,
  // translucent fill, border, and shadow.
  tasksCard: {
    padding: 18,
    marginBottom: 12,
  },
  tasksHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tasksHeaderRowCollapsed: {
    marginBottom: 0,
  },
  tasksHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  tasksHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronIcon: {
    marginLeft: 2,
  },
  taskSectionLabel: {
    marginBottom: 4,
  },
  tasksSubtitle: {
    fontSize: 14,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.onSurface,
  },
  taskList: {
    marginTop: 4,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  taskRowBorder: {
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskCheckboxDone: {
    backgroundColor: T.primary,
  },
  taskCheckboxEmpty: {
    backgroundColor: T.surfaceLow,
  },
  taskLabel: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
    color: T.onSurface,
  },
  taskLabelDone: {
    color: T.muted,
    textDecorationLine: 'line-through',
  },
  optionalBadge: {
    backgroundColor: T.surfaceLow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.muted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
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
    gap: 3,
  },
  statValue: {
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    fontSize: 22,
    color: T.onSurface,
  },
  statUnit: {
    fontSize: 11,
    color: T.muted,
    fontFamily: fontFamily.bodyRegular,
  },
  statDelta: {
    fontSize: 11,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    marginTop: 2,
  },
  // Single "Today" panel (Card, unmodified 24px/frosted-fill/border from
  // lib/design-system.tsx) wrapping Steps+Weight, Weight OCR, Meal, and
  // Questions as light-divider-separated subsections instead of three
  // separate Card boundaries. No radius/padding override here — letting
  // Card's own 24px win is the point (see formCard finding).
  todayPanel: {
    marginBottom: 12,
  },
  todayPanelTitle: {
    fontSize: 20,
    fontFamily: fontFamily.headingBold,
    fontWeight: '700',
    color: T.onSurface,
    marginBottom: 16,
  },
  panelSubsection: {
    marginBottom: 4,
  },
  panelSubsectionLast: {
    marginBottom: 0,
  },
  panelDivider: {
    height: 1,
    backgroundColor: T.border,
    marginVertical: 16,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  formCardTitle: {
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  statusWord: {
    marginTop: 4,
  },
  mealHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
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
    marginBottom: 16,
  },
  mealHeroBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: T.primary,
  },
  sittingSlicesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sittingSlice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.white,
  },
  sittingSliceSelected: {
    borderColor: T.primary,
    borderWidth: 2,
    backgroundColor: T.primaryLight,
  },
  sittingSliceFilled: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  sittingSliceLabel: {
    fontSize: 12,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.onSurface,
  },
  sittingSliceLabelFilled: {
    color: T.white,
  },
  sittingSliceKcal: {
    fontSize: 11,
    fontFamily: fontFamily.bodyRegular,
    color: T.muted,
    marginTop: 2,
  },
  sittingSliceKcalFilled: {
    color: 'rgba(255,255,255,0.8)',
  },
  quietFieldLabel: {
    fontSize: 9,
    opacity: 0.65,
    marginBottom: 4,
  },
  input: {
    ...inputStyle,
    marginBottom: 16,
  },
  multiline: {
    minHeight: 96,
    paddingTop: 11,
    textAlignVertical: 'top',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
  },
  weightCameraButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fromPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  fromPhotoText: {
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
    color: T.success,
  },
  retakeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.redBg,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  retakeBannerText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyMedium,
    color: T.red,
    flex: 1,
    marginRight: 8,
  },
  retakeBannerAction: {
    fontSize: 13,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.primary,
  },
  manualFallbackHint: {
    fontSize: 12,
    fontFamily: fontFamily.bodyRegular,
    color: T.muted,
    marginTop: 6,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  thumbnail: {
    width: 80,
    height: 80,
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
    fontSize: 14,
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
    fontSize: 14,
    fontFamily: fontFamily.bodyMedium,
    color: T.primary,
  },
  inputSaved: {
    backgroundColor: T.surfaceLow,
    color: T.onSurfaceVar,
  },
  photoButton: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: T.white,
    marginBottom: 16,
    ...cardShadow,
  },
  photoButtonText: {
    fontSize: 14,
    fontFamily: fontFamily.bodyMedium,
    color: T.onSurfaceVar,
  },
  submitError: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 20,
  },
  submitButton: {
    marginTop: 12,
  },
  successText: {
    color: T.success,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});
