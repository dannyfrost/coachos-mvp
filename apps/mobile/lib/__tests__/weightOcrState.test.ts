import {
  initialWeightOcrState,
  reduceWeightOcrState,
  WEIGHT_PHOTO_MAX_ATTEMPTS,
} from '../weightOcrState';

describe('reduceWeightOcrState', () => {
  it('attempt 1 success: suggests the value and retains the photo', () => {
    const next = reduceWeightOcrState(initialWeightOcrState, {
      type: 'OCR_SUCCESS',
      photoUri: 'file://photo1.jpg',
      value: 82.4,
    });
    expect(next.attempt).toBe(1);
    expect(next.status).toBe('idle');
    expect(next.suggestedValue).toBe(82.4);
    expect(next.retainedPhotoUri).toBe('file://photo1.jpg');
  });

  it('first failure: asks for a retake (not manual yet), photo retained as proof', () => {
    const next = reduceWeightOcrState(initialWeightOcrState, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo1.jpg',
    });
    expect(next.attempt).toBe(1);
    expect(next.status).toBe('retry');
    expect(next.retainedPhotoUri).toBe('file://photo1.jpg');
    expect(next.suggestedValue).toBeNull();
  });

  it('stays in retry for every failure before the attempt budget is spent', () => {
    let state = initialWeightOcrState;
    for (let i = 1; i < WEIGHT_PHOTO_MAX_ATTEMPTS; i++) {
      state = reduceWeightOcrState(state, { type: 'OCR_FAILURE', photoUri: `p${i}` });
      expect(state.status).toBe('retry');
      expect(state.attempt).toBe(i);
    }
  });

  it('unlocks manual entry only on the Nth failed photo, keeping the latest photo', () => {
    let state = initialWeightOcrState;
    for (let i = 1; i <= WEIGHT_PHOTO_MAX_ATTEMPTS; i++) {
      state = reduceWeightOcrState(state, { type: 'OCR_FAILURE', photoUri: `p${i}` });
    }
    expect(state.attempt).toBe(WEIGHT_PHOTO_MAX_ATTEMPTS);
    expect(state.status).toBe('manual_fallback');
    expect(state.retainedPhotoUri).toBe(`p${WEIGHT_PHOTO_MAX_ATTEMPTS}`);
  });

  it('success after a prior failure: suggests the value again', () => {
    const afterFirstFailure = reduceWeightOcrState(initialWeightOcrState, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo1.jpg',
    });
    const next = reduceWeightOcrState(afterFirstFailure, {
      type: 'OCR_SUCCESS',
      photoUri: 'file://photo2.jpg',
      value: 68.9,
    });
    expect(next.attempt).toBe(2);
    expect(next.status).toBe('idle');
    expect(next.suggestedValue).toBe(68.9);
    expect(next.retainedPhotoUri).toBe('file://photo2.jpg');
  });

  it('permission denied: goes straight to manual entry with no photo', () => {
    const next = reduceWeightOcrState(initialWeightOcrState, {
      type: 'PERMISSION_DENIED',
    });
    expect(next.status).toBe('manual_fallback');
    expect(next.retainedPhotoUri).toBeNull();
  });

  it('reset returns to the initial state', () => {
    const dirty = reduceWeightOcrState(initialWeightOcrState, {
      type: 'OCR_SUCCESS',
      photoUri: 'file://photo1.jpg',
      value: 82.4,
    });
    expect(reduceWeightOcrState(dirty, { type: 'RESET' })).toEqual(
      initialWeightOcrState
    );
  });
});
