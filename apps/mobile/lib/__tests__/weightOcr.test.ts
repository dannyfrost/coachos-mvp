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

  it('prefers the visually larger candidate when neither is near a kg label', () => {
    const result = resultFromLines([
      { text: '45', frame: FRAME_SMALL },
      { text: '120', frame: FRAME_LARGE },
    ]);
    expect(extractWeightCandidate(result)).toBe(120);
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
});
