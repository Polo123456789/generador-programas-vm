import { describe, expect, test } from 'bun:test'
import type { MeetingProgram, ProgramWeek } from '../app/utils/assignments'
import { getProgramSlots } from '../app/utils/programSlots'

describe('program slots for meeting exceptions', () => {
  test('a cancelled meeting contributes no assignments', () => {
    const cancelled = week()
    cancelled.meetingException = { type: 'cancelled' }

    expect(getProgramSlots(program(cancelled))).toEqual([])
  })

  test('a circuit overseer visit excludes only the book study assignments', () => {
    const visit = week()
    visit.meetingException = {
      type: 'circuitOverseerVisit',
      serviceTalkSpeaker: 'Nombre libre',
    }

    const slots = getProgramSlots(program(visit))
    expect(slots.some(slot => slot.role === 'president')).toBe(true)
    expect(slots.some(slot => slot.role === 'finalPrayer')).toBe(true)
    expect(slots.some(slot => slot.role === 'bookConductor')).toBe(false)
    expect(slots.some(slot => slot.role === 'bookReader')).toBe(false)
    expect(slots.some(slot => slot.participantId === 'conductor-guardado')).toBe(false)
    expect(slots.some(slot => slot.participantId === 'lector-guardado')).toBe(false)
  })
})

describe('school slot metadata', () => {
  test('distinguishes one-person and two-person assignments', () => {
    const currentWeek = week()
    currentWeek.school = [
      { title: 'Discurso', duration: 5, conductorId: 'a' },
      { title: 'Revisita', duration: 4, conductorId: 'b', studentId: null },
    ]

    const schoolSlots = getProgramSlots(program(currentWeek))
      .filter(slot => slot.role === 'school')

    expect(schoolSlots.map(slot => ({
      key: slot.key,
      studentCount: slot.schoolStudentCount,
    }))).toEqual([
      { key: '0:school:0:conductor', studentCount: 1 },
      { key: '0:school:1:conductor', studentCount: 2 },
      { key: '0:school:1:student', studentCount: 2 },
    ])
  })
})

function program(programWeek: ProgramWeek): MeetingProgram {
  return {
    id: 'program',
    createdAt: 1,
    calendarYear: 2026,
    weeks: [programWeek],
  }
}

function week(): ProgramWeek {
  return {
    date: '7-13 De Septiembre',
    songs: [1, 2, 3],
    presidentId: 'presidente',
    assignedReading: '',
    treasures: { title: 'Tesoros', duration: 10, participantId: null },
    gems: { title: 'Perlas', duration: 10, participantId: null },
    reading: { title: 'Lectura', duration: 4, participantId: null },
    school: [],
    livingSpeeches: [],
    bookConductorId: 'conductor-guardado',
    bookReaderId: 'lector-guardado',
    finalPrayerId: 'oracion',
  }
}
