import { describe, expect, test } from 'bun:test'
import type { AssignmentHistoryRecord } from '../app/utils/participants'
import { getSchoolHistoryWeekRecords } from '../app/utils/historyPreview'

describe('history week preview', () => {
  test('returns every assignment from the exact program week', () => {
    const anchor = history('anchor', 'program-a', Date.UTC(2026, 8, 21), '21-27 De Septiembre')
    const sameWeek = history('same-week', 'program-a', Date.UTC(2026, 8, 21), '21-27 De Septiembre')
    const nonSchool = history('non-school', 'program-a', Date.UTC(2026, 8, 21), '21-27 De Septiembre', 'president')
    const otherWeek = history('other-week', 'program-a', Date.UTC(2026, 8, 28), '28 De Septiembre A 4 De Octubre')
    const otherProgram = history('other-program', 'program-b', Date.UTC(2026, 8, 21), '21-27 De Septiembre')

    expect(getSchoolHistoryWeekRecords([
      anchor,
      sameWeek,
      nonSchool,
      otherWeek,
      otherProgram,
    ], anchor).map(record => record.id)).toEqual(['anchor', 'same-week'])
  })

  test('does not mix legacy weeks with the same label from different years', () => {
    const anchor = legacyHistory('current', Date.UTC(2026, 8, 21))
    const sameYear = legacyHistory('same-year', Date.UTC(2026, 8, 22))
    const previousYear = legacyHistory('previous-year', Date.UTC(2025, 8, 21))

    expect(getSchoolHistoryWeekRecords([
      anchor,
      sameYear,
      previousYear,
    ], anchor).map(record => record.id)).toEqual(['current', 'same-year'])
  })
})

function history(
  id: string,
  programId: string,
  calendarOrder: number,
  weekDate: string,
  assignmentRole: AssignmentHistoryRecord['assignmentRole'] = 'school',
): AssignmentHistoryRecord {
  return {
    id,
    programId,
    participantIds: [id],
    assignmentRole,
    assignmentTitle: `Parte ${id}`,
    weekDate,
    calendarOrder,
    chronologicalOrder: calendarOrder,
    updatedAt: calendarOrder,
  }
}

function legacyHistory(id: string, updatedAt: number): AssignmentHistoryRecord {
  return {
    id,
    participantIds: [id],
    assignmentRole: 'legacySchool',
    assignmentTitle: `Parte ${id}`,
    weekDate: '21-27 De Septiembre',
    updatedAt,
  }
}
