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
} from 'react-native';
import { router } from 'expo-router';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);

    const supabase = createMobileSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      router.replace('/activate');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('platform_users')
        .select('full_name, email')
        .eq('id', session.user.id)
        .single();

      if (error || !data) {
        setFetchError(true);
      } else {
        setFullName(data.full_name ?? '');
        setEmail(data.email ?? '');
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
        setPasswordError(error.message || 'Could not update password. Try again.');
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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createMobileSupabaseClient();
      await supabase.auth.signOut();
      router.replace('/activate');
    } catch {
      router.replace('/activate');
    } finally {
      setLoggingOut(false);
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
            color="#111"
            style={styles.loadingIndicator}
          />
        ) : (
          <>
            <Text style={styles.sectionLabel}>PROFILE</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Name</Text>
              <Text style={styles.fieldValue}>{fullName || '—'}</Text>

              <View style={styles.divider} />

              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{email || '—'}</Text>
            </View>

            <Text style={styles.sectionLabel}>CHANGE PASSWORD</Text>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>New password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  setPasswordSuccess(false);
                  setPasswordError(null);
                }}
                placeholder="At least 8 characters"
                secureTextEntry
                returnKeyType="next"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                Confirm new password
              </Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setPasswordSuccess(false);
                  setPasswordError(null);
                }}
                placeholder="Re-enter new password"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleChangePassword}
              />

              {passwordError !== null && (
                <Text style={styles.errorText}>{passwordError}</Text>
              )}

              {passwordSuccess && (
                <Text style={styles.successText}>Password updated ✓</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  savingPassword && styles.buttonDisabled,
                ]}
                onPress={handleChangePassword}
                disabled={savingPassword}
                accessibilityRole="button"
                accessibilityLabel="Update password"
              >
                {savingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
              onPress={handleLogout}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              {loggingOut ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <Text style={styles.logoutButtonText}>Log Out</Text>
              )}
            </TouchableOpacity>
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
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
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  successText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
