import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Thin guarded wrapper around expo-haptics. No-op on web, and every call is
// fire-and-forget + swallowed so a haptics failure can never break a flow.
// ponytail: fixed vibration vocabulary; expand only if a screen needs a cue
// these three don't cover.

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tick for selection changes (tab switch, chip/segment pick). */
export function selection(): void {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Impact for a committed tap (row action, toggle). */
export function impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
  if (!enabled) return;
  Haptics.impactAsync(style).catch(() => {});
}

/** Success / warning / error notification (save succeeded, validation failed). */
export function notify(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success
): void {
  if (!enabled) return;
  Haptics.notificationAsync(type).catch(() => {});
}

export { Haptics };
