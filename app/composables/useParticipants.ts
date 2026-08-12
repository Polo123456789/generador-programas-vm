import type { Ref } from 'vue'
import { computed, ref } from 'vue'
import type { MeetingProgram } from '~/utils/assignments'
import { buildProgramHistory } from '~/utils/history'
import type {
  AssignmentHistoryRecord,
  Participant,
  ParticipantGender,
  ParticipantRole,
} from '~/utils/participants'
import {
  generateId,
  isParticipantEligible,
  normalizeParticipantRoles,
} from '~/utils/participants'

interface LegacyStudent {
  id: string
  name: string
  gender: ParticipantGender
  hidden?: boolean
}

interface LegacyAssignmentRecord {
  id: string
  studentId: string
  companionId?: string
  assignmentType: 'school' | 'reading'
  weekDate: string
  createdAt: number
}

const PARTICIPANTS_KEY = 'participants:v2'
const HISTORY_KEY = 'assignmentHistory:v2'
const LEGACY_PARTICIPANTS_KEY = 'students'
const LEGACY_HISTORY_KEY = 'assignmentHistory'
const MIGRATION_MARKER_KEY = 'participantsMigration:v2'

let globalParticipants: Ref<Participant[]> | null = null
let globalHistory: Ref<AssignmentHistoryRecord[]> | null = null
let globalLegacyMigrationAvailable: Ref<boolean> | null = null

function safelyParseArray<T>(value: string | null): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function initializeState(): void {
  globalParticipants ??= useLocalStorage<Participant[]>(PARTICIPANTS_KEY, []) as Ref<Participant[]>
  globalHistory ??= useLocalStorage<AssignmentHistoryRecord[]>(HISTORY_KEY, []) as Ref<AssignmentHistoryRecord[]>
  globalLegacyMigrationAvailable ??= ref(
    !window.localStorage.getItem(MIGRATION_MARKER_KEY)
      && Boolean(
        window.localStorage.getItem(LEGACY_PARTICIPANTS_KEY)
        || window.localStorage.getItem(LEGACY_HISTORY_KEY),
      ),
  )
}

export function useParticipants() {
  initializeState()

  const participants = globalParticipants!
  const assignmentHistory = globalHistory!
  const legacyMigrationAvailable = globalLegacyMigrationAvailable!

  const participantsById = computed(() => new Map(
    participants.value.map(participant => [participant.id, participant]),
  ))

  function addParticipant(
    name: string,
    gender: ParticipantGender,
    eligibleRoles: ParticipantRole[],
  ): Participant {
    const participant: Participant = {
      id: generateId(),
      name: name.trim(),
      gender,
      hidden: false,
      eligibleRoles: normalizeParticipantRoles(gender, eligibleRoles),
    }
    participants.value.push(participant)
    return participant
  }

  function toggleParticipantHidden(id: string): void {
    const participant = participants.value.find(candidate => candidate.id === id)
    if (participant) participant.hidden = !participant.hidden
  }

  function setParticipantRoles(id: string, roles: ParticipantRole[]): void {
    const participant = participants.value.find(candidate => candidate.id === id)
    if (participant) participant.eligibleRoles = normalizeParticipantRoles(participant.gender, roles)
  }

  function renameParticipant(id: string, name: string): void {
    const normalizedName = normalizeName(name)
    if (!normalizedName) throw new Error('El nombre es requerido.')
    if (participants.value.some(participant => (
      participant.id !== id && normalizeName(participant.name) === normalizedName
    ))) {
      throw new Error('Ya existe otro participante con ese nombre.')
    }

    const participant = participants.value.find(candidate => candidate.id === id)
    if (!participant) throw new Error('No se encontró el participante.')
    participant.name = name.trim()
  }

  function replaceParticipantData(
    nextParticipants: Participant[],
    nextHistory: AssignmentHistoryRecord[],
  ): void {
    window.localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(nextParticipants))
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
    participants.value = nextParticipants
    assignmentHistory.value = nextHistory
  }

  function getParticipantName(id: string | null | undefined): string {
    if (!id) return ''
    return participantsById.value.get(id)?.name ?? 'Participante no encontrado'
  }

  function getEligibleParticipants(
    role: ParticipantRole,
    sameGenderAsId?: string | null,
  ): Participant[] {
    const requiredGender = sameGenderAsId
      ? participantsById.value.get(sameGenderAsId)?.gender
      : undefined

    return participants.value.filter(participant => (
      isParticipantEligible(participant, role)
      && (!requiredGender || participant.gender === requiredGender)
    ))
  }

  function getLastAssignmentDate(participantId: string, role?: ParticipantRole): string | null {
    const records = assignmentHistory.value
      .filter(record => (
        record.participantIds.includes(participantId)
        && (!role || record.assignmentRole === role)
      ))
      .sort((left, right) => getHistoryOrder(right) - getHistoryOrder(left))

    return records[0]?.weekDate ?? null
  }

  function getLastTimeTogether(firstId: string, secondId: string): string | null {
    const records = assignmentHistory.value
      .filter(record => (
        record.participantIds.includes(firstId)
        && record.participantIds.includes(secondId)
      ))
      .sort((left, right) => getHistoryOrder(right) - getHistoryOrder(left))

    return records[0]?.weekDate ?? null
  }

  function syncProgramHistory(program: MeetingProgram): void {
    const otherRecords = assignmentHistory.value.filter(record => record.programId !== program.id)
    assignmentHistory.value = [...otherRecords, ...buildProgramHistory(program)]
  }

  function migrateLegacyData(): { participants: number, historyRecords: number } {
    const legacyParticipants = safelyParseArray<LegacyStudent>(
      window.localStorage.getItem(LEGACY_PARTICIPANTS_KEY),
    )
    const legacyHistory = safelyParseArray<LegacyAssignmentRecord>(
      window.localStorage.getItem(LEGACY_HISTORY_KEY),
    )

    const legacyIdToParticipantId = new Map<string, string>()
    const participantsByName = new Map(
      participants.value.map(participant => [normalizeName(participant.name), participant]),
    )
    const migratedParticipants: Participant[] = []

    legacyParticipants.forEach((legacyParticipant) => {
      const existingById = participants.value.find(participant => participant.id === legacyParticipant.id)
      const existingByName = participantsByName.get(normalizeName(legacyParticipant.name))
      const existing = existingById ?? existingByName
      if (existing) {
        legacyIdToParticipantId.set(legacyParticipant.id, existing.id)
        return
      }

      const migrated: Participant = {
        id: legacyParticipant.id,
        name: legacyParticipant.name,
        gender: legacyParticipant.gender,
        hidden: Boolean(legacyParticipant.hidden),
        eligibleRoles: legacyParticipant.gender === 'F' ? ['school'] : ['school', 'reading'],
      }
      migratedParticipants.push(migrated)
      participantsByName.set(normalizeName(migrated.name), migrated)
      legacyIdToParticipantId.set(legacyParticipant.id, migrated.id)
    })

    const existingHistoryIds = new Set(assignmentHistory.value.map(record => record.id))
    const migratedHistory = legacyHistory
      .filter(record => !existingHistoryIds.has(`legacy:${record.id}`))
      .map<AssignmentHistoryRecord>(record => ({
        id: `legacy:${record.id}`,
        participantIds: [record.studentId, record.companionId]
          .filter((id): id is string => Boolean(id))
          .map(id => legacyIdToParticipantId.get(id) ?? id),
        assignmentRole: record.assignmentType === 'school' ? 'legacySchool' : 'legacyReading',
        assignmentTitle: record.assignmentType === 'school' ? 'Seamos Mejores Maestros' : 'Lectura',
        weekDate: record.weekDate,
        updatedAt: record.createdAt,
      }))

    const nextParticipants = [...participants.value, ...migratedParticipants]
    const nextHistory = [...assignmentHistory.value, ...migratedHistory]
    window.localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(nextParticipants))
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
    window.localStorage.setItem(MIGRATION_MARKER_KEY, new Date().toISOString())
    participants.value = nextParticipants
    assignmentHistory.value = nextHistory
    legacyMigrationAvailable.value = false

    return {
      participants: migratedParticipants.length,
      historyRecords: migratedHistory.length,
    }
  }

  return {
    participants,
    assignmentHistory,
    legacyMigrationAvailable,
    addParticipant,
    getEligibleParticipants,
    getLastAssignmentDate,
    getLastTimeTogether,
    getParticipantName,
    migrateLegacyData,
    renameParticipant,
    replaceParticipantData,
    setParticipantRoles,
    syncProgramHistory,
    toggleParticipantHidden,
  }
}

function getHistoryOrder(record: AssignmentHistoryRecord): number {
  return record.chronologicalOrder ?? record.updatedAt
}

function normalizeName(name: string): string {
  return name.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
}
