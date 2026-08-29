import {
  initialWeightOcrState,
  reduceWeightOcrState,
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

  it('attempt 1 failure: shows a retake prompt and discards the photo', () => {
    const next = reduceWeightOcrState(initialWeightOcrState, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo1.jpg',
    });
    expect(next.attempt).toBe(1);
    expect(next.status).toBe('retake_prompt');
    expect(next.retainedPhotoUri).toBeNull();
    expect(next.suggestedValue).toBeNull();
  });

  it('attempt 2 success (after a first failure): suggests the value', () => {
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

  it('attempt 2 failure: falls back to manual entry and retains the attempt-2 photo', () => {
    const afterFirstFailure = reduceWeightOcrState(initialWeightOcrState, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo1.jpg',
    });
    const next = reduceWeightOcrState(afterFirstFailure, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo2.jpg',
    });
    expect(next.attempt).toBe(2);
    expect(next.status).toBe('manual_fallback');
    expect(next.retainedPhotoUri).toBe('file://photo2.jpg');
    expect(next.suggestedValue).toBeNull();
  });

  it('does not retry a third time — a third OCR_FAILURE stays in manual_fallback', () => {
    let state = initialWeightOcrState;
    state = reduceWeightOcrState(state, { type: 'OCR_FAILURE', photoUri: 'a' });
    state = reduceWeightOcrState(state, { type: 'OCR_FAILURE', photoUri: 'b' });
    state = reduceWeightOcrState(state, { type: 'OCR_FAILURE', photoUri: 'c' });
    expect(state.status).toBe('manual_fallback');
    expect(state.retainedPhotoUri).toBe('c');
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

  it('the state shape has no "locked" concept — the weight input stays editable by construction', () => {
    const next = reduceWeightOcrState(initialWeightOcrState, {
      type: 'OCR_SUCCESS',
      photoUri: 'file://photo1.jpg',
      value: 82.4,
    });
    expect(Object.keys(next).sort()).toEqual(
      ['attempt', 'retainedPhotoUri', 'status', 'suggestedValue'].sort()
    );
  });
});
