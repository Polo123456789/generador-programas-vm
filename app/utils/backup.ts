import type { MeetingProgram, ProgramWeek, SchoolAssignment, SingleAssignment } from './assignments'
import type { AssignmentHistoryRecord, Participant, ParticipantRole } from './participants'
import { PARTICIPANT_ROLES } from './participants'
import { getProgramSlots } from './programSlots'

export const BACKUP_VERSION = 1

export interface AppBackup {
  version: typeof BACKUP_VERSION
  exportedAt: string
  sourceUrl: string
  program: MeetingProgram | null
  participants: Participant[]
  assignmentHistory: AssignmentHistoryRecord[]
}

export interface BackupSummary {
  exportedAt: string
  weeks: number
  participants: number
  historyRecords: number
  hasProgram: boolean
}

export function createBackup(
  program: MeetingProgram | null,
  participants: Participant[],
  assignmentHistory: AssignmentHistoryRecord[],
  sourceUrl: string,
): AppBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sourceUrl,
    program: clone(program),
    participants: clone(participants),
    assignmentHistory: clone(assignmentHistory),
  }
}

export function parseBackup(raw: string): AppBackup {
  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    throw new Error('El archivo no contiene JSON válido.')
  }

  if (!isRecord(value) || value.version !== BACKUP_VERSION) {
    throw new Error(`Versión de respaldo no compatible. Se esperaba la versión ${BACKUP_VERSION}.`)
  }
  if (
    typeof value.exportedAt !== 'string'
    || Number.isNaN(Date.parse(value.exportedAt))
    || typeof value.sourceUrl !== 'string'
    || !Array.isArray(value.participants)
    || !value.participants.every(isParticipant)
    || !Array.isArray(value.assignmentHistory)
    || !value.assignmentHistory.every(isHistoryRecord)
    || (value.program !== null && !isMeetingProgram(value.program))
  ) {
    throw new Error('El respaldo está incompleto o tiene datos con un formato inválido.')
  }

  const participantIds = new Set<string>()
  for (const participant of value.participants) {
    if (participantIds.has(participant.id)) {
      throw new Error(`El respaldo contiene un ID de participante duplicado: ${participant.id}.`)
    }
    participantIds.add(participant.id)
  }

  const historyIds = new Set<string>()
  for (const record of value.assignmentHistory) {
    if (historyIds.has(record.id)) {
      throw new Error(`El respaldo contiene un registro histórico duplicado: ${record.id}.`)
    }
    historyIds.add(record.id)
    assertKnownParticipants(record.participantIds, participantIds, `el historial ${record.id}`)
  }

  if (value.program) {
    const assignedIds = getProgramSlots(value.program)
      .map(slot => slot.participantId)
      .filter((id): id is string => Boolean(id))
    assertKnownParticipants(assignedIds, participantIds, 'el programa')
  }

  return clone(value as unknown as AppBackup)
}

export function summarizeBackup(backup: AppBackup): BackupSummary {
  return {
    exportedAt: backup.exportedAt,
    weeks: backup.program?.weeks.length ?? 0,
    participants: backup.participants.length,
    historyRecords: backup.assignmentHistory.length,
    hasProgram: backup.program !== null,
  }
}

function isMeetingProgram(value: unknown): value is MeetingProgram {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.createdAt === 'number'
    && Number.isFinite(value.createdAt)
    && Array.isArray(value.weeks)
    && value.weeks.every(isProgramWeek)
}

function isProgramWeek(value: unknown): value is ProgramWeek {
  return isRecord(value)
    && typeof value.date === 'string'
    && Array.isArray(value.songs)
    && value.songs.every(song => typeof song === 'number' && Number.isFinite(song))
    && isNullableString(value.presidentId)
    && typeof value.assignedReading === 'string'
    && isSingleAssignment(value.treasures)
    && isSingleAssignment(value.gems)
    && isSingleAssignment(value.reading)
    && Array.isArray(value.school)
    && value.school.every(isSchoolAssignment)
    && Array.isArray(value.livingSpeeches)
    && value.livingSpeeches.every(isSingleAssignment)
    && isNullableString(value.bookConductorId)
    && isNullableString(value.bookReaderId)
    && isNullableString(value.finalPrayerId)
}

function isSingleAssignment(value: unknown): value is SingleAssignment {
  return isRecord(value)
    && typeof value.title === 'string'
    && typeof value.duration === 'number'
    && Number.isFinite(value.duration)
    && isNullableString(value.participantId)
}

function isSchoolAssignment(value: unknown): value is SchoolAssignment {
  return isRecord(value)
    && typeof value.title === 'string'
    && typeof value.duration === 'number'
    && Number.isFinite(value.duration)
    && isNullableString(value.conductorId)
    && (value.studentId === undefined || isNullableString(value.studentId))
}

function isParticipant(value: unknown): value is Participant {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && (value.gender === 'M' || value.gender === 'F')
    && typeof value.hidden === 'boolean'
    && Array.isArray(value.eligibleRoles)
    && value.eligibleRoles.every(isParticipantRole)
}

function isHistoryRecord(value: unknown): value is AssignmentHistoryRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.programId === undefined || typeof value.programId === 'string')
    && (value.slotKey === undefined || typeof value.slotKey === 'string')
    && Array.isArray(value.participantIds)
    && value.participantIds.length > 0
    && value.participantIds.every(id => typeof id === 'string')
    && (isParticipantRole(value.assignmentRole) || value.assignmentRole === 'legacyReading' || value.assignmentRole === 'legacySchool')
    && typeof value.assignmentTitle === 'string'
    && typeof value.weekDate === 'string'
    && (value.chronologicalOrder === undefined || (typeof value.chronologicalOrder === 'number' && Number.isFinite(value.chronologicalOrder)))
    && typeof value.updatedAt === 'number'
    && Number.isFinite(value.updatedAt)
}

function assertKnownParticipants(
  referencedIds: string[],
  participantIds: Set<string>,
  context: string,
): void {
  const unknownId = referencedIds.find(id => !participantIds.has(id))
  if (unknownId) {
    throw new Error(`El respaldo hace referencia a un participante inexistente (${unknownId}) en ${context}.`)
  }
}

function isParticipantRole(value: unknown): value is ParticipantRole {
  return typeof value === 'string' && PARTICIPANT_ROLES.includes(value as ParticipantRole)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
