import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import { readTodaySteps } from './stepsPedometer';
import { decideStepsSync } from './stepsSync';
import { isManualOverrideActiveToday } from './stepsManualOverride';
import { getTodayISO } from './stats';

/**
 * Background half of steps auto-sync. Runs independently of any
 * mounted screen — must not import from home.tsx or any component.
 * Uses the exact same decideStepsSync logic as the foreground path
 * (wired in home.tsx) so the two can never disagree about whether to
 * write a new value.
 */

export const STEPS_BACKGROUND_TASK = 'coachos-steps-sync';

TaskManager.defineTask(STEPS_BACKGROUND_TASK, async () => {
  try {
    const today = getTodayISO();
    const result = await readTodaySteps();
    const overrideActive = await isManualOverrideActiveToday(today);
    const decision = decideStepsSync(today, overrideActive, result);

    if (__DEV__) {
      console.log('[stepsBackgroundTask]', { today, result, overrideActive, decision });
    }

    if (decision.action !== 'update') {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const supabase = createMobileSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const { error } = await supabase.rpc('update_today_log', {
      p_steps: decision.value,
    });

    if (__DEV__ && error) {
      console.log('[stepsBackgroundTask] update_today_log failed', error);
    }

    return error ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    if (__DEV__) {
      console.log('[stepsBackgroundTask] unexpected error', err);
    }
    // Never let the task crash the app or the OS's task runner.
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerStepsBackgroundTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(STEPS_BACKGROUND_TASK);
    if (alreadyRegistered) return;

    await BackgroundTask.registerTaskAsync(STEPS_BACKGROUND_TASK, {
      minimumInterval: 15,
    });
  } catch {
    // Best-effort: background sync is a bonus on top of foreground
    // sync, never something the Daily Log depends on to function.
  }
}
