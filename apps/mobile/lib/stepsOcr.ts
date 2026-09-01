import type { OcrResult } from 'rn-mlkit-ocr';

const MIN_STEPS = 100;
const MAX_STEPS = 200000;

// Matches step-count formatting: comma/period thousands separators
// followed by exactly 3 digits ("8,421", "8.421", "12,345"), or a bare
// run of digits ("8421"). Deliberately does NOT match a single-decimal
// pattern like weightOcr.ts's NUMBER_TOKEN — "5.2" (a km distance) must
// NOT be treated as a thousands-separated step count.
const NUMBER_TOKEN = /\d{1,3}(?:[,.]\d{3})+|\d{1,6}/g;
const VALID_FORMAT = /^\d{1,3}(?:[,.]\d{3})*$|^\d{1,6}$/;

const STEPS_LABEL = /\bsteps?\b/i;
// Metrics that commonly share a fitness-summary screen with steps and
// must never be mistaken for the step count, even though their numbers
// can fall inside a plausible-looking range.
const COMPETING_LABEL = /\b(calories?|kcal|cal|km|kilometers?|miles?|mi|bpm|heart\s*rate|distance|floors?|active\s*minutes?)\b/i;

type Candidate = {
  value: number;
  area: number;
  nearStepsLabel: boolean;
};

export type StepsOcrResult =
  | { status: 'ok'; steps: number; confidence: 'high' | 'low' }
  | { status: 'no_candidate' };

/**
 * Extracts the most plausible step count from an OCR result of a
 * screenshot/photo of a fitness app's steps display. Mirrors
 * weightOcr.ts's architecture exactly: score each number by its own
 * OCR element (word) bounding box, not the shared line box, so two
 * numbers sharing a line (e.g. "Steps 8,421" next to "Calories 512" on
 * a tight summary row) don't inherit an identical inflated area.
 *
 * A screenshot is a much easier OCR target than the weight-photo case
 * this pattern was built for — crisp, digitally-rendered text, no
 * lighting/angle/blur — so the accuracy risk here is almost entirely in
 * candidate selection (picking the right number among several visible
 * ones), not OCR recognition itself.
 */
export function extractStepsCandidate(result: OcrResult): StepsOcrResult {
  const candidates: Candidate[] = [];

  for (const block of result.blocks) {
    for (const line of block.lines) {
      // A line naming a competing metric (Calories/km/bpm/...) is
      // dropped entirely, the same defensive stance weightOcr.ts takes
      // for lb/lbs lines — don't guess which number on that line might
      // "actually" be steps, just don't offer any of them as candidates.
      if (COMPETING_LABEL.test(line.text)) continue;

      const nearStepsLabel = STEPS_LABEL.test(line.text);

      // Space-thousands-separated formatting ("8 421") isn't one OCR
      // "word" — ML Kit's word segmentation splits it into two adjacent
      // elements. Detect a bare 1-3-digit element immediately followed
      // by a bare exactly-3-digit element on the same line and treat
      // the pair as one merged number, using their combined bounding
      // box. This is best-effort (adjacency alone can't distinguish a
      // genuine split thousands-group from two coincidentally-adjacent
      // unrelated numbers), not a guarantee — the far more common
      // "8,421"/"8421" formats are handled exactly by the per-element
      // pass below regardless of this heuristic firing.
      for (let i = 0; i < line.elements.length - 1; i++) {
        const first = line.elements[i];
        const second = line.elements[i + 1];
        if (!/^\d{1,3}$/.test(first.text) || !/^\d{3}$/.test(second.text)) continue;

        const merged = parseInt(first.text + second.text, 10);
        if (isNaN(merged) || merged < MIN_STEPS || merged > MAX_STEPS) continue;

        candidates.push({
          value: merged,
          area:
            (first.frame.width * first.frame.height) +
            (second.frame.width * second.frame.height),
          nearStepsLabel,
        });
      }

      for (const element of line.elements) {
        const matches = element.text.match(NUMBER_TOKEN);
        if (!matches) continue;

        for (const raw of matches) {
          if (!VALID_FORMAT.test(raw)) continue;

          const normalized = raw.replace(/[,.]/g, '');
          const value = parseInt(normalized, 10);
          if (isNaN(value) || value < MIN_STEPS || value > MAX_STEPS) continue;

          candidates.push({
            value,
            area: element.frame.width * element.frame.height,
            nearStepsLabel,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return { status: 'no_candidate' };

  candidates.sort((a, b) => {
    if (a.nearStepsLabel !== b.nearStepsLabel) return a.nearStepsLabel ? -1 : 1;
    return b.area - a.area;
  });

  const winner = candidates[0];

  // "High confidence" requires the winning number to actually be
  // labeled "steps" nearby — the fallback of "just take the biggest
  // number on screen" (used when no line says "steps" at all, e.g. an
  // unfamiliar app layout) is real but low-confidence, and per the
  // fallback-hierarchy requirement a low-confidence OCR result must
  // never be silently written to the KPI — the caller routes it to a
  // user-confirmation step instead of auto-accepting it.
  const confidence: 'high' | 'low' = winner.nearStepsLabel ? 'high' : 'low';

  return { status: 'ok', steps: winner.value, confidence };
}
