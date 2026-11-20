export const MIN_WEIGHT_KG = 30
export const MAX_WEIGHT_KG = 300

// The model is told to reply with ONLY the number. Accept only that: a reply
// with extra words ("rotated 90 degrees: 81.70") is rejected, never guessed at,
// so a stray angle can't be logged as a weight.
export function parseWeightKg(text: string): number | null {
  const m = /^(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:kg)?\.?$/i.exec(text.trim())
  if (!m) return null
  const kg = parseFloat(m[1].replace(',', '.'))
  return kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG ? kg : null
}
