import type { AssignmentRecord, AssignmentType, Student } from '~/types/domain'

export interface StudentCandidate extends Student {
  assignedThisWeek: boolean
  lastAssignmentDate: string | null
  lastAssignmentStart: string | null
}

export interface CompanionCandidate extends StudentCandidate {
  lastTimeTogether: string | null
  lastTimeTogetherStart: string | null
}

function recordIsInRange(
  record: AssignmentRecord,
  weekStart: string | null,
  currentSlotId: string,
): boolean {
  if (record.slotId === currentSlotId) return false
  return !weekStart || !record.weekStart || record.weekStart <= weekStart
}

function recordIncludesStudent(record: AssignmentRecord, studentId: string): boolean {
  return record.studentId === studentId || record.companionId === studentId
}

function isMoreRecent(candidate: AssignmentRecord, current: AssignmentRecord | undefined): boolean {
  if (!current) return true
  if (candidate.weekStart && current.weekStart) return candidate.weekStart > current.weekStart
  if (candidate.weekStart) return true
  if (current.weekStart) return false
  return candidate.updatedAt > current.updatedAt
}

function compareCandidates(a: StudentCandidate, b: StudentCandidate): number {
  if (a.assignedThisWeek !== b.assignedThisWeek) return a.assignedThisWeek ? 1 : -1
  if (Boolean(a.lastAssignmentDate) !== Boolean(b.lastAssignmentDate)) {
    return a.lastAssignmentDate ? 1 : -1
  }
  if (!a.lastAssignmentStart && b.lastAssignmentStart) return -1
  if (a.lastAssignmentStart && !b.lastAssignmentStart) return 1
  if (a.lastAssignmentStart !== b.lastAssignmentStart) {
    return (a.lastAssignmentStart ?? '').localeCompare(b.lastAssignmentStart ?? '')
  }
  return a.name.localeCompare(b.name, 'es')
}

function latestAssignmentsByStudent(
  history: Record<string, AssignmentRecord>,
  type: AssignmentType,
  weekStart: string | null,
  currentSlotId: string,
): Map<string, AssignmentRecord> {
  const latest = new Map<string, AssignmentRecord>()
  for (const record of Object.values(history)) {
    if (record.assignmentType !== type || !recordIsInRange(record, weekStart, currentSlotId)) continue
    const studentIds = [record.studentId, record.companionId].filter((id): id is string => Boolean(id))
    for (const studentId of studentIds) {
      const current = latest.get(studentId)
      if (isMoreRecent(record, current)) latest.set(studentId, record)
    }
  }
  return latest
}

export function getStudentCandidates(
  students: Student[],
  history: Record<string, AssignmentRecord>,
  type: AssignmentType,
  weekId: string,
  weekStart: string | null,
  currentSlotId: string,
): StudentCandidate[] {
  const latest = latestAssignmentsByStudent(history, type, weekStart, currentSlotId)
  const records = Object.values(history).filter(record => recordIsInRange(record, weekStart, currentSlotId))

  return students
    .filter(student => !student.hidden)
    .map((student) => {
      const lastAssignment = latest.get(student.id)
      return {
        ...student,
        assignedThisWeek: records.some(record => record.weekId === weekId && recordIncludesStudent(record, student.id)),
        lastAssignmentDate: lastAssignment?.weekDate ?? null,
        lastAssignmentStart: lastAssignment?.weekStart ?? null,
      }
    })
    .sort(compareCandidates)
}

export function getCompanionCandidates(
  students: Student[],
  history: Record<string, AssignmentRecord>,
  mainStudentId: string,
  type: AssignmentType,
  weekId: string,
  weekStart: string | null,
  currentSlotId: string,
): CompanionCandidate[] {
  const mainStudent = students.find(student => student.id === mainStudentId)
  if (!mainStudent) return []

  const baseCandidates = getStudentCandidates(
    students,
    history,
    type,
    weekId,
    weekStart,
    currentSlotId,
  )
  const records = Object.values(history).filter(record => recordIsInRange(record, weekStart, currentSlotId))

  return baseCandidates
    .filter(student => student.id !== mainStudentId && student.gender === mainStudent.gender)
    .map((student) => {
      const lastTogether = records
        .filter(record => (
          record.studentId === mainStudentId && record.companionId === student.id
        ) || (
          record.studentId === student.id && record.companionId === mainStudentId
        ))
        .sort((a, b) => {
          if (a.weekStart && b.weekStart) return b.weekStart.localeCompare(a.weekStart)
          return b.updatedAt - a.updatedAt
        })[0]

      return {
        ...student,
        lastTimeTogether: lastTogether?.weekDate ?? null,
        lastTimeTogetherStart: lastTogether?.weekStart ?? null,
      }
    })
    .sort((a, b) => {
      if (a.assignedThisWeek !== b.assignedThisWeek) return a.assignedThisWeek ? 1 : -1
      if (Boolean(a.lastTimeTogether) !== Boolean(b.lastTimeTogether)) {
        return a.lastTimeTogether ? 1 : -1
      }
      if (!a.lastTimeTogetherStart && b.lastTimeTogetherStart) return -1
      if (a.lastTimeTogetherStart && !b.lastTimeTogetherStart) return 1
      if (a.lastTimeTogetherStart !== b.lastTimeTogetherStart) {
        return (a.lastTimeTogetherStart ?? '').localeCompare(b.lastTimeTogetherStart ?? '')
      }
      return compareCandidates(a, b)
    })
}
