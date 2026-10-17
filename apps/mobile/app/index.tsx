import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import { Theme, useTheme } from '../lib/design-system';

export default function Index() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
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

const makeStyles = (T: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: T.screenBg,
    },
  });
