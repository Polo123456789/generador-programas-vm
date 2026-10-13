import { describe, expect, test } from 'bun:test'
import type { AssignmentHistoryRecord } from '../app/utils/participants'
import { getRoleHistoryRecords, getSchoolHistoryWeekRecords } from '../app/utils/historyPreview'

describe('assignment timeline', () => {
  test('selects the last eight earlier occurrences of the role by calendar date, without mutating history', () => {
    const records = Array.from({ length: 10 }, (_, index) => history(
      String(index), 'old', Date.UTC(2026, 8, index + 1), `${index + 1} de septiembre`, 'gems',
    ))
    records[0]!.updatedAt = Date.UTC(2027, 0, 1)
    const otherRole = history('other', 'old', Date.UTC(2026, 8, 11), '11 de septiembre', 'treasures')
    const current = history('current', 'current', Date.UTC(2026, 8, 12), '12 de septiembre', 'gems')
    const all = [...records, otherRole, current]
    expect(getRoleHistoryRecords(all, 'gems', current.calendarOrder!).map(record => record.id))
      .toEqual(['9', '8', '7', '6', '5', '4', '3', '2'])
    expect(all[0]!.id).toBe('0')
  })

  test('includes migrated reading dates and handles empty history', () => {
    const record = legacyHistory('legacy', Date.UTC(2026, 8, 21))
    record.assignmentRole = 'legacyReading'
    expect(getRoleHistoryRecords([record], 'reading', Date.UTC(2026, 8, 28))).toEqual([record])
    expect(getRoleHistoryRecords([record], 'bookReader', Date.UTC(2026, 8, 28))).toEqual([])
  })
})

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
