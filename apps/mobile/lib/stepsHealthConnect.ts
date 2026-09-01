import {
  getSdkStatus,
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  aggregateRecord,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { withTimeout } from './stepsPedometer';

/**
 * Thin, isolated wrapper around react-native-health-connect. Re-added
 * 2026-09-01 as the PREFERRED steps source (Android 14+ has Health
 * Connect built into the OS, and its aggregate query can include
 * on-device step data automatically) — with the Pedometer sensor
 * (lib/stepsPedometer.ts) kept as a fallback tier below it, not
 * replaced. This was previously removed entirely because Health
 * Connect requires a separate provider app/service on Android <14
 * (silently unavailable on the real Android 13 test device this app
 * has actually been verified against), and that risk hasn't gone away
 * — only the tier ordering changed, so a device without the companion
 * app still gets working steps via the sensor tier instead of a silent
 * dead end. No sync-decision logic here — that lives in stepsSync.ts,
 * shared across both steps sources so they can never disagree about
 * what "should I update the Steps field" means.
 */

export type HealthConnectReadResult =
  | { status: 'ok'; steps: number }
  | { status: 'no_data' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error' };

const STEPS_PERMISSION = { accessType: 'read' as const, recordType: 'Steps' as const };

// Same reasoning as stepsPedometer.ts: background queries get a short
// bound (no user interaction, a hang past a few seconds is abnormal);
// the permission dialog gets a much longer one since it waits on a
// human tap.
const QUERY_TIMEOUT_MS = 6000;
const PERMISSION_DIALOG_TIMEOUT_MS = 60000;

export async function isHealthConnectAvailable(): Promise<boolean> {
  try {
    const status = await withTimeout(getSdkStatus(), QUERY_TIMEOUT_MS, 'HealthConnect.getSdkStatus');
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function hasStepsPermission(): Promise<boolean> {
  try {
    const granted = await withTimeout(
      getGrantedPermissions(),
      QUERY_TIMEOUT_MS,
      'HealthConnect.getGrantedPermissions'
    );
    return granted.some((p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read');
  } catch {
    return false;
  }
}

export async function requestStepsPermission(): Promise<boolean> {
  try {
    const granted = await withTimeout(
      requestPermission([STEPS_PERMISSION]),
      PERMISSION_DIALOG_TIMEOUT_MS,
      'HealthConnect.requestPermission'
    );
    return granted.some((p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read');
  } catch {
    return false;
  }
}

function getTodayRange(): { startTime: string; endTime: string } {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { startTime: midnight.toISOString(), endTime: now.toISOString() };
}

/**
 * Reads today's cumulative step count via aggregate(STEPS_COUNT_TOTAL)
 * — not raw records fetched and manually summed, which would risk
 * double-counting across overlapping data sources. Distinguishes a
 * genuine "no Steps records exist for today" (no_data) from "records
 * exist and sum to a real value, including zero" (ok, steps: 0) — the
 * aggregate API alone can't tell these apart (its COUNT_TOTAL is a
 * plain non-optional number), so this does a cheap readRecords
 * presence check first.
 */
export async function readTodaySteps(): Promise<HealthConnectReadResult> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return { status: 'unavailable' };

    const initialized = await withTimeout(initialize(), QUERY_TIMEOUT_MS, 'HealthConnect.initialize');
    if (!initialized) return { status: 'unavailable' };

    const hasPermission = await hasStepsPermission();
    if (!hasPermission) return { status: 'denied' };

    const { startTime, endTime } = getTodayRange();
    const timeRangeFilter = { operator: 'between' as const, startTime, endTime };

    const presenceCheck = await withTimeout(
      readRecords('Steps', { timeRangeFilter, pageSize: 1 }),
      QUERY_TIMEOUT_MS,
      'HealthConnect.readRecords(Steps)'
    );
    if (presenceCheck.records.length === 0) {
      return { status: 'no_data' };
    }

    const aggregate = await withTimeout(
      aggregateRecord({ recordType: 'Steps', timeRangeFilter }),
      QUERY_TIMEOUT_MS,
      'HealthConnect.aggregateRecord(Steps)'
    );

    if (!aggregate || typeof aggregate.COUNT_TOTAL !== 'number') {
      return { status: 'no_data' };
    }

    return { status: 'ok', steps: aggregate.COUNT_TOTAL };
  } catch {
    return { status: 'error' };
  }
}
