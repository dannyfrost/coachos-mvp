import { useEffect, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  T,
  fontFamily,
  Card,
  Btn,
  FieldLabel,
  inputStyle,
  screenBackground,
  screenWashColors,
} from '../lib/design-system';

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const supabase = createMobileSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/login');
      }
    }
    checkSession();
  }, []);

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createMobileSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(
          error.message || 'Could not update password. Try again.'
        );
      } else {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordError('Network error. Check your connection and try again.');
    } finally {
      setSavingPassword(false);
    }
  };

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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backLink}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.heading} numberOfLines={1}>
          Change Password
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <FieldLabel>New password</FieldLabel>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={(v) => {
              setNewPassword(v);
              setPasswordSuccess(false);
              setPasswordError(null);
            }}
            placeholder="At least 8 characters"
            placeholderTextColor={T.muted}
            secureTextEntry
            returnKeyType="next"
          />

          <View style={{ marginTop: 12 }}>
            <FieldLabel>Confirm new password</FieldLabel>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                setPasswordSuccess(false);
                setPasswordError(null);
              }}
              placeholder="Re-enter new password"
              placeholderTextColor={T.muted}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleChangePassword}
            />
          </View>

          {passwordError !== null && (
            <Text style={styles.errorText}>{passwordError}</Text>
          )}

          {passwordSuccess && (
            <Text style={styles.successText}>Password updated ✓</Text>
          )}

          <Btn
            variant="primary"
            onPress={handleChangePassword}
            disabled={savingPassword}
            accessibilityLabel="Update password"
            style={styles.saveButton}
          >
            {savingPassword ? (
              <ActivityIndicator color={T.white} />
            ) : (
              'Update Password'
            )}
          </Btn>
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    backgroundColor: T.surface,
  },
  backLink: {
    fontSize: 15,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.primary,
    marginBottom: 8,
  },
  heading: {
    fontSize: 22,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    color: T.onSurface,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: 'transparent',
  },
  card: {
    marginBottom: 10,
  },
  input: {
    ...inputStyle,
  },
  errorText: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  successText: {
    color: T.success,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  saveButton: {
    marginTop: 16,
  },
});
