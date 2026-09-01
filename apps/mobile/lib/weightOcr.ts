import type { OcrResult } from 'rn-mlkit-ocr';

const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;
const NUMBER_TOKEN = /\d{1,3}[.,]\d{1}|\d{1,3}/g;
const VALID_FORMAT = /^\d{1,3}(\.\d{1})?$/;
const KG_LABEL = /\bkg\b/i;
const LB_LABEL = /\b(lbs?|pounds?)\b/i;

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
      // "Near a kg label" is deliberately scoped to the number's own line,
      // not the whole block — crediting sibling lines in the same block
      // let unrelated numbers (e.g. a battery-level readout) inherit a
      // neighboring line's "kg" text and outrank the real weight reading.
      const nearKg = KG_LABEL.test(line.text);

      // A line labeled lb/lbs/pounds is a real body-weight number, but in
      // the wrong unit for this field (kg-only). Its digits fall inside
      // the same 30-300 "plausible weight" range as a kg reading, so
      // without this check a correctly-read lbs value gets silently
      // accepted as if it were kg — same digits, badly wrong value. Drop
      // the whole line's candidates rather than guess a conversion: the
      // photographed number might be lbs on a bathroom scale, or might be
      // something else entirely next to an unrelated "lb" abbreviation.
      if (LB_LABEL.test(line.text)) continue;

      // Score each number by its OWN element's bounding box, not the
      // shared line box. A line can carry more than one number (e.g. a
      // weight reading next to a BMI/delta value on the same visual row)
      // — scoring by the line's box gives every number on that line the
      // identical (inflated) area, so the real, visually largest reading
      // loses its area advantage and the tiebreak degenerates to
      // left-to-right text order instead of actual on-screen size.
      for (const element of line.elements) {
        const matches = element.text.match(NUMBER_TOKEN);
        if (!matches) continue;

        for (const raw of matches) {
          const normalized = raw.replace(',', '.');
          if (!VALID_FORMAT.test(normalized)) continue;

          const value = parseFloat(normalized);
          if (isNaN(value) || value < MIN_WEIGHT_KG || value > MAX_WEIGHT_KG) continue;

          candidates.push({
            value,
            area: element.frame.width * element.frame.height,
            nearKg,
          });
        }
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
