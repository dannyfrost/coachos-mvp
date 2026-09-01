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

/**
 * `cap`/`kcalMap` default to the fixed constants above but can be overridden
 * per-call with a coach-set plan budget (see PlanMealBudget below) — the
 * math itself doesn't change, only which numbers it's computed against.
 */
export function computeKcalLeft(
  loggedTypes: MealType[],
  cap: number = MEAL_CAP,
  kcalMap: Record<MealType, number> = MEAL_KCAL
): number {
  const uniqueLogged = new Set(loggedTypes);
  const spent = Array.from(uniqueLogged).reduce((sum, t) => sum + kcalMap[t], 0);
  return Math.max(0, cap - spent);
}

export type PlanMealBudget = {
  cap: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
};

/**
 * Reads a coach-set meal budget out of a plan's `content` JSONB (shape
 * written by the coach-web Plans screen). Returns null for anything that
 * isn't a well-formed budget — including a plan with no budget set at all —
 * so the caller can fall back to MEAL_CAP/MEAL_KCAL uniformly.
 */
export function parsePlanMealBudget(content: unknown): PlanMealBudget | null {
  if (content == null || typeof content !== 'object') return null;
  const mb = (content as Record<string, unknown>).mealBudget;
  if (mb == null || typeof mb !== 'object') return null;
  const m = mb as Record<string, unknown>;
  const nums = [m.cap, m.breakfast, m.lunch, m.dinner, m.snack];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)) return null;
  return {
    cap: m.cap as number,
    breakfast: m.breakfast as number,
    lunch: m.lunch as number,
    dinner: m.dinner as number,
    snack: m.snack as number,
  };
}

export function mealKcalMap(budget: PlanMealBudget | null): Record<MealType, number> {
  if (!budget) return MEAL_KCAL;
  return { breakfast: budget.breakfast, lunch: budget.lunch, dinner: budget.dinner, snack: budget.snack };
}

export function mealCap(budget: PlanMealBudget | null): number {
  return budget?.cap ?? MEAL_CAP;
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
