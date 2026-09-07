import { expect, test } from 'bun:test'
import type { MeetingProgram } from '../app/utils/assignments'
import { buildProgramHistory, getLastAssignmentDateFromHistory } from '../app/utils/history'

test('last assignment uses the meeting calendar instead of import time', () => {
  expect(getLastAssignmentDateFromHistory([
    {
      id: 'newer-import',
      participantIds: ['a'],
      assignmentRole: 'reading',
      assignmentTitle: 'Lectura',
      weekDate: '5-11 de enero',
      calendarOrder: Date.UTC(2026, 0, 5),
      updatedAt: Date.UTC(2026, 8, 1),
    },
    {
      id: 'newer-meeting',
      participantIds: ['a'],
      assignmentRole: 'reading',
      assignmentTitle: 'Lectura',
      weekDate: '7-13 de septiembre',
      calendarOrder: Date.UTC(2026, 8, 7),
      updatedAt: Date.UTC(2026, 0, 1),
    },
  ], 'a')).toBe('7-13 de septiembre')
})

test('program history stores a two-person assignment once in role order', () => {
  const program: MeetingProgram = {
    id: 'program',
    createdAt: 1_000,
    calendarYear: 2026,
    weeks: [{
      date: 'Semana',
      songs: [1, 2, 3],
      presidentId: null,
      assignedReading: '',
      treasures: { title: 'Tesoros', duration: 10, participantId: null },
      gems: { title: 'Perlas', duration: 10, participantId: null },
      reading: { title: 'Lectura', duration: 4, participantId: null },
      school: [{ title: 'Revisita', duration: 4, conductorId: 'a', studentId: 'b' }],
      livingSpeeches: [],
      bookConductorId: null,
      bookReaderId: null,
      finalPrayerId: null,
    }],
  }

  const history = buildProgramHistory(program)
  expect(history).toHaveLength(1)
  expect(history[0]?.participantIds).toEqual(['a', 'b'])
})

test('program history gives later weeks a stable chronological order', () => {
  const baseWeek = {
    songs: [1, 2, 3],
    presidentId: 'a',
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
  const history = buildProgramHistory({
    id: 'program',
    createdAt: 5_000,
    calendarYear: 2026,
    weeks: [
      { ...baseWeek, date: 'Semana 1' },
      { ...baseWeek, date: 'Semana 2' },
    ],
  })

  expect(history[1]!.chronologicalOrder).toBeGreaterThan(history[0]!.chronologicalOrder!)
})

test('program history stores the meeting date independently from the import date', () => {
  const history = buildProgramHistory({
    id: 'program',
    createdAt: Date.UTC(2027, 0, 1),
    calendarYear: 2026,
    weeks: [{
      date: '17-23 De Agosto',
      songs: [1, 2, 3],
      presidentId: 'a',
      assignedReading: '',
      treasures: { title: 'Tesoros', duration: 10, participantId: null },
      gems: { title: 'Perlas', duration: 10, participantId: null },
      reading: { title: 'Lectura', duration: 4, participantId: null },
      school: [],
      livingSpeeches: [],
      bookConductorId: null,
      bookReaderId: null,
      finalPrayerId: null,
    }],
  })

  expect(history[0]?.calendarOrder).toBe(Date.UTC(2026, 7, 17))
})

test('program history omits cancelled meetings and hidden book assignments during a visit', () => {
  const cancelled = historyWeek('Semana cancelada')
  cancelled.presidentId = 'cancelado'
  cancelled.meetingException = { type: 'cancelled' }

  const visit = historyWeek('Semana de visita')
  visit.presidentId = 'presidente'
  visit.bookConductorId = 'conductor-guardado'
  visit.bookReaderId = 'lector-guardado'
  visit.meetingException = {
    type: 'circuitOverseerVisit',
    serviceTalkSpeaker: 'Nombre fuera del padrón',
  }

  const history = buildProgramHistory({
    id: 'program',
    createdAt: 1_000,
    calendarYear: 2026,
    weeks: [cancelled, visit],
  })

  expect(history.map(record => record.participantIds[0])).toEqual(['presidente'])
})

function historyWeek(date: string): MeetingProgram['weeks'][number] {
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
