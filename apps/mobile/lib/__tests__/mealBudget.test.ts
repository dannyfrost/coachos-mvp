import { MEAL_CAP, MEAL_KCAL, computeKcalLeft, sittingSliceState } from '../mealBudget';

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
