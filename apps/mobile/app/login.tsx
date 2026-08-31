import { useState } from 'react';
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
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  T,
  fontFamily,
  Btn,
  FieldLabel,
  inputStyle,
  screenBackground,
  screenWashColors,
} from '../lib/design-system';

function getLoginErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message).toLowerCase();
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid_credentials') ||
      msg.includes('invalid grant') ||
      msg.includes('invalid')
    ) {
      return 'Incorrect email or password.';
    }
  }
  return 'Could not log in. Try again.';
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createMobileSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(getLoginErrorMessage(signInError));
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
    <View style={screenBackground}>
      <LinearGradient
        colors={screenWashColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Log In</Text>
        <Text style={styles.subtitle}>
          Enter your email and password to access your account.
        </Text>

        <FieldLabel>Email</FieldLabel>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your.email@example.com"
          placeholderTextColor={T.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="next"
        />

        <FieldLabel>Password</FieldLabel>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={T.muted}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <Btn
          variant="primary"
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Log in"
          style={styles.button}
        >
          {loading ? <ActivityIndicator color={T.white} /> : 'Log In'}
        </Btn>

        <TouchableOpacity
          onPress={() => router.push('/activate')}
          style={styles.switchLink}
          accessibilityRole="button"
          accessibilityLabel="First time? Activate your account"
        >
          <Text style={styles.switchLinkText}>
            First time?{' '}
            <Text style={styles.switchLinkHighlight}>Activate your account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
