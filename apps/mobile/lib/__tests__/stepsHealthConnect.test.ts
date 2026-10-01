const mockGetSdkStatus = jest.fn();
const mockInitialize = jest.fn();
const mockRequestPermission = jest.fn();
const mockGetGrantedPermissions = jest.fn();
const mockReadRecords = jest.fn();
const mockAggregateRecord = jest.fn();

jest.mock('react-native-health-connect', () => ({
  getSdkStatus: (...args: unknown[]) => mockGetSdkStatus(...args),
  initialize: (...args: unknown[]) => mockInitialize(...args),
  requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
  getGrantedPermissions: (...args: unknown[]) => mockGetGrantedPermissions(...args),
  readRecords: (...args: unknown[]) => mockReadRecords(...args),
  aggregateRecord: (...args: unknown[]) => mockAggregateRecord(...args),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3, SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2 },
}));

import {
  isHealthConnectAvailable,
  hasStepsPermission,
  requestStepsPermission,
  readTodaySteps,
} from '../stepsHealthConnect';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isHealthConnectAvailable', () => {
  it('returns true when the SDK reports available', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    await expect(isHealthConnectAvailable()).resolves.toBe(true);
  });

  it('returns false when the SDK reports unavailable (e.g. Android 13 with no companion app)', async () => {
    mockGetSdkStatus.mockResolvedValue(1);
    await expect(isHealthConnectAvailable()).resolves.toBe(false);
  });

  it('returns false, not a throw, when the native call rejects', async () => {
    mockGetSdkStatus.mockRejectedValue(new Error('native module not linked'));
    await expect(isHealthConnectAvailable()).resolves.toBe(false);
  });
});

describe('hasStepsPermission / requestStepsPermission', () => {
  // initialize() must succeed before any permission op; it is idempotent and
  // called at the start of each. See the init-failure tests below.
  beforeEach(() => {
    mockInitialize.mockResolvedValue(true);
  });

  it('hasStepsPermission is true only when a read Steps grant is present', async () => {
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);
    await expect(hasStepsPermission()).resolves.toBe(true);
  });

  it('hasStepsPermission is false when granted permissions do not include Steps', async () => {
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Weight', accessType: 'read' }]);
    await expect(hasStepsPermission()).resolves.toBe(false);
  });

  it('requestStepsPermission is true when the user grants the dialog', async () => {
    mockRequestPermission.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);
    await expect(requestStepsPermission()).resolves.toBe(true);
  });

  it('requestStepsPermission is false when the user denies the dialog', async () => {
    mockRequestPermission.mockResolvedValue([]);
    await expect(requestStepsPermission()).resolves.toBe(false);
  });

  // Regression guard for the no-dialog bug: if initialize() has not run (or
  // fails) the permission ops must not proceed — requestPermission must never
  // be called against an uninitialized client (which silently shows no dialog).
  it('requestStepsPermission returns false and never calls requestPermission when initialize fails', async () => {
    mockInitialize.mockResolvedValue(false);
    await expect(requestStepsPermission()).resolves.toBe(false);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('hasStepsPermission returns false when initialize fails', async () => {
    mockInitialize.mockResolvedValue(false);
    await expect(hasStepsPermission()).resolves.toBe(false);
    expect(mockGetGrantedPermissions).not.toHaveBeenCalled();
  });
});

describe('readTodaySteps', () => {
  it('returns unavailable when the SDK is not available', async () => {
    mockGetSdkStatus.mockResolvedValue(1);
    await expect(readTodaySteps()).resolves.toEqual({ status: 'unavailable' });
  });

  it('returns unavailable when initialize() fails', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(false);
    await expect(readTodaySteps()).resolves.toEqual({ status: 'unavailable' });
  });

  it('returns denied when permission has not been granted', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([]);
    await expect(readTodaySteps()).resolves.toEqual({ status: 'denied' });
  });

  it('returns no_data when no Steps records exist for today', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);
    mockReadRecords.mockResolvedValue({ records: [] });
    await expect(readTodaySteps()).resolves.toEqual({ status: 'no_data' });
  });

  it('returns the aggregated total via aggregateRecord, not a manual sum, when records exist', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);
    mockReadRecords.mockResolvedValue({ records: [{ count: 1 }] });
    mockAggregateRecord.mockResolvedValue({ COUNT_TOTAL: 6842 });
    await expect(readTodaySteps()).resolves.toEqual({ status: 'ok', steps: 6842 });
    expect(mockAggregateRecord).toHaveBeenCalledWith(
      expect.objectContaining({ recordType: 'Steps' })
    );
  });

  it('treats a real zero-step aggregate as ok, not no_data', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);
    mockReadRecords.mockResolvedValue({ records: [{ count: 1 }] });
    mockAggregateRecord.mockResolvedValue({ COUNT_TOTAL: 0 });
    await expect(readTodaySteps()).resolves.toEqual({ status: 'ok', steps: 0 });
  });

  it('returns error, not a throw, when a native call rejects unexpectedly', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);
    mockReadRecords.mockRejectedValue(new Error('boom'));
    await expect(readTodaySteps()).resolves.toEqual({ status: 'error' });
  });
});
