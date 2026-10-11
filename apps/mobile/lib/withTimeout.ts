/**
 * Bounds any native/bridge promise so callers always reach their
 * `finally`. A hung native call (a documented failure mode for RN
 * sensor/permission/Health-Connect bridges on some Android OEM skins —
 * the JS promise never resolves OR rejects) would otherwise leave
 * loading state stuck forever. This cannot cancel the underlying native
 * work, only stop waiting on it — the correct, standard mitigation for a
 * bridge call with no native cancellation API.
 *
 * Extracted from the old stepsPedometer.ts (removed 2026-10-09 — the
 * Pedometer step tier never worked on Android; see stepsHealthConnect.ts)
 * because stepsHealthConnect.ts still depends on it.
 */
export class NativeCallTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeCallTimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new NativeCallTimeoutError(`${label} timed out after ${ms}ms`));
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
