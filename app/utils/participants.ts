export type ParticipantGender = 'M' | 'F'

export type ParticipantRole =
  | 'president'
  | 'treasures'
  | 'gems'
  | 'reading'
  | 'school'
  | 'livingSpeech'
  | 'bookConductor'
  | 'bookReader'
  | 'finalPrayer'

export interface Participant {
  id: string
  name: string
  gender: ParticipantGender
  hidden: boolean
  eligibleRoles: ParticipantRole[]
}

export interface AssignmentHistoryRecord {
  id: string
  programId?: string
  slotKey?: string
  participantIds: string[]
  assignmentRole: ParticipantRole | 'legacyReading' | 'legacySchool'
  assignmentTitle: string
  weekDate: string
  chronologicalOrder?: number
  updatedAt: number
}

export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  president: 'Presidente',
  treasures: 'Tesoros de la Biblia',
  gems: 'Busquemos perlas escondidas',
  reading: 'Lectura de la Biblia',
  school: 'Seamos Mejores Maestros',
  livingSpeech: 'Nuestra Vida Cristiana',
  bookConductor: 'Conductor del estudio bíblico',
  bookReader: 'Lector del estudio bíblico',
  finalPrayer: 'Oración final',
}

export const PARTICIPANT_ROLES = Object.keys(PARTICIPANT_ROLE_LABELS) as ParticipantRole[]

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export function normalizeParticipantRoles(
  gender: ParticipantGender,
  roles: ParticipantRole[],
): ParticipantRole[] {
  if (gender === 'F') return ['school']
  return PARTICIPANT_ROLES.filter(role => roles.includes(role))
}

export function isParticipantEligible(participant: Participant, role: ParticipantRole): boolean {
  if (participant.hidden) return false
  if (participant.gender === 'F') return role === 'school'
  return participant.eligibleRoles.includes(role)
}
