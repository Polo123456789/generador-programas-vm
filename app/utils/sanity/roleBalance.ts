import type { SanityCheck } from './types'

interface RoleParticipation {
  role: 'Conductor' | 'Estudiante'
  slotKey: string
  week: string
  title: string
}

export const checkRoleBalance: SanityCheck = ({ program }) => {
  const roles = new Map<string, RoleParticipation[]>()

  program.weeks.forEach((week, weekIndex) => {
    week.school.forEach((assignment, assignmentIndex) => {
      if (assignment.studentId === undefined) return
      const slotPrefix = `${weekIndex}:school:${assignmentIndex}`
      if (assignment.conductorId) {
        appendRole(roles, assignment.conductorId, 'Conductor', `${slotPrefix}:conductor`, week.date, assignment.title)
      }
      if (assignment.studentId) {
        appendRole(roles, assignment.studentId, 'Estudiante', `${slotPrefix}:student`, week.date, assignment.title)
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
      slotKeys: participations.map(participation => participation.slotKey),
    }]
  })
}

function appendRole(
  roles: Map<string, RoleParticipation[]>,
  participantId: string,
  role: 'Conductor' | 'Estudiante',
  slotKey: string,
  week: string,
  title: string,
): void {
  const participations = roles.get(participantId) ?? []
  participations.push({ role, slotKey, week, title })
  roles.set(participantId, participations)
}
