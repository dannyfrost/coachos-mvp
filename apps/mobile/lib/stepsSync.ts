import type { StepsReadResult } from './stepsPedometer';

/**
 * Pure synchronization decision — no native calls, no storage, no
 * network. Used by both foreground sync (on Daily Log load) and the
 * background task, so the two paths can never disagree about what
 * "should I update the Steps field" means.
 */

export type StepsSyncDecision = { action: 'update'; value: number } | { action: 'skip' };

export function decideStepsSync(
  today: string,
  manualOverrideActiveToday: boolean,
  result: StepsReadResult
): StepsSyncDecision {
  void today; // carried for parity with debug logging call sites, not branched on

  if (manualOverrideActiveToday) return { action: 'skip' };

  if (result.status === 'ok') {
    return { action: 'update', value: result.steps };
  }

  // no_data / denied / unavailable / error: never overwrite whatever
  // value (manual or previously synced) is already on the log.
  return { action: 'skip' };
}
