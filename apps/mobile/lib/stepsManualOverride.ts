import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tracks whether the client manually edited the Steps field today, so
 * automatic sync (foreground or background) never overwrites it for
 * the rest of that day. A new day naturally clears the override: this
 * just compares the stored date against today rather than needing an
 * explicit reset — "the important state is: manual override today?".
 */

const STORAGE_KEY = 'coachos.steps.manualOverrideDate';

export async function markManualOverrideToday(todayISO: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, todayISO);
  } catch {
    // Best-effort: if storage fails, worst case a sync overwrites a
    // manual edit once. Never let this crash the Daily Log.
  }
}

export async function isManualOverrideActiveToday(todayISO: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored === todayISO;
  } catch {
    return false;
  }
}
