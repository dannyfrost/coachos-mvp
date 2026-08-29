import {
  getSdkStatus,
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  aggregateRecord,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

/**
 * Thin, isolated wrapper around react-native-health-connect. No sync
 * decision logic here — that lives in stepsSync.ts. Mirrors how
 * weightOcr.ts isolates the native OCR call from the UI/state layer.
 */

export type HealthConnectReadResult =
  | { status: 'ok'; steps: number }
  | { status: 'no_data' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error' };

const STEPS_PERMISSION = { accessType: 'read' as const, recordType: 'Steps' as const };

export async function isHealthConnectAvailable(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function hasStepsPermission(): Promise<boolean> {
  try {
    const granted = await getGrantedPermissions();
    return granted.some(
      (p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read'
    );
  } catch {
    return false;
  }
}

export async function requestStepsPermission(): Promise<boolean> {
  try {
    const granted = await requestPermission([STEPS_PERMISSION]);
    return granted.some(
      (p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read'
    );
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
 * Reads today's cumulative step count. Distinguishes a genuine "no
 * Steps records exist for today" (no_data) from "records exist and
 * sum to a real value, including zero" (ok, steps: 0) — the aggregate
 * API alone can't tell these apart (its COUNT_TOTAL is a plain
 * non-optional number), so this does a cheap readRecords presence
 * check first.
 */
export async function readTodaySteps(): Promise<HealthConnectReadResult> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return { status: 'unavailable' };

    const initialized = await initialize();
    if (!initialized) return { status: 'unavailable' };

    const hasPermission = await hasStepsPermission();
    if (!hasPermission) return { status: 'denied' };

    const { startTime, endTime } = getTodayRange();
    const timeRangeFilter = { operator: 'between' as const, startTime, endTime };

    const presenceCheck = await readRecords('Steps', {
      timeRangeFilter,
      pageSize: 1,
    });
    if (presenceCheck.records.length === 0) {
      return { status: 'no_data' };
    }

    const aggregate = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter,
    });

    if (!aggregate || typeof aggregate.COUNT_TOTAL !== 'number') {
      return { status: 'no_data' };
    }

    return { status: 'ok', steps: aggregate.COUNT_TOTAL };
  } catch {
    return { status: 'error' };
  }
}
