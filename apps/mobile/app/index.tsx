import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import { T } from '../lib/design-system';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    createMobileSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        setHasSession(!!data.session);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  return hasSession ? (
    <Redirect href="/(client)/home" />
  ) : (
    <Redirect href="/login" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.surface,
  },
});
