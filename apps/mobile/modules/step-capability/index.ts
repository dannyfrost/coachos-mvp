// Imported from `expo` (a direct dep that publicly re-exports it) rather than
// from `expo-modules-core` directly: the latter is only a transitive dep here
// and pnpm does not surface it for a bare import, so `tsc` can't resolve it.
import { requireNativeModule } from 'expo';

/**
 * Raw, authoritative on-device step-collection capability, read from the
 * native layer (see android/.../StepCapabilityModule.kt). JS cannot read the
 * SDK extension version or query for a specific hardware sensor, so this is a
 * thin native bridge — the ONLY place those facts are sourced.
 *
 * Deliberately Android-only. On any other platform (or if the native module is
 * missing from a given build) the native require throws; lib/stepsCapability.ts
 * wraps this call in try/catch and returns a safe "unsupported/unknown" result.
 */
export type StepCapability = {
  /** Build.VERSION.SDK_INT */
  apiLevel: number;
  /** SdkExtensions.getExtensionVersion(34); 0 below API 30 or if unavailable */
  sdkExtension34: number;
  /** A TYPE_STEP_COUNTER sensor (or the step-counter system feature) is present */
  hasStepCounterSensor: boolean;
};

// Resolved lazily (not at import time) so merely importing this file can never
// crash on a platform/build without the native module.
type StepCapabilityNativeModule = { getStepCapability(): StepCapability };
let nativeModule: StepCapabilityNativeModule | null = null;

export function getStepCapability(): StepCapability {
  const mod =
    nativeModule ??
    (nativeModule = requireNativeModule<StepCapabilityNativeModule>('StepCapability'));
  return mod.getStepCapability();
}
