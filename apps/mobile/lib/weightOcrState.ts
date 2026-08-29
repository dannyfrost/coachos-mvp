/**
 * Pure state machine for the weight-OCR capture flow. No camera or
 * native OCR calls here — this only tracks attempt count, whether to
 * show a retake prompt, and which photo (if any) should be uploaded
 * at save time. The Weight text input itself is a normal controlled
 * field owned by the screen, independent of this state — there is no
 * "locked" status here by design, since it must always stay editable.
 */

export type WeightOcrStatus = 'idle' | 'retake_prompt' | 'manual_fallback';

export type WeightOcrState = {
  attempt: number;
  status: WeightOcrStatus;
  /** Photo to upload at save time; null when nothing should be uploaded. */
  retainedPhotoUri: string | null;
  /** OCR-suggested value to pre-fill, if the last attempt succeeded. */
  suggestedValue: number | null;
};

export const initialWeightOcrState: WeightOcrState = {
  attempt: 0,
  status: 'idle',
  retainedPhotoUri: null,
  suggestedValue: null,
};

export type WeightOcrEvent =
  | { type: 'OCR_SUCCESS'; photoUri: string; value: number }
  | { type: 'OCR_FAILURE'; photoUri: string }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'RESET' };

export function reduceWeightOcrState(
  state: WeightOcrState,
  event: WeightOcrEvent
): WeightOcrState {
  switch (event.type) {
    case 'OCR_SUCCESS':
      // Successful read, on any attempt: keep the photo as proof and
      // suggest the value. User still reviews/edits before saving.
      return {
        attempt: state.attempt + 1,
        status: 'idle',
        retainedPhotoUri: event.photoUri,
        suggestedValue: event.value,
      };

    case 'OCR_FAILURE': {
      const nextAttempt = state.attempt + 1;
      if (nextAttempt >= 2) {
        // Second failure: stop retrying, but the attempt-2 photo is
        // retained and will upload alongside whatever the user types.
        return {
          attempt: nextAttempt,
          status: 'manual_fallback',
          retainedPhotoUri: event.photoUri,
          suggestedValue: null,
        };
      }
      // First failure: offer a retake, discard the failed photo.
      return {
        attempt: nextAttempt,
        status: 'retake_prompt',
        retainedPhotoUri: null,
        suggestedValue: null,
      };
    }

    case 'PERMISSION_DENIED':
      // Never a dead end: go straight to manual entry, no photo.
      return {
        ...state,
        status: 'manual_fallback',
        retainedPhotoUri: null,
        suggestedValue: null,
      };

    case 'RESET':
      return initialWeightOcrState;

    default:
      return state;
  }
}
