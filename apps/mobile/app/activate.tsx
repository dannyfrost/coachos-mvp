import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  Theme,
  useTheme,
  fontFamily,
  Btn,
  FieldLabel,
  inputStyleFor,
} from '../lib/design-system';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

function getErrorMessage(status: number, json: { error?: string }): string {
  switch (status) {
    case 400:
      return json.error ?? 'Token and password are required.';
    case 401:
      return 'Invalid or expired activation token. Ask your coach to re-invite you.';
    case 403:
      return 'Your account is not available. Please contact your coach.';
    case 409:
      return 'This account is already activated. Please log in instead.';
    case 422:
      return 'Password not accepted. Try a stronger password.';
    default:
      return 'Something went wrong. Check your connection and try again.';
  }
}

export default function ActivateScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.token) {
      setToken(params.token);
    }
  }, [params.token]);

  async function handleActivate() {
    setError(null);

    if (!token.trim()) {
      setError('Activation token is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/client-activation/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      const json = await res.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };

      if (!res.ok) {
        setError(getErrorMessage(res.status, json));
        return;
      }

      const supabase = createMobileSupabaseClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: json.access_token!,
        refresh_token: json.refresh_token!,
      });

      if (sessionError) {
        setError('Activation complete but could not sign in. Please try again.');
        return;
      }

      const parsedAge = age.trim() ? parseInt(age, 10) : undefined;
      const parsedHeight = heightCm.trim() ? parseInt(heightCm, 10) : undefined;
      const trimmedNotes = conditionNotes.trim() || undefined;
      if (parsedAge !== undefined || parsedHeight !== undefined || trimmedNotes !== undefined) {
        try {
          await supabase.rpc('update_client_profile', {
            p_age: parsedAge,
            p_height_cm: parsedHeight,
            p_condition_notes: trimmedNotes,
          });
        } catch {
          // Non-blocking: profile info can always be added later from Settings.
        }
      }

      router.replace('/(client)/home');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.screenBg }}>
      <LinearGradient
        colors={T.washColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Activate Your Account</Text>
        <Text style={styles.subtitle}>
          Enter the activation token your coach shared with you, then set a password.
        </Text>

        <FieldLabel>Activation Token</FieldLabel>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="Paste your activation token"
          placeholderTextColor={T.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        <FieldLabel>Password</FieldLabel>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor={T.muted}
          secureTextEntry
          returnKeyType="next"
        />

        <FieldLabel>Confirm Password</FieldLabel>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter password"
          placeholderTextColor={T.muted}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleActivate}
        />

        <Text style={styles.sectionHint}>
          Optional — helps your coach personalize your plan. You can also add this later in Settings.
        </Text>

        <FieldLabel>Age</FieldLabel>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="e.g. 32"
          placeholderTextColor={T.muted}
          keyboardType="number-pad"
          returnKeyType="next"
        />

        <FieldLabel>Height (cm)</FieldLabel>
        <TextInput
          style={styles.input}
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="e.g. 175"
          placeholderTextColor={T.muted}
          keyboardType="number-pad"
          returnKeyType="next"
        />

        <FieldLabel>Medical conditions</FieldLabel>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={conditionNotes}
          onChangeText={setConditionNotes}
          placeholder="e.g. Knee injury, asthma — leave blank if none"
          placeholderTextColor={T.muted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <Btn
          variant="primary"
          onPress={handleActivate}
          disabled={loading}
          accessibilityLabel="Activate account"
          style={styles.button}
        >
          {loading ? <ActivityIndicator color={T.onPrimary} /> : 'Activate Account'}
        </Btn>

        <TouchableOpacity
          onPress={() => router.push('/login')}
          style={styles.switchLink}
          accessibilityRole="button"
          accessibilityLabel="Already activated? Log in"
        >
          <Text style={styles.switchLinkText}>
            Already activated?{' '}
            <Text style={styles.switchLinkHighlight}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (T: Theme) =>
  StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 24,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    color: T.onSurface,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fontFamily.bodyRegular,
    color: T.onSurfaceVar,
    lineHeight: 20,
    marginBottom: 32,
  },
  input: {
    ...inputStyleFor(T),
    marginBottom: 16,
  },
  multiline: {
    minHeight: 80,
    paddingTop: 12,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: fontFamily.bodyRegular,
    color: T.muted,
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 17,
  },
  error: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
  },
  switchLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchLinkText: {
    fontSize: 14,
    fontFamily: fontFamily.bodyRegular,
    color: T.onSurfaceVar,
  },
  switchLinkHighlight: {
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.primary,
  },
});
