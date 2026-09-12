/**
 * Pure state machine for the weight-OCR capture flow. No camera or
 * native OCR calls here — this only tracks attempt count and which
 * photo (if any) should be uploaded at save time. Manual entry is
 * never gated behind a failed OCR attempt: a single OCR_FAILURE goes
 * straight to 'manual_fallback' (no retry-then-fallback ladder) since
 * real-world scale photos (seven-segment LCD, off-axis angle) make
 * repeated auto-retries a false promise, not a real recovery path. The
 * Weight text input itself is a normal controlled field owned by the
 * screen, independent of this state — there is no "locked" status here
 * by design, since it must always stay editable.
 */

export type WeightOcrStatus = 'idle' | 'manual_fallback';

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

    case 'OCR_FAILURE':
      // Any failure, first attempt included: straight to manual entry.
      // The photo is retained and will upload alongside whatever the
      // user types — still useful as proof even though OCR couldn't
      // read it. Retaking is always available via the camera button,
      // it's just never forced before the user can type a value.
      return {
        attempt: state.attempt + 1,
        status: 'manual_fallback',
        retainedPhotoUri: event.photoUri,
        suggestedValue: null,
      };

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
