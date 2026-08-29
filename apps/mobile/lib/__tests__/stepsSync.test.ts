import { decideStepsSync } from '../stepsSync';
import type { HealthConnectReadResult } from '../stepsHealthConnect';

const TODAY = '2026-08-29';

describe('decideStepsSync', () => {
  it('updates with a valid step count (permission granted, real data)', () => {
    const result: HealthConnectReadResult = { status: 'ok', steps: 8200 };
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'update', value: 8200 });
  });

  it('treats a valid zero step count as legitimate and updates', () => {
    const result: HealthConnectReadResult = { status: 'ok', steps: 0 };
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'update', value: 0 });
  });

  it('skips when there is no Health Connect data for today', () => {
    const result: HealthConnectReadResult = { status: 'no_data' };
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'skip' });
  });

  it('skips when permission was denied', () => {
    const result: HealthConnectReadResult = { status: 'denied' };
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'skip' });
  });

  it('skips when Health Connect is unavailable on this device', () => {
    const result: HealthConnectReadResult = { status: 'unavailable' };
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'skip' });
  });

  it('skips on an unexpected read error, preserving the existing value', () => {
    const result: HealthConnectReadResult = { status: 'error' };
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'skip' });
  });

  it('skips a valid reading when a manual override is active today, even with a real step count', () => {
    const result: HealthConnectReadResult = { status: 'ok', steps: 8200 };
    expect(decideStepsSync(TODAY, true, result)).toEqual({ action: 'skip' });
  });

  it('skips a valid zero reading when a manual override is active today', () => {
    const result: HealthConnectReadResult = { status: 'ok', steps: 0 };
    expect(decideStepsSync(TODAY, true, result)).toEqual({ action: 'skip' });
  });

  it('resumes updating once the override is no longer active (new-day rollover is the caller\'s responsibility via stepsManualOverride)', () => {
    // Simulates: yesterday's override date no longer matches today, so
    // the caller passes manualOverrideActiveToday=false again.
    const result: HealthConnectReadResult = { status: 'ok', steps: 3000 };
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'update', value: 3000 });
  });

  it('treats permission revoked (denied on a later read) the same as never-granted: skip, no crash', () => {
    const result: HealthConnectReadResult = { status: 'denied' };
    expect(() => decideStepsSync(TODAY, false, result)).not.toThrow();
    expect(decideStepsSync(TODAY, false, result)).toEqual({ action: 'skip' });
  });
});
