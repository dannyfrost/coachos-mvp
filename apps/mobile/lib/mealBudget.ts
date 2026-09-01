/**
 * Pure meal-budget math for the Home "Today" panel and Meals tab.
 * No native/network/storage calls — same isolation pattern as stepsSync.ts.
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_CAP = 1850;

export const MEAL_KCAL: Record<MealType, number> = {
  breakfast: 450,
  lunch: 550,
  dinner: 650,
  snack: 200,
};

// Shared labelled sitting order for the Home "Today" panel and Meals tab —
// both screens rendered a byte-identical copy of this array locally; this is
// the single source of truth they now both import.
export const MEAL_TYPE_ORDER: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snack' },
];

export function computeKcalLeft(loggedTypes: MealType[]): number {
  const uniqueLogged = new Set(loggedTypes);
  const spent = Array.from(uniqueLogged).reduce((sum, t) => sum + MEAL_KCAL[t], 0);
  return Math.max(0, MEAL_CAP - spent);
}

export type SittingSliceState = 'filled' | 'selected' | 'empty';

export function sittingSliceState(
  type: MealType,
  selected: MealType | null,
  loggedTypes: MealType[]
): SittingSliceState {
  if (loggedTypes.includes(type)) return 'filled';
  if (selected === type) return 'selected';
  return 'empty';
}
