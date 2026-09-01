import { initialStepsOcrState, reduceStepsOcrState } from '../stepsOcrState';

describe('reduceStepsOcrState', () => {
  it('high-confidence success: suggests the value directly (no confirmation needed)', () => {
    const next = reduceStepsOcrState(initialStepsOcrState, {
      type: 'OCR_SUCCESS_HIGH_CONFIDENCE',
      photoUri: 'file://photo1.jpg',
      value: 8421,
    });
    expect(next.attempt).toBe(1);
    expect(next.status).toBe('idle');
    expect(next.suggestedValue).toBe(8421);
    expect(next.photoUri).toBe('file://photo1.jpg');
  });

  it('low-confidence success: suggests the value but requires explicit confirmation', () => {
    const next = reduceStepsOcrState(initialStepsOcrState, {
      type: 'OCR_SUCCESS_LOW_CONFIDENCE',
      photoUri: 'file://photo1.jpg',
      value: 9102,
    });
    expect(next.status).toBe('needs_confirmation');
    expect(next.suggestedValue).toBe(9102);
  });

  it('confirming a low-confidence suggestion moves to idle without changing the value', () => {
    const lowConfidence = reduceStepsOcrState(initialStepsOcrState, {
      type: 'OCR_SUCCESS_LOW_CONFIDENCE',
      photoUri: 'file://photo1.jpg',
      value: 9102,
    });
    const confirmed = reduceStepsOcrState(lowConfidence, { type: 'CONFIRMED' });
    expect(confirmed.status).toBe('idle');
    expect(confirmed.suggestedValue).toBe(9102);
  });

  it('attempt 1 failure: shows a retake prompt and discards the photo', () => {
    const next = reduceStepsOcrState(initialStepsOcrState, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo1.jpg',
    });
    expect(next.attempt).toBe(1);
    expect(next.status).toBe('retake_prompt');
    expect(next.photoUri).toBeNull();
    expect(next.suggestedValue).toBeNull();
  });

  it('attempt 2 failure: falls back to manual entry', () => {
    const afterFirstFailure = reduceStepsOcrState(initialStepsOcrState, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo1.jpg',
    });
    const next = reduceStepsOcrState(afterFirstFailure, {
      type: 'OCR_FAILURE',
      photoUri: 'file://photo2.jpg',
    });
    expect(next.attempt).toBe(2);
    expect(next.status).toBe('manual_fallback');
    expect(next.suggestedValue).toBeNull();
  });

  it('does not retry a third time — a third OCR_FAILURE stays in manual_fallback', () => {
    let state = initialStepsOcrState;
    state = reduceStepsOcrState(state, { type: 'OCR_FAILURE', photoUri: 'a' });
    state = reduceStepsOcrState(state, { type: 'OCR_FAILURE', photoUri: 'b' });
    state = reduceStepsOcrState(state, { type: 'OCR_FAILURE', photoUri: 'c' });
    expect(state.status).toBe('manual_fallback');
  });

  it('permission denied: goes straight to manual entry with no photo', () => {
    const next = reduceStepsOcrState(initialStepsOcrState, { type: 'PERMISSION_DENIED' });
    expect(next.status).toBe('manual_fallback');
    expect(next.photoUri).toBeNull();
  });

  it('reset returns to the initial state', () => {
    const dirty = reduceStepsOcrState(initialStepsOcrState, {
      type: 'OCR_SUCCESS_HIGH_CONFIDENCE',
      photoUri: 'file://photo1.jpg',
      value: 8421,
    });
    expect(reduceStepsOcrState(dirty, { type: 'RESET' })).toEqual(initialStepsOcrState);
  });
});
