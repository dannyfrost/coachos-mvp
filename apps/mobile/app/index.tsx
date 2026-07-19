import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';

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
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return hasSession ? (
    <Redirect href="/(client)/home" />
  ) : (
    <Redirect href="/activate" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
