import type { SanityCheck } from './types'

export const checkRoleBalance: SanityCheck = ({ program }) => {
  const roles = new Map<string, Array<{ role: 'Conductor' | 'Estudiante', week: string, title: string }>>()

  program.weeks.forEach((week) => {
    week.school.forEach((assignment) => {
      if (assignment.studentId === undefined) return
      if (assignment.conductorId) {
        appendRole(roles, assignment.conductorId, 'Conductor', week.date, assignment.title)
      }
      if (assignment.studentId) {
        appendRole(roles, assignment.studentId, 'Estudiante', week.date, assignment.title)
      }
    })
  })

  return [...roles.entries()].flatMap(([participantId, participations]) => {
    if (participations.length < 3) return []
    const distinctRoles = new Set(participations.map(participation => participation.role))
    if (distinctRoles.size !== 1) return []

    const role = participations[0]!.role
    return [{
      id: `role-balance:${participantId}`,
      rule: 'roleBalance' as const,
      participantIds: [participantId],
      reason: `Tiene ${participations.length} participaciones en partes de dos personas, siempre como ${role}.`,
      weeks: participations.map(participation => participation.week),
      assignments: participations.map(participation => `${participation.title} (${participation.role})`),
    }]
  })
}

function appendRole(
  roles: Map<string, Array<{ role: 'Conductor' | 'Estudiante', week: string, title: string }>>,
  participantId: string,
  role: 'Conductor' | 'Estudiante',
  week: string,
  title: string,
): void {
  const participations = roles.get(participantId) ?? []
  participations.push({ role, week, title })
  roles.set(participantId, participations)
}
