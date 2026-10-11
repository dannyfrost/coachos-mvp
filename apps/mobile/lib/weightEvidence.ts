/**
 * Pure evidence-policy check for weight logging. No React/native deps.
 *
 * Coaching anti-cheat rule: a weight value may only be logged with a
 * scale photo attached as proof. "hasPhotoEvidence" is true when either
 * a photo was captured this session (retained for upload) OR today's log
 * already has a stored weight photo (editing an existing entry). This is
 * the UI-side gate; the server RPC enforces the same rule independently
 * (migration 025) so the policy can't be bypassed by a crafted client.
 *
 * Returns an error string to show the user, or null when submission of
 * the weight is allowed. An empty weight is always allowed (the client
 * simply isn't logging weight this submission).
 */
export function weightSubmitError(
  weightText: string,
  hasPhotoEvidence: boolean
): string | null {
  if (weightText.trim() === '') return null;
  if (!hasPhotoEvidence) {
    return 'A scale photo is required to log your weight. Take or attach one first.';
  }
  return null;
}
