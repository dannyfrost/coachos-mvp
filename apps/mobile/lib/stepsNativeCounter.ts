import AsyncStorage from '@react-native-async-storage/async-storage';
import { readStepCounter } from '../modules/step-capability';
import type { StepsReadResult } from './stepsSync';

/**
 * Android < 14 step collection via the hardware TYPE_STEP_COUNTER sensor.
 *
 * Health Connect only counts the phone's own steps on Android 14+
 * (lib/stepsCapability.ts). Below that, the sensor's cumulative-since-boot
 * value (read natively in modules/step-capability) is the only no-manual-typing
 * source. It has no absolute "today" notion, so we anchor a baseline at the
 * first read of each local day and report `current - baseline`.
 *
 * Known ceilings (device/API realities, not bugs):
 *  - Steps taken BEFORE the first app read of a day are not counted — the
 *    counter has no midnight anchor, so day 1's reading starts at 0 and only
 *    accrues from the first read onward.
 *  - A reboot resets the counter; we detect current < baseline and re-anchor,
 *    losing that day's pre-reboot steps.
 *  - The sensor emits only on a detected step and some OEMs don't flush on
 *    registration, so a stationary device yields no value until the user moves.
 */

export type StepBaseline = { date: string; base: number };

const STORAGE_KEY = 'steps.counter.baseline.v1';

/**
 * Pure per-day math — no native, no storage — so it is unit-testable.
 * Returns today's steps and the baseline to persist for the next read.
 */
export function computeTodaySteps(
  stored: StepBaseline | null,
  current: number,
  today: string
): { steps: number; next: StepBaseline } {
  // New day (or first ever read): anchor here; today starts accruing from 0.
  if (!stored || stored.date !== today) {
    return { steps: 0, next: { date: today, base: current } };
  }
  // Counter went backwards => reboot: re-anchor to current (pre-reboot steps
  // for today are unrecoverable).
  if (current < stored.base) {
    return { steps: 0, next: { date: today, base: current } };
  }
  return { steps: Math.round(current - stored.base), next: stored };
}

/**
 * Reads today's steps from the hardware counter, maintaining the day baseline
 * in AsyncStorage. Returns the same StepsReadResult shape every steps source
 * uses, so decideStepsSync treats it identically.
 */
export async function readTodaySteps(today: string): Promise<StepsReadResult> {
  let current: number | null;
  try {
    current = await readStepCounter();
  } catch (err) {
    console.warn('[stepsNativeCounter] readStepCounter threw', err);
    return { status: 'error' };
  }
  if (current == null) return { status: 'unavailable' };

  let stored: StepBaseline | null = null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as StepBaseline;
  } catch {
    // Treat unreadable baseline as "no baseline" — re-anchors this read.
  }

  const { steps, next } = computeTodaySteps(stored, current, today);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A failed persist just means the next read re-anchors; never throw.
  }
  return { status: 'ok', steps };
}
