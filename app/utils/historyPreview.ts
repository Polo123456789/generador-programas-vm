import type { AssignmentHistoryRecord, ParticipantRole } from './participants'
import { inferWeekCalendarOrder } from './weekDates'

export function getRoleHistoryRecords(
  history: AssignmentHistoryRecord[],
  role: ParticipantRole,
  before: number,
): AssignmentHistoryRecord[] {
  const order = (record: AssignmentHistoryRecord): number => record.calendarOrder
    ?? inferWeekCalendarOrder(record.weekDate, record.updatedAt)
    ?? record.chronologicalOrder
    ?? record.updatedAt

  return history
    .filter(record => (
      (record.assignmentRole === role || (role === 'reading' && record.assignmentRole === 'legacyReading'))
      && record.participantIds.length > 0
      && order(record) < before
    ))
    .sort((left, right) => order(right) - order(left) || right.updatedAt - left.updatedAt)
    .slice(0, 8)
}

export function getSchoolHistoryWeekRecords(
  history: AssignmentHistoryRecord[],
  anchor: AssignmentHistoryRecord,
): AssignmentHistoryRecord[] {
  return history.filter(record => (
    (record.assignmentRole === 'school' || record.assignmentRole === 'legacySchool')
    && isSameHistoryWeek(record, anchor)
  ))
}

function isSameHistoryWeek(
  record: AssignmentHistoryRecord,
  anchor: AssignmentHistoryRecord,
): boolean {
  if (anchor.programId) {
    if (record.programId !== anchor.programId) return false
  } else if (record.programId) {
    return false
  }

  const recordCalendarOrder = record.calendarOrder
    ?? inferWeekCalendarOrder(record.weekDate, record.updatedAt)
  const anchorCalendarOrder = anchor.calendarOrder
    ?? inferWeekCalendarOrder(anchor.weekDate, anchor.updatedAt)

  if (recordCalendarOrder !== null && anchorCalendarOrder !== null) {
    return recordCalendarOrder === anchorCalendarOrder
  }

  return record.weekDate === anchor.weekDate
}
