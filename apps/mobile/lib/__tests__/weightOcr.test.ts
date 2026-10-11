import { extractWeightCandidate } from '../weightOcr';
import type { OcrFrame, OcrResult } from 'rn-mlkit-ocr';

const FRAME_SMALL: OcrFrame = { x: 0, y: 0, width: 40, height: 20 };
const FRAME_LARGE: OcrFrame = { x: 0, y: 0, width: 200, height: 120 };

function resultFromLines(
  lines: { text: string; frame?: OcrFrame }[]
): OcrResult {
  return {
    text: lines.map((l) => l.text).join('\n'),
    blocks: [
      {
        text: lines.map((l) => l.text).join('\n'),
        frame: FRAME_LARGE,
        lines: lines.map((l) => ({
          text: l.text,
          frame: l.frame ?? FRAME_LARGE,
          elements: [{ text: l.text, frame: l.frame ?? FRAME_LARGE }],
        })),
      },
    ],
  };
}

describe('extractWeightCandidate', () => {
  it('reads a decimal weight followed by kg', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '82.4 kg' }]))).toBe(82.4);
  });

  it('reads an integer weight followed by kg', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '82 kg' }]))).toBe(82);
  });

  it('reads a weight with a label prefix', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: 'Weight 82.4 kg' }]))).toBe(82.4);
  });

  it('ignores a brand name and reads the weight', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: 'WITHINGS 82.4 kg' }]))).toBe(82.4);
  });

  it('reads a bare decimal with no kg label present', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '82.4' }]))).toBe(82.4);
  });

  it('prefers a kg-labeled candidate over an unrelated number like a battery indicator', () => {
    const result = resultFromLines([
      { text: 'battery 88', frame: FRAME_SMALL },
      { text: '75.2 kg', frame: FRAME_SMALL },
    ]);
    expect(extractWeightCandidate(result)).toBe(75.2);
  });

  it('rejects bare in-range integers with no kg label and no decimal (ambiguous)', () => {
    // Policy: being in 30-300 is not enough. Two bare integers with no
    // unit could be anything (step goal, age, a UI number) — refuse to
    // guess so the caller asks for another photo instead of logging junk.
    const result = resultFromLines([
      { text: '45', frame: FRAME_SMALL },
      { text: '120', frame: FRAME_LARGE },
    ]);
    expect(extractWeightCandidate(result)).toBeNull();
  });

  it('rejects a value below the valid range', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '12 kg' }]))).toBeNull();
  });

  it('rejects a value above the valid range', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '301 kg' }]))).toBeNull();
  });

  it('rejects a bare 3-digit number outside the range', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '999' }]))).toBeNull();
  });

  it('returns null when there is no numeric text at all', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: 'abc' }]))).toBeNull();
  });

  it('returns null for an empty result', () => {
    expect(extractWeightCandidate(resultFromLines([]))).toBeNull();
  });

  it('handles messy multi-line OCR output and picks the kg-labeled reading', () => {
    const result = resultFromLines([
      { text: 'WITHINGS', frame: FRAME_SMALL },
      { text: 'lo-battery 3', frame: FRAME_SMALL },
      { text: '68.9 kg', frame: FRAME_LARGE },
    ]);
    expect(extractWeightCandidate(result)).toBe(68.9);
  });

  it('does not let an unrelated number on its own line inherit a neighboring line\'s kg label', () => {
    const result = resultFromLines([
      { text: '68.9 kg', frame: FRAME_LARGE },
      { text: 'lo-battery 88', frame: FRAME_LARGE },
    ]);
    expect(extractWeightCandidate(result)).toBe(68.9);
  });

  it('scores two numbers sharing one line by their own element size, not the shared line box', () => {
    // Both "35" and "81.4" sit on the same OCR line (e.g. a weight reading
    // next to a smaller secondary number like a BMI value), so both are
    // "near kg" and the tiebreak falls to area. Real OCR gives each number
    // its own small element frame even when they share a line; the fix
    // under test is using that per-element frame instead of the shared,
    // identical line frame (which would make them tie and fall back to
    // left-to-right order, incorrectly picking "35").
    const result: OcrResult = {
      text: '35 81.4 kg',
      blocks: [
        {
          text: '35 81.4 kg',
          frame: FRAME_LARGE,
          lines: [
            {
              text: '35 81.4 kg',
              frame: FRAME_LARGE,
              elements: [
                { text: '35', frame: FRAME_SMALL },
                { text: '81.4', frame: FRAME_LARGE },
                { text: 'kg', frame: FRAME_SMALL },
              ],
            },
          ],
        },
      ],
    };
    expect(extractWeightCandidate(result)).toBe(81.4);
  });

  it('rejects a correctly-read lbs value instead of silently treating it as kg', () => {
    // 165 lbs is a real, plausible body weight and also falls inside the
    // 30-300 "plausible kg" range — without a unit check this would be
    // accepted as 165 kg, a badly wrong value despite the OCR read being
    // perfectly correct.
    expect(extractWeightCandidate(resultFromLines([{ text: '165 lbs' }]))).toBeNull();
    expect(extractWeightCandidate(resultFromLines([{ text: '165 lb' }]))).toBeNull();
    expect(extractWeightCandidate(resultFromLines([{ text: '165.4 pounds' }]))).toBeNull();
  });

  it('still reads a valid kg candidate on a different line when another line is in lbs', () => {
    const result = resultFromLines([
      { text: '363.8 lbs', frame: FRAME_SMALL },
      { text: '165 kg', frame: FRAME_LARGE },
    ]);
    expect(extractWeightCandidate(result)).toBe(165);
  });

  // ── Phase 4 regression fixtures (real scale readings from the client) ──

  it('reads a clear 76.40 kg seven-segment reading', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '76.40 kg' }]))).toBe(76.4);
  });

  it('preserves two decimal places (79.75, not 79.7)', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '79.75 kg' }]))).toBe(79.75);
  });

  it('accepts a comma decimal separator', () => {
    expect(extractWeightCandidate(resultFromLines([{ text: '74,60 kg' }]))).toBe(74.6);
  });

  it('screenshot: picks 76.40 and ignores a 55% battery readout', () => {
    const result = resultFromLines([
      { text: '23:45 55%', frame: FRAME_SMALL },
      { text: '76.40 kg', frame: FRAME_LARGE },
    ]);
    expect(extractWeightCandidate(result)).toBe(76.4);
  });

  it('screenshot with the scale reading undetected: rejects the 55% battery number', () => {
    // When the low-contrast seven-segment display fails to OCR, only UI
    // chrome remains. 55 is in range but must NOT be logged as a weight.
    const result = resultFromLines([{ text: '23:45 55%  R', frame: FRAME_SMALL }]);
    expect(extractWeightCandidate(result)).toBeNull();
  });

  it('picks the larger decimal when multiple decimal candidates compete', () => {
    const result = resultFromLines([
      { text: '66.6', frame: FRAME_SMALL },
      { text: '82.2', frame: FRAME_LARGE },
    ]);
    expect(extractWeightCandidate(result)).toBe(82.2);
  });

  it('prefers a kg-labeled integer over a competing bare decimal', () => {
    const result = resultFromLines([
      { text: '95.5', frame: FRAME_SMALL },
      { text: '80 kg', frame: FRAME_SMALL },
    ]);
    expect(extractWeightCandidate(result)).toBe(80);
  });
});
