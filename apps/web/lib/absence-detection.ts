export type AbsenceLevel = '24h' | '48h' | '72h'

export function levelForDaysAbsent(daysAbsent: number): AbsenceLevel | null {
  if (daysAbsent >= 3) return '72h'
  if (daysAbsent === 2) return '48h'
  if (daysAbsent === 1) return '24h'
  return null
}
