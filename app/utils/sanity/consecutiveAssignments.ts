import { normalizeAssignmentTitle } from './helpers'
import type { SanityCheck, SanityFinding } from './types'

interface StudentAssignment {
  participantId: string
  normalizedTitle: string
  title: string
}

export const checkConsecutiveAssignments: SanityCheck = ({ program }) => {
  const assignmentsByWeek = program.weeks.map((week): StudentAssignment[] => {
    const assignments: StudentAssignment[] = []
    if (week.reading.participantId) {
      assignments.push({
        participantId: week.reading.participantId,
        normalizedTitle: 'lectura',
        title: 'Lectura',
      })
    }

    week.school.forEach((assignment) => {
      const normalizedTitle = normalizeAssignmentTitle(assignment.title)
      if (assignment.conductorId) {
        assignments.push({
          participantId: assignment.conductorId,
          normalizedTitle,
          title: assignment.title,
        })
      }
      if (assignment.studentId) {
        assignments.push({
          participantId: assignment.studentId,
          normalizedTitle,
          title: assignment.title,
        })
      }
    })
    return assignments
  })

  const findings: SanityFinding[] = []
  for (let weekIndex = 1; weekIndex < assignmentsByWeek.length; weekIndex += 1) {
    const previousWeek = assignmentsByWeek[weekIndex - 1] ?? []
    const currentWeek = assignmentsByWeek[weekIndex] ?? []
    const previousKeys = new Set(
      previousWeek.map(assignment => `${assignment.participantId}:${assignment.normalizedTitle}`),
    )

    currentWeek.forEach((assignment) => {
      const key = `${assignment.participantId}:${assignment.normalizedTitle}`
      if (!previousKeys.has(key)) return

      const weeks = [program.weeks[weekIndex - 1]!.date, program.weeks[weekIndex]!.date]
      findings.push({
        id: `consecutive:${weekIndex}:${key}`,
        rule: 'consecutiveAssignment',
        participantIds: [assignment.participantId],
        reason: `Recibió ${assignment.title} en dos semanas consecutivas.`,
        weeks,
        assignments: [assignment.title],
      })
    })
  }

  return findings
}
