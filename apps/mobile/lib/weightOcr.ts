import type { OcrResult } from 'rn-mlkit-ocr';

const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;
// Capture 1 OR 2 decimal places: scales show both "76.40" (→76.4) and
// "79.75". Matching only \d{1} truncated the second decimal, so 79.75
// was read as 79.7. Comma and dot are both accepted as the separator.
const NUMBER_TOKEN = /\d{1,3}[.,]\d{1,2}|\d{1,3}/g;
const VALID_FORMAT = /^\d{1,3}(\.\d{1,2})?$/;
const KG_LABEL = /\bkg\b/i;
const LB_LABEL = /\b(lbs?|pounds?)\b/i;

type Candidate = {
  value: number;
  area: number;
  nearKg: boolean;
  hasDecimal: boolean;
};

/**
 * Extracts the most plausible weight reading (kg) from an OCR result.
 * Pure function, no native/camera dependency — independently testable.
 * Returns null when no candidate in the valid range/format is found,
 * OR when the only candidates are ambiguous (see below).
 *
 * Being in the 30-300 range is NECESSARY but not SUFFICIENT: a battery
 * "55%", a timestamp, or a step count in a screenshot all fall in range.
 * So a candidate is only ACCEPTED when it looks like a real scale
 * reading — either it sits next to a "kg" label, or it carries a decimal
 * (bathroom scales read X.X / X.XX). A bare in-range integer with no kg
 * label is treated as ambiguous and rejected (returns null), which the
 * caller turns into a retake/manual prompt rather than silently logging
 * an unrelated number as the client's weight. This deliberately also
 * rejects a genuine integer reading that has no readable unit — safer to
 * ask for another photo than to guess, since the photo is the proof.
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
      // the whole line's candidates rather than guess a conversion.
      if (LB_LABEL.test(line.text)) continue;

      // Score each number by its OWN element's bounding box, not the
      // shared line box — a line can carry more than one number, and the
      // line box gives every one the same inflated area.
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
            hasDecimal: normalized.includes('.'),
          });
        }
      }
    }
  }

  // Only confident candidates qualify: next to a kg label, or decimal-
  // shaped like a scale reading. Everything else is ambiguous → reject.
  const eligible = candidates.filter((c) => c.nearKg || c.hasDecimal);
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (a.nearKg !== b.nearKg) return a.nearKg ? -1 : 1;
    if (a.hasDecimal !== b.hasDecimal) return a.hasDecimal ? -1 : 1;
    return b.area - a.area;
  });

  return eligible[0].value;
}
