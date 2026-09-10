import { describe, expect, test } from 'bun:test'
import type { MeetingProgram, ProgramWeek } from '../app/utils/assignments'
import { assignmentControlId, getProgramProgress } from '../app/utils/programProgress'

function week(): ProgramWeek {
  return {
    date: '7-13 de septiembre', songs: [1, 2, 3], assignedReading: '',
    presidentId: 'a', treasures: { title: 'Tesoros', duration: 10, participantId: 'b' },
    gems: { title: 'Perlas', duration: 10, participantId: 'c' },
    reading: { title: 'Lectura', duration: 4, participantId: 'd' },
    school: [{ title: 'Revisita', duration: 4, conductorId: 'e', studentId: null }],
    livingSpeeches: [], bookConductorId: 'f', bookReaderId: 'g', finalPrayerId: 'h',
  }
}

function program(...weeks: ProgramWeek[]): MeetingProgram {
  return { id: 'p', createdAt: 1, calendarYear: 2026, weeks }
}

describe('weekly completion', () => {
  test('counts an empty companion separately and updates when filled or removed', () => {
    const current = week()
    expect(getProgramProgress(program(current))[0]).toMatchObject({ total: 9, completed: 8, pending: [{ key: '0:school:0:student' }] })
    current.school[0]!.studentId = 'i'
    expect(getProgramProgress(program(current))[0]?.pending).toEqual([])
    delete current.school[0]!.studentId
    expect(getProgramProgress(program(current))[0]).toEqual({ total: 8, completed: 8, pending: [] })
  })

  test('cancelled weeks do not contribute pending assignments or shift keys', () => {
    const cancelled = week()
    cancelled.meetingException = { type: 'cancelled' }
    const progress = getProgramProgress(program(cancelled, week()))
    expect(progress[0]).toEqual({ total: 0, completed: 0, pending: [] })
    expect(progress[1]?.pending[0]?.key).toBe('1:school:0:student')
  })

  test('visits exclude book assignments and require a nonblank speaker', () => {
    const visit = week()
    visit.bookConductorId = null
    visit.bookReaderId = null
    visit.meetingException = { type: 'circuitOverseerVisit', serviceTalkSpeaker: '  ' }
    expect(getProgramProgress(program(visit))[0]).toMatchObject({ total: 8, completed: 6 })
    expect(getProgramProgress(program(visit))[0]?.pending.map(slot => slot.key)).toEqual(['0:school:0:student', '0:serviceTalkSpeaker'])
    visit.meetingException.serviceTalkSpeaker = 'Orador'
    expect(getProgramProgress(program(visit))[0]?.completed).toBe(7)
  })

  test('school positions share the actual selector, other controls remain distinct', () => {
    expect(assignmentControlId('0:school:1:student')).toBe(assignmentControlId('0:school:1:conductor'))
    expect(assignmentControlId('0:school:1')).toBe(assignmentControlId('0:school:1:conductor'))
    expect(assignmentControlId('0:living:1:livingSpeech')).toBe('assignment-0:living:1:livingSpeech')
    expect(assignmentControlId('0:serviceTalkSpeaker')).toBe('assignment-0:serviceTalkSpeaker')
  })
})
