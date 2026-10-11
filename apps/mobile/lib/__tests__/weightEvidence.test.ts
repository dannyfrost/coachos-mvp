import { weightSubmitError } from '../weightEvidence';

describe('weightSubmitError', () => {
  it('allows an empty weight (not logging weight this submission)', () => {
    expect(weightSubmitError('', false)).toBeNull();
    expect(weightSubmitError('   ', false)).toBeNull();
  });

  it('blocks a weight value with no photo evidence', () => {
    expect(weightSubmitError('76.4', false)).toMatch(/scale photo is required/i);
  });

  it('allows a weight value when a photo was captured this session', () => {
    expect(weightSubmitError('76.4', true)).toBeNull();
  });

  it('blocks even an integer weight with no evidence', () => {
    expect(weightSubmitError('80', false)).toMatch(/scale photo is required/i);
  });
});
