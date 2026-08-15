import type { AssignmentHistoryRecord } from './participants'
import { inferWeekCalendarOrder } from './weekDates'

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
