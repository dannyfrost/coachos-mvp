import type { OcrResult } from 'rn-mlkit-ocr';

const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;
const NUMBER_TOKEN = /\d{1,3}[.,]\d{1}|\d{1,3}/g;
const VALID_FORMAT = /^\d{1,3}(\.\d{1})?$/;
const KG_LABEL = /\bkg\b/i;

type Candidate = {
  value: number;
  area: number;
  nearKg: boolean;
};

/**
 * Extracts the most plausible weight reading (kg) from an OCR result.
 * Pure function, no native/camera dependency — independently testable.
 * Returns null when no candidate in the valid range/format is found.
 */
export function extractWeightCandidate(result: OcrResult): number | null {
  const candidates: Candidate[] = [];

  for (const block of result.blocks) {
    for (const line of block.lines) {
      const matches = line.text.match(NUMBER_TOKEN);
      if (!matches) continue;

      // "Near a kg label" is deliberately scoped to the number's own line,
      // not the whole block — crediting sibling lines in the same block
      // let unrelated numbers (e.g. a battery-level readout) inherit a
      // neighboring line's "kg" text and outrank the real weight reading.
      const nearKg = KG_LABEL.test(line.text);

      for (const raw of matches) {
        const normalized = raw.replace(',', '.');
        if (!VALID_FORMAT.test(normalized)) continue;

        const value = parseFloat(normalized);
        if (isNaN(value) || value < MIN_WEIGHT_KG || value > MAX_WEIGHT_KG) continue;

        candidates.push({
          value,
          area: line.frame.width * line.frame.height,
          nearKg,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.nearKg !== b.nearKg) return a.nearKg ? -1 : 1;
    return b.area - a.area;
  });

  return candidates[0].value;
}
