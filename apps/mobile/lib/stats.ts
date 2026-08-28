/**
 * Client-side stats & streak calculation helpers
 */

function stepBackOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayISO(todayISO: string = getTodayISO()): string {
  return stepBackOneDay(todayISO);
}

/**
 * Compute the consecutive daily logging streak ending today (or ending yesterday if today is not logged yet).
 */
export function computeStreak(
  logDates: string[],
  todayISO: string = getTodayISO()
): number {
  if (!logDates || logDates.length === 0) return 0;

  const dateSet = new Set(logDates);
  let streak = 0;
  let currentCheck = todayISO;

  if (dateSet.has(currentCheck)) {
    // Streak includes today
    streak = 1;
    currentCheck = stepBackOneDay(currentCheck);
    while (dateSet.has(currentCheck)) {
      streak += 1;
      currentCheck = stepBackOneDay(currentCheck);
    }
    return streak;
  }

  // Today is not logged yet — check if streak was active through yesterday
  const yesterday = stepBackOneDay(todayISO);
  if (dateSet.has(yesterday)) {
    streak = 1;
    currentCheck = stepBackOneDay(yesterday);
    while (dateSet.has(currentCheck)) {
      streak += 1;
      currentCheck = stepBackOneDay(currentCheck);
    }
    return streak;
  }

  return 0;
}

/**
 * Formats a YYYY-MM-DD or ISO string into a short date, e.g. "8 May"
 */
export function fmtDateShort(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return dateStr;
  }
}
