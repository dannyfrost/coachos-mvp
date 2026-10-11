import { getStepCapability, type StepCapability } from '../modules/step-capability';

/**
 * Whether THIS device can natively collect its own steps for Health Connect.
 *
 * This is a SEPARATE question from Health Connect availability, permission
 * grant, or whether records exist (all handled in stepsHealthConnect.ts). It
 * exists so the UI can tell a user whose phone simply cannot auto-track steps
 * ("use a photo / enter manually") apart from a transient "no data yet" on a
 * device that can — instead of silently showing a false zero.
 *
 * Preconditions (official docs, developer.android.com/health-and-fitness/
 * health-connect/features/steps): Android 14 (API 34) + SDK extension >= 20 +
 * a TYPE_STEP_COUNTER sensor. Below that, Health Connect does no native
 * counting and steps must come from another app, a photo, or manual entry.
 */

export type StepUnsupportedReason =
  | 'old_android' // API < 34
  | 'old_sdk_extension' // API 34 but SDK extension < 20
  | 'no_sensor' // no TYPE_STEP_COUNTER
  | 'unknown'; // native module unavailable (non-Android build, etc.)

export type StepCollectionSupport =
  | { supported: true; capability: StepCapability }
  | { supported: false; reason: StepUnsupportedReason; capability: StepCapability | null };

const MIN_API = 34;
const MIN_SDK_EXTENSION = 20;

/**
 * Pure classification of a raw capability reading. Returns the FIRST failing
 * precondition (most informative to the user), or supported. Kept separate from
 * the native call so it is unit-testable without the native module.
 */
export function classifyStepCapability(cap: StepCapability): StepCollectionSupport {
  if (cap.apiLevel < MIN_API) return { supported: false, reason: 'old_android', capability: cap };
  if (cap.sdkExtension34 < MIN_SDK_EXTENSION) {
    return { supported: false, reason: 'old_sdk_extension', capability: cap };
  }
  if (!cap.hasStepCounterSensor) return { supported: false, reason: 'no_sensor', capability: cap };
  return { supported: true, capability: cap };
}

// Native capability is fixed for a given device + boot, so read it once.
let cached: StepCollectionSupport | null = null;

/**
 * Reads (and caches) this device's step-collection support. Any failure —
 * notably a build/platform without the native module — degrades to a safe
 * `unsupported / 'unknown'` result rather than throwing.
 */
export function getStepCollectionSupport(): StepCollectionSupport {
  if (cached) return cached;
  try {
    cached = classifyStepCapability(getStepCapability());
  } catch {
    cached = { supported: false, reason: 'unknown', capability: null };
  }
  return cached;
}

// Test seam: reset the memoized value (so a unit test can exercise re-reads).
export function _resetStepCapabilityCache(): void {
  cached = null;
}
