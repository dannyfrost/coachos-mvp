import { withTimeout, NativeCallTimeoutError } from '../withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the wrapped promise\'s value when it settles before the timeout', async () => {
    const promise = withTimeout(Promise.resolve('steps-ok'), 5000, 'test-call');
    await expect(promise).resolves.toBe('steps-ok');
  });

  it('rejects with the wrapped promise\'s error when it rejects before the timeout', async () => {
    const promise = withTimeout(Promise.reject(new Error('native failure')), 5000, 'test-call');
    await expect(promise).rejects.toThrow('native failure');
  });

  it('rejects with NativeCallTimeoutError when the wrapped promise never settles', async () => {
    const neverSettles = new Promise<string>(() => {});
    const promise = withTimeout(neverSettles, 5000, 'hung-call');

    const assertion = expect(promise).rejects.toThrow(NativeCallTimeoutError);
    jest.advanceTimersByTime(5000);
    await assertion;
  });

  it('includes the label and duration in the timeout error message', async () => {
    const neverSettles = new Promise<string>(() => {});
    const promise = withTimeout(neverSettles, 6000, 'getStepCountAsync');

    const assertion = expect(promise).rejects.toThrow('getStepCountAsync timed out after 6000ms');
    jest.advanceTimersByTime(6000);
    await assertion;
  });

  it('does not fire the timeout after the wrapped promise already resolved (no dangling timer rejection)', async () => {
    const promise = withTimeout(Promise.resolve('fast'), 5000, 'test-call');
    await expect(promise).resolves.toBe('fast');
    // If the internal timer weren't cleared, advancing time here would be
    // observing a stale timer — nothing should throw or change the settled
    // promise's outcome.
    jest.advanceTimersByTime(5000);
  });
});
