import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  markManualOverrideToday,
  isManualOverrideActiveToday,
} from '../stepsManualOverride';

describe('stepsManualOverride', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is not active before any manual edit has been recorded', async () => {
    expect(await isManualOverrideActiveToday('2026-08-29')).toBe(false);
  });

  it('is active for today right after a manual edit is recorded', async () => {
    await markManualOverrideToday('2026-08-29');
    expect(await isManualOverrideActiveToday('2026-08-29')).toBe(true);
  });

  it('is no longer active on a new day (automatic sync resumes)', async () => {
    await markManualOverrideToday('2026-08-29');
    expect(await isManualOverrideActiveToday('2026-08-30')).toBe(false);
  });

  it('does not crash and reports inactive if storage read fails', async () => {
    const original = AsyncStorage.getItem;
    (AsyncStorage.getItem as jest.Mock) = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(isManualOverrideActiveToday('2026-08-29')).resolves.toBe(false);
    AsyncStorage.getItem = original;
  });
});
