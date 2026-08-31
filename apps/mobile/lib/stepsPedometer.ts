import { Pedometer } from 'expo-sensors';

/**
 * Thin, isolated wrapper around expo-sensors' Pedometer. Swapped in for
 * react-native-health-connect (2026-08-31): Health Connect requires a
 * separate provider app/service to be present on the device (absent or
 * disabled on plenty of real Android phones, especially non-Google-stock
 * ones), so its permission request silently no-ops (isAvailableAsync
 * false) with zero user-visible feedback when that provider is missing.
 * The step-counter hardware sensor Pedometer reads from is present on
 * effectively every modern Android/iOS phone and always shows a real OS
 * permission prompt. Mirrors how weightOcr.ts isolates the native OCR
 * call from the UI/state layer.
 */

export type StepsReadResult =
  | { status: 'ok'; steps: number }
  | { status: 'no_data' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error' };

export async function isPedometerAvailable(): Promise<boolean> {
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function hasStepsPermission(): Promise<boolean> {
  try {
    const { status } = await Pedometer.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestStepsPermission(): Promise<boolean> {
  try {
    const { status } = await Pedometer.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: midnight, end: now };
}

/**
 * Reads today's cumulative step count from the device's hardware step
 * counter. Unlike Health Connect there is no separate "does a record
 * exist" query — a successful read returning 0 (e.g. right after
 * midnight) is a legitimate value, not distinguished from "no data".
 */
export async function readTodaySteps(): Promise<StepsReadResult> {
  try {
    const available = await isPedometerAvailable();
    if (!available) return { status: 'unavailable' };

    const hasPermission = await hasStepsPermission();
    if (!hasPermission) return { status: 'denied' };

    const { start, end } = getTodayRange();
    const result = await Pedometer.getStepCountAsync(start, end);

    if (!result || typeof result.steps !== 'number') {
      return { status: 'no_data' };
    }

    return { status: 'ok', steps: result.steps };
  } catch {
    return { status: 'error' };
  }
}
