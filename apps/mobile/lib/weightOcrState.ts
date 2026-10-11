/**
 * Pure state machine for the weight-OCR capture flow. No camera or
 * native OCR calls here — this only tracks attempt count and which
 * photo (if any) should be uploaded at save time.
 *
 * Coaching anti-cheat model: the SCALE PHOTO is the proof that matters,
 * not the typed number. So a photo is the required primary input, OCR
 * reads it, and a failed read asks the user to RETAKE — it does NOT drop
 * straight to manual typing. Only after WEIGHT_PHOTO_MAX_ATTEMPTS failed
 * photos does typing unlock as a last resort, and even then the last
 * photo is still retained and uploaded as proof alongside the typed
 * value. 'retry' = keep photographing; 'manual_fallback' = typing now
 * allowed. The Weight text input is kept locked by the screen until this
 * reaches 'manual_fallback' OR a read succeeds (suggestedValue set).
 */

// How many failed scale photos before typing is allowed as a last
// resort. ponytail: tune here if coaches want more/fewer retake prompts.
export const WEIGHT_PHOTO_MAX_ATTEMPTS = 3;

export type WeightOcrStatus = 'idle' | 'retry' | 'manual_fallback';

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
      // Keep asking for another scale photo until the attempt budget is
      // spent — the photo is the proof, so retaking beats letting the
      // user type an unverifiable number. Only the Nth failure unlocks
      // manual entry. Latest photo is always retained as proof either
      // way (it uploads even when OCR couldn't read it).
      const attempt = state.attempt + 1;
      const status: WeightOcrStatus =
        attempt >= WEIGHT_PHOTO_MAX_ATTEMPTS ? 'manual_fallback' : 'retry';
      return {
        attempt,
        status,
        retainedPhotoUri: event.photoUri,
        suggestedValue: null,
      };
    }

    case 'PERMISSION_DENIED':
      // Camera unusable (user denied it) — there is no way to collect a
      // photo, so typing must be allowed immediately. No photo to retain.
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
