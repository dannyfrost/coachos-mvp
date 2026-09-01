const mockGetSdkStatus = jest.fn();
const mockInitialize = jest.fn();
const mockRequestPermission = jest.fn();
const mockGetGrantedPermissions = jest.fn();
const mockReadRecords = jest.fn();

jest.mock('react-native-health-connect', () => ({
  getSdkStatus: (...args: unknown[]) => mockGetSdkStatus(...args),
  initialize: (...args: unknown[]) => mockInitialize(...args),
  requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
  getGrantedPermissions: (...args: unknown[]) => mockGetGrantedPermissions(...args),
  readRecords: (...args: unknown[]) => mockReadRecords(...args),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3, SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2 },
}));

import {
  isHealthConnectAvailable,
  hasWeightPermission,
  requestWeightPermission,
  readLatestWeight,
} from '../weightHealthConnect';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isHealthConnectAvailable', () => {
  it('returns true when the SDK reports available', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    await expect(isHealthConnectAvailable()).resolves.toBe(true);
  });

  it('returns false, not a throw, when the native call rejects', async () => {
    mockGetSdkStatus.mockRejectedValue(new Error('native module not linked'));
    await expect(isHealthConnectAvailable()).resolves.toBe(false);
  });
});

describe('hasWeightPermission / requestWeightPermission', () => {
  it('hasWeightPermission is true only when a read Weight grant is present', async () => {
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Weight', accessType: 'read' }]);
    await expect(hasWeightPermission()).resolves.toBe(true);
  });

  it('hasWeightPermission is false when granted permissions do not include Weight', async () => {
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);
    await expect(hasWeightPermission()).resolves.toBe(false);
  });

  it('requestWeightPermission is true when the user grants the dialog', async () => {
    mockRequestPermission.mockResolvedValue([{ recordType: 'Weight', accessType: 'read' }]);
    await expect(requestWeightPermission()).resolves.toBe(true);
  });

  it('requestWeightPermission is false when the user denies the dialog', async () => {
    mockRequestPermission.mockResolvedValue([]);
    await expect(requestWeightPermission()).resolves.toBe(false);
  });
});

describe('readLatestWeight', () => {
  it('returns unavailable when the SDK is not available', async () => {
    mockGetSdkStatus.mockResolvedValue(1);
    await expect(readLatestWeight()).resolves.toEqual({ status: 'unavailable' });
  });

  it('returns unavailable when initialize() fails', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(false);
    await expect(readLatestWeight()).resolves.toEqual({ status: 'unavailable' });
  });

  it('returns denied when permission has not been granted', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([]);
    await expect(readLatestWeight()).resolves.toEqual({ status: 'denied' });
  });

  it('returns no_data when no Weight records exist in the lookback window', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Weight', accessType: 'read' }]);
    mockReadRecords.mockResolvedValue({ records: [] });
    await expect(readLatestWeight()).resolves.toEqual({ status: 'no_data' });
  });

  it('returns the most recent record already converted to kilograms, no manual unit conversion', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Weight', accessType: 'read' }]);
    mockReadRecords.mockResolvedValue({ records: [{ weight: { inKilograms: 72.4 } }] });
    await expect(readLatestWeight()).resolves.toEqual({ status: 'ok', weightKg: 72.4 });
    expect(mockReadRecords).toHaveBeenCalledWith(
      'Weight',
      expect.objectContaining({ ascendingOrder: false, pageSize: 1 })
    );
  });

  it('returns no_data when the record shape is missing a usable weight value', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Weight', accessType: 'read' }]);
    mockReadRecords.mockResolvedValue({ records: [{ weight: {} }] });
    await expect(readLatestWeight()).resolves.toEqual({ status: 'no_data' });
  });

  it('returns error, not a throw, when a native call rejects unexpectedly', async () => {
    mockGetSdkStatus.mockResolvedValue(3);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Weight', accessType: 'read' }]);
    mockReadRecords.mockRejectedValue(new Error('boom'));
    await expect(readLatestWeight()).resolves.toEqual({ status: 'error' });
  });
});
