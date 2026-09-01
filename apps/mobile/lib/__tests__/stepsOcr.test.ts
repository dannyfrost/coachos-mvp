import { extractStepsCandidate } from '../stepsOcr';
import type { OcrFrame, OcrResult, OcrElement } from 'rn-mlkit-ocr';

const FRAME_SMALL: OcrFrame = { x: 0, y: 0, width: 40, height: 20 };
const FRAME_LARGE: OcrFrame = { x: 0, y: 0, width: 200, height: 120 };

function resultFromLines(
  lines: { text: string; frame?: OcrFrame; elements?: { text: string; frame?: OcrFrame }[] }[]
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
          elements: (
            l.elements
              ? l.elements.map((e) => ({ text: e.text, frame: e.frame ?? FRAME_LARGE }))
              : [{ text: l.text, frame: l.frame ?? FRAME_LARGE }]
          ) as OcrElement[],
        })),
      },
    ],
  };
}

describe('extractStepsCandidate', () => {
  it('reads a comma-formatted step count next to a "Steps" label', () => {
    const result = resultFromLines([{ text: 'Steps 8,421' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'ok', steps: 8421, confidence: 'high' });
  });

  it('reads a bare (no separator) step count', () => {
    const result = resultFromLines([{ text: 'Steps 8421' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'ok', steps: 8421, confidence: 'high' });
  });

  it('reads a period-thousands-separated step count', () => {
    const result = resultFromLines([{ text: 'Steps 8.421' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'ok', steps: 8421, confidence: 'high' });
  });

  it('reads a space-thousands-separated step count via adjacent-element merge', () => {
    // OCR splits "8 421" into two word elements on the same line.
    const result = resultFromLines([
      { text: 'Steps 8 421', elements: [{ text: 'Steps' }, { text: '8' }, { text: '421' }] },
    ]);
    const parsed = extractStepsCandidate(result);
    expect(parsed).toEqual({ status: 'ok', steps: 8421, confidence: 'high' });
  });

  it('does not confuse a calories figure on the same line as the step count', () => {
    const result = resultFromLines([{ text: 'Calories 512' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'no_candidate' });
  });

  it('does not confuse a distance figure with the step count', () => {
    const result = resultFromLines([{ text: 'Distance 5.2 km' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'no_candidate' });
  });

  it('does not confuse a heart-rate (bpm) figure with the step count', () => {
    const result = resultFromLines([{ text: 'Heart Rate 120 bpm' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'no_candidate' });
  });

  it('picks the steps-labeled number over unrelated metrics shown together', () => {
    const result = resultFromLines([
      { text: 'Steps 8,421', frame: FRAME_LARGE },
      { text: 'Calories 512', frame: FRAME_LARGE },
      { text: 'Distance 5.2 km', frame: FRAME_LARGE },
      { text: 'Heart Rate 120 bpm', frame: FRAME_LARGE },
    ]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'ok', steps: 8421, confidence: 'high' });
  });

  it('falls back to the visually largest number at low confidence when no line says "steps"', () => {
    const result = resultFromLines([
      { text: '9,102', frame: FRAME_LARGE },
      { text: 'today', frame: FRAME_SMALL },
    ]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'ok', steps: 9102, confidence: 'low' });
  });

  it('scores two numbers sharing a line by their own element size, not the shared line box', () => {
    // Mirrors the exact bug class fixed in weightOcr.ts: without
    // per-element scoring both numbers on this line would tie on area.
    const result = resultFromLines([
      {
        text: 'Steps 8,421 Goal 10000',
        elements: [
          { text: 'Steps' },
          { text: '8,421', frame: FRAME_LARGE },
          { text: 'Goal' },
          { text: '10000', frame: FRAME_SMALL },
        ],
      },
    ]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'ok', steps: 8421, confidence: 'high' });
  });

  it('rejects a value below the minimum plausible step count', () => {
    const result = resultFromLines([{ text: 'Steps 42' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'no_candidate' });
  });

  it('rejects a value above the maximum plausible step count', () => {
    const result = resultFromLines([{ text: 'Steps 999,999' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'no_candidate' });
  });

  it('returns no_candidate when there is no numeric text at all', () => {
    const result = resultFromLines([{ text: 'Great job today!' }]);
    expect(extractStepsCandidate(result)).toEqual({ status: 'no_candidate' });
  });

  it('returns no_candidate for an empty result', () => {
    expect(extractStepsCandidate(resultFromLines([]))).toEqual({ status: 'no_candidate' });
  });
});
