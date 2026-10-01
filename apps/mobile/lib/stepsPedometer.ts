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

/**
 * A hung native call (a documented failure mode for RN sensor/permission
 * bridges on some Android OEM skins — the JS promise never resolves OR
 * rejects) previously meant every caller's try/catch/finally never ran,
 * leaving loading state stuck forever. This guarantees every native call
 * this module makes always settles within a bounded time, so callers can
 * always reach their `finally`. It cannot cancel the underlying native
 * work, only stop waiting on it — that's the correct, standard mitigation
 * for a bridge call with no native cancellation API.
 */
export class PedometerTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PedometerTimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PedometerTimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Background status/data queries involve no user interaction, so a hang
// past a few seconds is always abnormal — kept short.
const QUERY_TIMEOUT_MS = 6000;
// The permission request shows a real OS dialog and waits for a human to
// tap it — needs a much longer bound than a background query, but still a
// bound, so a lost native callback (dialog shown but response never
// reaches JS) doesn't hang forever either.
const PERMISSION_DIALOG_TIMEOUT_MS = 60000;

export async function isPedometerAvailable(): Promise<boolean> {
  try {
    return await withTimeout(Pedometer.isAvailableAsync(), QUERY_TIMEOUT_MS, 'isAvailableAsync');
  } catch {
    return false;
  }
}

export async function hasStepsPermission(): Promise<boolean> {
  try {
    const { status } = await withTimeout(Pedometer.getPermissionsAsync(), QUERY_TIMEOUT_MS, 'getPermissionsAsync');
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestStepsPermission(): Promise<boolean> {
  try {
    const { status } = await withTimeout(
      Pedometer.requestPermissionsAsync(),
      PERMISSION_DIALOG_TIMEOUT_MS,
      'requestPermissionsAsync'
    );
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
    const result = await withTimeout(
      Pedometer.getStepCountAsync(start, end),
      QUERY_TIMEOUT_MS,
      'getStepCountAsync'
    );

    if (!result || typeof result.steps !== 'number') {
      return { status: 'no_data' };
    }

    return { status: 'ok', steps: result.steps };
  } catch (err) {
    // BUG-015: pedometer returns 'error' on some OEM devices (Infinix
    // X6528 / Unisoc) even with ACTIVITY_RECOGNITION granted and Step
    // Counter/Detector sensors present. The real exception was previously
    // swallowed by a bare catch, so root cause was undiagnosable. Log it
    // unconditionally (NOT __DEV__-gated) so it survives into preview/prod
    // logcat.
    const name = err instanceof Error ? err.name : 'Unknown';
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[stepsPedometer] readTodaySteps error: ${name}: ${message}`);
    if (err instanceof Error && err.stack) {
      console.warn(`[stepsPedometer] stack: ${err.stack}`);
    }
    return { status: 'error' };
  }
}
