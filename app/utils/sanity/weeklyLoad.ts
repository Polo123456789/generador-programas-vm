import { getProgramSlots } from '../programSlots'
import type { SanityCheck } from './types'

export const checkWeeklyLoad: SanityCheck = ({ program }) => {
  const groups = new Map<string, Array<{ slotKey: string, title: string, week: string }>>()

  getProgramSlots(program).forEach((slot) => {
    if (!slot.participantId || slot.role === 'finalPrayer') return
    const key = `${slot.weekIndex}:${slot.participantId}`
    const assignments = groups.get(key) ?? []
    assignments.push({ slotKey: slot.key, title: slot.assignmentTitle, week: slot.weekDate })
    groups.set(key, assignments)
  })

  return [...groups.entries()].flatMap(([key, assignments]) => {
    if (assignments.length < 2) return []
    const participantId = key.substring(key.indexOf(':') + 1)
    return [{
      id: `weekly-load:${key}`,
      rule: 'weeklyLoad' as const,
      participantIds: [participantId],
      reason: `Aparece en ${assignments.length} partes durante la misma semana.`,
      weeks: [assignments[0]!.week],
      assignments: assignments.map(assignment => assignment.title),
      slotKeys: assignments.map(assignment => assignment.slotKey),
    }]
  })
}
