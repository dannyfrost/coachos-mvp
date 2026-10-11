import { computeTodaySteps } from '../stepsNativeCounter';

describe('computeTodaySteps', () => {
  it('anchors a baseline and reports 0 on first-ever read', () => {
    expect(computeTodaySteps(null, 5000, '2026-10-11')).toEqual({
      steps: 0,
      next: { date: '2026-10-11', base: 5000 },
    });
  });

  it('reports steps accrued since the day baseline', () => {
    const r = computeTodaySteps({ date: '2026-10-11', base: 5000 }, 5420, '2026-10-11');
    expect(r.steps).toBe(420);
    expect(r.next).toEqual({ date: '2026-10-11', base: 5000 });
  });

  it('re-anchors on a new day (yesterday steps never leak into today)', () => {
    const r = computeTodaySteps({ date: '2026-10-10', base: 5000 }, 9000, '2026-10-11');
    expect(r.steps).toBe(0);
    expect(r.next).toEqual({ date: '2026-10-11', base: 9000 });
  });

  it('re-anchors when the counter went backwards (reboot)', () => {
    const r = computeTodaySteps({ date: '2026-10-11', base: 8000 }, 120, '2026-10-11');
    expect(r.steps).toBe(0);
    expect(r.next).toEqual({ date: '2026-10-11', base: 120 });
  });

  it('rounds a fractional sensor reading', () => {
    expect(computeTodaySteps({ date: '2026-10-11', base: 100.4 }, 150.9, '2026-10-11').steps).toBe(
      51
    );
  });
});
