import { expect, test } from 'bun:test'
import type { MeetingProgram } from '../app/utils/assignments'
import { buildProgramHistory } from '../app/utils/history'

test('program history stores a two-person assignment once in role order', () => {
  const program: MeetingProgram = {
    id: 'program',
    createdAt: 1_000,
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
    weeks: [
      { ...baseWeek, date: 'Semana 1' },
      { ...baseWeek, date: 'Semana 2' },
    ],
  })

  expect(history[1]!.chronologicalOrder).toBeGreaterThan(history[0]!.chronologicalOrder!)
})
