import { classifyStepCapability } from '../stepsCapability';

describe('classifyStepCapability', () => {
  it('supports Android 14 + ext >= 20 + step sensor', () => {
    const r = classifyStepCapability({ apiLevel: 34, sdkExtension34: 20, hasStepCounterSensor: true });
    expect(r.supported).toBe(true);
  });

  it('supports newer Android (15) when all preconditions met', () => {
    const r = classifyStepCapability({ apiLevel: 35, sdkExtension34: 24, hasStepCounterSensor: true });
    expect(r.supported).toBe(true);
  });

  it('reports old_android below API 34 (e.g. Android 13)', () => {
    const r = classifyStepCapability({ apiLevel: 33, sdkExtension34: 99, hasStepCounterSensor: true });
    expect(r).toMatchObject({ supported: false, reason: 'old_android' });
  });

  it('reports old_sdk_extension on API 34 with extension < 20 (e.g. emulator ext 7)', () => {
    const r = classifyStepCapability({ apiLevel: 34, sdkExtension34: 7, hasStepCounterSensor: true });
    expect(r).toMatchObject({ supported: false, reason: 'old_sdk_extension' });
  });

  it('reports no_sensor when API+extension ok but no step counter (e.g. emulator)', () => {
    const r = classifyStepCapability({ apiLevel: 34, sdkExtension34: 20, hasStepCounterSensor: false });
    expect(r).toMatchObject({ supported: false, reason: 'no_sensor' });
  });

  it('checks preconditions in order: android version before extension', () => {
    // API too low AND extension too low -> reports the android-version failure first
    const r = classifyStepCapability({ apiLevel: 30, sdkExtension34: 0, hasStepCounterSensor: false });
    expect(r).toMatchObject({ supported: false, reason: 'old_android' });
  });
});
