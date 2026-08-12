import type { ProgramSlot } from '../programSlots'
import { getProgramSlots } from '../programSlots'
import { normalizeAssignmentTitle } from './helpers'
import type { SanityCheck, SanityFinding } from './types'

interface ConsecutiveAssignment {
  participantId: string
  identity: string
  slotKey: string
  title: string
}

export const checkConsecutiveAssignments: SanityCheck = ({ program }) => {
  const programSlots = getProgramSlots(program)
  const assignmentsByWeek = program.weeks.map((_, weekIndex): ConsecutiveAssignment[] => (
    programSlots
      .filter(slot => slot.weekIndex === weekIndex && slot.participantId)
      .map(slot => ({
        participantId: slot.participantId!,
        identity: assignmentIdentity(slot),
        slotKey: slot.key,
        title: slot.assignmentTitle,
      }))
  ))

  const findings: SanityFinding[] = []
  for (let weekIndex = 1; weekIndex < assignmentsByWeek.length; weekIndex += 1) {
    const previousWeek = assignmentsByWeek[weekIndex - 1] ?? []
    const currentWeek = assignmentsByWeek[weekIndex] ?? []
    const previousByKey = new Map<string, ConsecutiveAssignment[]>()
    previousWeek.forEach((assignment) => {
      const key = `${assignment.participantId}:${assignment.identity}`
      const matchingAssignments = previousByKey.get(key) ?? []
      matchingAssignments.push(assignment)
      previousByKey.set(key, matchingAssignments)
    })

    currentWeek.forEach((assignment) => {
      const key = `${assignment.participantId}:${assignment.identity}`
      const previousAssignments = previousByKey.get(key)
      if (!previousAssignments) return

      const weeks = [program.weeks[weekIndex - 1]!.date, program.weeks[weekIndex]!.date]
      findings.push({
        id: `consecutive:${weekIndex}:${key}`,
        rule: 'consecutiveAssignment',
        participantIds: [assignment.participantId],
        reason: `Recibió ${assignment.title} en dos semanas consecutivas.`,
        weeks,
        assignments: [assignment.title],
        slotKeys: [...new Set([
          ...previousAssignments.map(previousAssignment => previousAssignment.slotKey),
          assignment.slotKey,
        ])],
      })
    })
  }

  return findings
}

function assignmentIdentity(slot: ProgramSlot): string {
  if (slot.role === 'school' || slot.role === 'livingSpeech') {
    return `${slot.role}:${normalizeAssignmentTitle(slot.assignmentTitle)}`
  }
  return slot.role
}
