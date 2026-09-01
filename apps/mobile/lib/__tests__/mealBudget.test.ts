import {
  MEAL_CAP,
  MEAL_KCAL,
  computeKcalLeft,
  sittingSliceState,
  parsePlanMealBudget,
  mealKcalMap,
  mealCap,
} from '../mealBudget';

describe('meal budget constants', () => {
  it('caps at 1850 with the four spec\'d sitting budgets', () => {
    expect(MEAL_CAP).toBe(1850);
    expect(MEAL_KCAL).toEqual({ breakfast: 450, lunch: 550, dinner: 650, snack: 200 });
  });
});

describe('computeKcalLeft', () => {
  it('returns the full cap when nothing is logged', () => {
    expect(computeKcalLeft([])).toBe(1850);
  });

  it('subtracts each logged sitting\'s budget', () => {
    expect(computeKcalLeft(['breakfast'])).toBe(1400);
    expect(computeKcalLeft(['breakfast', 'lunch'])).toBe(850);
  });

  it('never returns below zero even if all four are logged', () => {
    expect(computeKcalLeft(['breakfast', 'lunch', 'dinner', 'snack'])).toBe(0);
  });

  it('ignores duplicate entries for the same sitting', () => {
    expect(computeKcalLeft(['breakfast', 'breakfast'])).toBe(1400);
  });

  it('uses an overridden cap/kcal map when a coach-set plan budget is passed', () => {
    const kcalMap = { breakfast: 300, lunch: 400, dinner: 500, snack: 100 };
    expect(computeKcalLeft(['breakfast'], 2000, kcalMap)).toBe(1700);
    expect(computeKcalLeft([], 2000, kcalMap)).toBe(2000);
  });
});

describe('parsePlanMealBudget', () => {
  it('returns null for a plan with no mealBudget set', () => {
    expect(parsePlanMealBudget(null)).toBeNull();
    expect(parsePlanMealBudget({ body: 'some notes' })).toBeNull();
  });

  it('returns null when mealBudget is present but malformed (missing/non-numeric fields)', () => {
    expect(parsePlanMealBudget({ mealBudget: { cap: 2000 } })).toBeNull();
    expect(
      parsePlanMealBudget({ mealBudget: { cap: '2000', breakfast: 400, lunch: 500, dinner: 600, snack: 200 } })
    ).toBeNull();
  });

  it('returns null when any field is zero or negative', () => {
    expect(
      parsePlanMealBudget({ mealBudget: { cap: 2000, breakfast: 0, lunch: 500, dinner: 600, snack: 200 } })
    ).toBeNull();
  });

  it('parses a well-formed coach-set budget', () => {
    expect(
      parsePlanMealBudget({ mealBudget: { cap: 2000, breakfast: 400, lunch: 500, dinner: 600, snack: 200 } })
    ).toEqual({ cap: 2000, breakfast: 400, lunch: 500, dinner: 600, snack: 200 });
  });
});

describe('mealKcalMap / mealCap', () => {
  it('fall back to the fixed defaults when there is no plan budget', () => {
    expect(mealKcalMap(null)).toBe(MEAL_KCAL);
    expect(mealCap(null)).toBe(MEAL_CAP);
  });

  it('use the plan budget\'s own values when one is provided', () => {
    const budget = { cap: 2000, breakfast: 400, lunch: 500, dinner: 600, snack: 200 };
    expect(mealKcalMap(budget)).toEqual({ breakfast: 400, lunch: 500, dinner: 600, snack: 200 });
    expect(mealCap(budget)).toBe(2000);
  });
});

describe('sittingSliceState', () => {
  it('is "filled" (navy) once that sitting is logged, regardless of selection', () => {
    expect(sittingSliceState('breakfast', null, ['breakfast'])).toBe('filled');
    expect(sittingSliceState('breakfast', 'lunch', ['breakfast'])).toBe('filled');
  });

  it('is "selected" (outlined "now") when picked but not yet logged', () => {
    expect(sittingSliceState('lunch', 'lunch', [])).toBe('selected');
  });

  it('is "empty" when neither selected nor logged', () => {
    expect(sittingSliceState('dinner', 'lunch', ['breakfast'])).toBe('empty');
  });

  it('prefers "filled" over "selected" when a sitting is both selected and already logged', () => {
    expect(sittingSliceState('snack', 'snack', ['snack'])).toBe('filled');
  });
});
