import {
  getSdkStatus,
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { withTimeout } from './withTimeout';

/**
 * Weight via Health Connect — a genuinely new capability (there was no
 * prior weight data source besides OCR/manual entry). Reads the most
 * recent WeightRecord within a wide lookback window (not "today only"
 * — unlike steps, a user doesn't necessarily weigh in daily, but a
 * recent reading from any synced source, e.g. a smart scale app, is
 * still the right value to suggest). Mirrors stepsHealthConnect.ts's
 * structure and timeout discipline exactly.
 */

export type WeightHealthConnectResult =
  | { status: 'ok'; weightKg: number }
  | { status: 'no_data' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error' };

const WEIGHT_PERMISSION = { accessType: 'read' as const, recordType: 'Weight' as const };
const QUERY_TIMEOUT_MS = 6000;
const PERMISSION_DIALOG_TIMEOUT_MS = 60000;
// How far back to look for the most recent weight reading. Wide on
// purpose — weight isn't logged daily the way steps accumulate.
const LOOKBACK_DAYS = 90;

export async function isHealthConnectAvailable(): Promise<boolean> {
  try {
    const status = await withTimeout(getSdkStatus(), QUERY_TIMEOUT_MS, 'HealthConnect.getSdkStatus');
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

// See stepsHealthConnect.ts: initialize() must run before getGrantedPermissions
// or requestPermission, or they throw and the permission dialog never shows.
// Idempotent, so safe to call at the start of each permission op.
async function ensureInitialized(): Promise<boolean> {
  try {
    return await withTimeout(initialize(), QUERY_TIMEOUT_MS, 'HealthConnect.initialize(weight)');
  } catch {
    return false;
  }
}

export async function hasWeightPermission(): Promise<boolean> {
  try {
    if (!(await ensureInitialized())) return false;
    const granted = await withTimeout(
      getGrantedPermissions(),
      QUERY_TIMEOUT_MS,
      'HealthConnect.getGrantedPermissions(weight)'
    );
    return granted.some((p) => 'recordType' in p && p.recordType === 'Weight' && p.accessType === 'read');
  } catch {
    return false;
  }
}

export async function requestWeightPermission(): Promise<boolean> {
  try {
    if (!(await ensureInitialized())) return false;
    const granted = await withTimeout(
      requestPermission([WEIGHT_PERMISSION]),
      PERMISSION_DIALOG_TIMEOUT_MS,
      'HealthConnect.requestPermission(weight)'
    );
    return granted.some((p) => 'recordType' in p && p.recordType === 'Weight' && p.accessType === 'read');
  } catch {
    return false;
  }
}

function getLookbackRange(): { startTime: string; endTime: string } {
  const now = new Date();
  const start = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return { startTime: start.toISOString(), endTime: now.toISOString() };
}

/**
 * Reads the single most recent Weight record in the lookback window,
 * already unit-converted to kilograms by the native layer (Health
 * Connect's read result carries `inKilograms` directly — no manual
 * unit-string conversion needed on this side, regardless of what unit
 * the original source app recorded in).
 */
export async function readLatestWeight(): Promise<WeightHealthConnectResult> {
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return { status: 'unavailable' };

    const initialized = await withTimeout(initialize(), QUERY_TIMEOUT_MS, 'HealthConnect.initialize(weight)');
    if (!initialized) return { status: 'unavailable' };

    const hasPermission = await hasWeightPermission();
    if (!hasPermission) return { status: 'denied' };

    const { startTime, endTime } = getLookbackRange();
    const timeRangeFilter = { operator: 'between' as const, startTime, endTime };

    const result = await withTimeout(
      readRecords('Weight', { timeRangeFilter, ascendingOrder: false, pageSize: 1 }),
      QUERY_TIMEOUT_MS,
      'HealthConnect.readRecords(Weight)'
    );

    const latest = result.records[0];
    if (!latest || typeof latest.weight.inKilograms !== 'number') {
      return { status: 'no_data' };
    }

    return { status: 'ok', weightKg: latest.weight.inKilograms };
  } catch {
    return { status: 'error' };
  }
}
