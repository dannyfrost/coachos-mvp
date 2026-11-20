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

export const MIN_STEPS = 100
export const MAX_STEPS = 200000

// Steps reply: the model outputs ONLY the integer step count, commas/periods
// allowed as thousands separators ("8,421", "8421"). Reject anything else so a
// stray calories/distance number or prose can't be logged as steps. Range
// mirrors the mobile stepsOcr.ts constants.
export function parseSteps(text: string): number | null {
  const m = /^(\d{1,3}(?:[.,]\d{3})*|\d{1,6})\.?$/.exec(text.trim())
  if (!m) return null
  const steps = parseInt(m[1].replace(/[.,]/g, ''), 10)
  return Number.isFinite(steps) && steps >= MIN_STEPS && steps <= MAX_STEPS ? steps : null
}
