/**
 * Pure state machine for the steps-OCR fallback flow. Mirrors
 * weightOcrState.ts's shape (attempt count, retry-then-manual-fallback
 * after two failures, permission-denied goes straight to manual entry),
 * with one addition weight-OCR doesn't need: a distinct
 * 'needs_confirmation' status for a low-confidence read (extractStepsCandidate
 * found a number but no "steps" label near it) — the fallback-hierarchy
 * requirement is explicit that a low-confidence OCR result must never be
 * silently written to the KPI, only offered for the user to confirm or
 * overwrite. No native/OCR calls here, independently testable.
 */

export type StepsOcrStatus = 'idle' | 'needs_confirmation' | 'retake_prompt' | 'manual_fallback';

export type StepsOcrState = {
  attempt: number;
  status: StepsOcrStatus;
  photoUri: string | null;
  suggestedValue: number | null;
};

export const initialStepsOcrState: StepsOcrState = {
  attempt: 0,
  status: 'idle',
  photoUri: null,
  suggestedValue: null,
};

export type StepsOcrEvent =
  | { type: 'OCR_SUCCESS_HIGH_CONFIDENCE'; photoUri: string; value: number }
  | { type: 'OCR_SUCCESS_LOW_CONFIDENCE'; photoUri: string; value: number }
  | { type: 'OCR_FAILURE'; photoUri: string }
  | { type: 'CONFIRMED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'RESET' };

export function reduceStepsOcrState(state: StepsOcrState, event: StepsOcrEvent): StepsOcrState {
  switch (event.type) {
    case 'OCR_SUCCESS_HIGH_CONFIDENCE':
      // A number found right next to a "steps" label — confident enough
      // to pre-fill directly, same trust level as weight-OCR's single
      // success state. The user still reviews/edits before saving.
      return {
        attempt: state.attempt + 1,
        status: 'idle',
        photoUri: event.photoUri,
        suggestedValue: event.value,
      };

    case 'OCR_SUCCESS_LOW_CONFIDENCE':
      // A number was found but not clearly labeled "steps" (e.g. an
      // unfamiliar app layout) — pre-fill it as a suggestion, but the
      // screen must show an explicit confirm-or-edit prompt rather than
      // treating this the same as a high-confidence read.
      return {
        attempt: state.attempt + 1,
        status: 'needs_confirmation',
        photoUri: event.photoUri,
        suggestedValue: event.value,
      };

    case 'OCR_FAILURE': {
      const nextAttempt = state.attempt + 1;
      if (nextAttempt >= 2) {
        return {
          attempt: nextAttempt,
          status: 'manual_fallback',
          photoUri: null,
          suggestedValue: null,
        };
      }
      return {
        attempt: nextAttempt,
        status: 'retake_prompt',
        photoUri: null,
        suggestedValue: null,
      };
    }

    case 'CONFIRMED':
      // User explicitly accepted a low-confidence suggestion.
      return { ...state, status: 'idle' };

    case 'PERMISSION_DENIED':
      return {
        ...state,
        status: 'manual_fallback',
        photoUri: null,
        suggestedValue: null,
      };

    case 'RESET':
      return initialStepsOcrState;

    default:
      return state;
  }
}
