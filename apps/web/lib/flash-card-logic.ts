export type FlashCardStatus = 'green' | 'yellow' | 'red'

export interface FlashCardComputeResult {
  status: FlashCardStatus
  reason: string
  interpretation: string | null
}

export function getIntSetting(settings: unknown, key: string, fallback: number): number {
  if (settings !== null && typeof settings === 'object' && !Array.isArray(settings)) {
    const val = (settings as Record<string, unknown>)[key]
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) return Math.floor(val)
  }
  return fallback
}

export function daysBetween(utcToday: string, logDate: string): number {
  return Math.floor(
    (new Date(utcToday).getTime() - new Date(logDate).getTime()) / (1000 * 60 * 60 * 24)
  )
}

/**
 * Pure classification: paused override, then absence thresholds, then weight
 * stagnation. Mirrors app/api/flash-cards/compute/route.ts exactly — keep in
 * sync if the rule changes there.
 */
export function computeFlashCard(params: {
  clientStatus: string
  hasLog: boolean
  daysAbsent: number
  warningDays: number
  criticalDays: number
  stagnationDays: number
  recentWeights: number[]
}): FlashCardComputeResult {
  const { clientStatus, hasLog, daysAbsent, warningDays, criticalDays, stagnationDays, recentWeights } = params

  if (clientStatus === 'paused') {
    return { status: 'yellow', reason: 'client paused', interpretation: null }
  }

  if (!hasLog) {
    return { status: 'red', reason: 'no check-ins recorded', interpretation: 'no data available' }
  }

  if (daysAbsent > criticalDays) {
    return {
      status: 'red',
      reason: `no check-in for ${daysAbsent} days`,
      interpretation: 'extended absence detected',
    }
  }

  if (daysAbsent > warningDays) {
    return {
      status: 'yellow',
      reason: `missed check-in for ${daysAbsent} days`,
      interpretation: 'absence warning threshold reached',
    }
  }

  const uniqueWeights = new Set(recentWeights)
  if (recentWeights.length >= stagnationDays && uniqueWeights.size === 1) {
    return {
      status: 'yellow',
      reason: `weight unchanged for ${stagnationDays} days`,
      interpretation: 'stagnation despite compliance',
    }
  }

  return { status: 'green', reason: 'on track', interpretation: null }
}
