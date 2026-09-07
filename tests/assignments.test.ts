import { describe, expect, test } from 'bun:test'
import type { MeetingProgram, ProgramWeek, SchoolAssignment } from '../app/utils/assignments'
import {
  countActiveMeetingWeeks,
  fetchAssignments,
  getSchoolStudentCount,
  inferSchoolStudentCount,
  isCancelledMeeting,
  isCircuitOverseerVisit,
  setSchoolStudentCount,
} from '../app/utils/assignments'

describe('school assignment student count', () => {
  test('uses the automatic title detection as the initial value', () => {
    expect(inferSchoolStudentCount('Discurso')).toBe(1)
    expect(inferSchoolStudentCount('Primera conversación')).toBe(2)
  })

  test('can override a two-student assignment without changing its primary student', () => {
    const assignment: SchoolAssignment = {
      title: 'Demostración especial',
      duration: 5,
      conductorId: 'principal',
      studentId: 'acompanante',
    }

    setSchoolStudentCount(assignment, 1)

    expect(getSchoolStudentCount(assignment)).toBe(1)
    expect(assignment.conductorId).toBe('principal')
    expect('studentId' in assignment).toBe(false)
  })

  test('can override a one-student assignment and creates an empty companion slot', () => {
    const assignment: SchoolAssignment = {
      title: 'Discurso basado en contenido',
      duration: 5,
      conductorId: 'principal',
    }

    setSchoolStudentCount(assignment, 2)

    expect(getSchoolStudentCount(assignment)).toBe(2)
    expect(assignment.studentId).toBeNull()
    expect(assignment.conductorId).toBe('principal')
  })
})

test('rejects a source page without program weeks', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (() => Promise.resolve(new Response('<html><body>Sin programa</body></html>'))) as typeof fetch
  try {
    await expect(fetchAssignments('https://example.test/2026')).rejects.toThrow('No se encontraron semanas')
  } finally {
    globalThis.fetch = originalFetch
  }
})

describe('meeting exceptions', () => {
  test('treats old weeks as regular and counts only meetings that will occur', () => {
    const regular = programWeek('Semana 1')
    const cancelled = programWeek('Semana 2')
    cancelled.meetingException = { type: 'cancelled' }
    const visit = programWeek('Semana 3')
    visit.meetingException = { type: 'circuitOverseerVisit', serviceTalkSpeaker: 'Hermano visitante' }
    const program: MeetingProgram = {
      id: 'program',
      createdAt: 1,
      calendarYear: 2026,
      weeks: [regular, cancelled, visit],
    }

    expect(isCancelledMeeting(regular)).toBe(false)
    expect(isCancelledMeeting(cancelled)).toBe(true)
    expect(isCircuitOverseerVisit(visit)).toBe(true)
    expect(countActiveMeetingWeeks(program)).toBe(2)
  })
})

function programWeek(date: string): ProgramWeek {
  return {
    date,
    songs: [1, 2, 3],
    presidentId: null,
    assignedReading: '',
    treasures: { title: 'Tesoros', duration: 10, participantId: null },
    gems: { title: 'Perlas', duration: 10, participantId: null },
    reading: { title: 'Lectura', duration: 4, participantId: null },
    school: [],
    livingSpeeches: [],
    bookConductorId: null,
    bookReaderId: null,
    finalPrayerId: null,
  }
}
