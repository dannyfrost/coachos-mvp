import { useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  T,
  fontFamily,
  Btn,
  FieldLabel,
  inputStyle,
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
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      router.replace('/(client)/home');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <Btn
          variant="primary"
          onPress={handleActivate}
          disabled={loading}
          accessibilityLabel="Activate account"
          style={styles.button}
        >
          {loading ? <ActivityIndicator color={T.white} /> : 'Activate Account'}
        </Btn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: T.surface,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: T.surface,
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
    ...inputStyle,
    marginBottom: 16,
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
});
