import { describe, expect, test } from 'bun:test'
import type { AssignmentHistoryRecord, Participant } from '../app/utils/participants'
import { PARTICIPANT_ROLES } from '../app/utils/participants'
import { rankParticipants, rankPartners } from '../app/utils/participantRecommendations'

const participants: Participant[] = [
  participant('ana', 'Ana', 'F'),
  participant('beatriz', 'Beatriz', 'F'),
  participant('carla', 'Carla', 'F'),
  participant('diego', 'Diego', 'M'),
]

describe('participant recommendations', () => {
  test('orders every program role by that role and excludes ineligible participants', () => {
    PARTICIPANT_ROLES.forEach((role) => {
      const roleParticipants: Participant[] = [
        { ...participant(`${role}-new`, 'Participante reciente', 'M'), eligibleRoles: [role] },
        { ...participant(`${role}-old`, 'Participante anterior', 'M'), eligibleRoles: [role] },
        { ...participant(`${role}-ineligible`, 'No apto', 'M'), eligibleRoles: [] },
      ]
      const ranked = rankParticipants({
        participants: roleParticipants,
        role,
        targetWeekDate: '7-13 De Septiembre',
        history: [
          history(`recent-${role}`, [`${role}-new`], 30, role, '31 De Agosto A 6 De Septiembre'),
          history(`old-${role}`, [`${role}-old`], 10, role, '6-12 De Julio'),
        ],
      })

      expect(ranked.map(candidate => candidate.participant.id)).toEqual([`${role}-old`, `${role}-new`])
    })
  })

  test('puts students who have never participated first, then the oldest assignment', () => {
    const ranked = rankParticipants({
      participants,
      role: 'school',
      targetWeekDate: '7-13 De Septiembre',
      history: [
        history('ana-new', ['ana'], 30, 'school', 'Semana 3'),
        history('beatriz-old', ['beatriz'], 10, 'school', 'Semana 1'),
        history('beatriz-reading', ['beatriz'], 5, 'reading', 'Lectura antigua'),
      ],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['carla', 'diego', 'beatriz', 'ana'])
    expect(ranked[2]?.lastAssignmentDate).toBe('Semana 1')
  })

  test('treats migrated school history as relevant', () => {
    const ranked = rankParticipants({
      participants: participants.slice(0, 2),
      role: 'school',
      targetWeekDate: '7-13 De Septiembre',
      history: [history('legacy', ['ana'], 10, 'legacySchool', 'Semana antigua')],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['beatriz', 'ana'])
  })

  test('uses the displayed week instead of migration time for calendar ordering', () => {
    const ranked = rankParticipants({
      participants: participants.slice(0, 3),
      role: 'school',
      targetWeekDate: '7-13 De Septiembre',
      history: [
        history('ana-july', ['ana'], 300, 'legacySchool', '27 De Julio A 2 De Agosto'),
        history('beatriz-august', ['beatriz'], 100, 'legacySchool', '17-23 De Agosto'),
        history('carla-august', ['carla'], 200, 'legacySchool', '10-16 De Agosto'),
      ],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['ana', 'carla', 'beatriz'])
  })

  test('treats December as earlier than January when the target week is in January', () => {
    const ranked = rankParticipants({
      participants: participants.slice(0, 2),
      role: 'school',
      targetWeekDate: '11-17 De Enero',
      history: [
        history('ana-december', ['ana'], 10, 'school', '28 De Diciembre A 3 De Enero'),
        history('beatriz-january', ['beatriz'], 20, 'school', '4-10 De Enero'),
      ],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['ana', 'beatriz'])
  })

  test('uses history order to distinguish the same calendar week in different years', () => {
    const targetOrder = Date.UTC(2027, 0, 11)
    const ranked = rankParticipants({
      participants: participants.slice(0, 2),
      role: 'school',
      targetWeekDate: '11-17 De Enero',
      targetCalendarOrder: targetOrder,
      targetChronologicalOrder: targetOrder,
      history: [
        calendarHistory('ana-current-december', ['ana'], Date.UTC(2026, 11, 28), 'school', '28 De Diciembre A 3 De Enero'),
        calendarHistory('beatriz-previous-december', ['beatriz'], Date.UTC(2025, 11, 28), 'school', '28 De Diciembre A 3 De Enero'),
      ],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['beatriz', 'ana'])
  })

  test('orders the same annual cycle correctly across January and December', () => {
    const ranked = rankParticipants({
      participants: participants.slice(0, 2),
      role: 'school',
      targetWeekDate: '11-17 De Enero',
      targetCalendarOrder: Date.UTC(2027, 0, 11),
      targetChronologicalOrder: Date.UTC(2027, 0, 11),
      history: [
        calendarHistory('ana-previous-january', ['ana'], Date.UTC(2026, 0, 4), 'school', '4-10 De Enero'),
        calendarHistory('beatriz-december', ['beatriz'], Date.UTC(2026, 11, 22), 'school', '22-28 De Diciembre'),
      ],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['ana', 'beatriz'])
  })

  test('ignores later weeks from the program currently being assigned', () => {
    const future = history('ana-future', ['ana'], 30, 'school', '17-23 De Agosto')
    future.programId = 'current'
    const previous = history('beatriz-previous', ['beatriz'], 10, 'school', '27 De Julio A 2 De Agosto')

    const ranked = rankParticipants({
      participants: participants.slice(0, 2),
      role: 'school',
      targetWeekDate: '3-9 De Agosto',
      targetProgramId: 'current',
      targetChronologicalOrder: 20,
      history: [future, previous],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['ana', 'beatriz'])
    expect(ranked[0]?.lastAssignmentDate).toBeNull()
  })

  test('ignores a future week from another recently created program', () => {
    const targetOrder = Date.UTC(2026, 7, 3)
    const future = calendarHistory('ana-future', ['ana'], Date.UTC(2026, 7, 17), 'school', '17-23 De Agosto')
    future.updatedAt = Date.UTC(2026, 0, 1)
    future.programId = 'other'
    const previous = calendarHistory('beatriz-previous', ['beatriz'], Date.UTC(2026, 6, 27), 'school', '27 De Julio A 2 De Agosto')

    const ranked = rankParticipants({
      participants: participants.slice(0, 2),
      role: 'school',
      targetWeekDate: '3-9 De Agosto',
      targetProgramId: 'current',
      targetCalendarOrder: targetOrder,
      targetChronologicalOrder: targetOrder,
      history: [future, previous],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['ana', 'beatriz'])
    expect(ranked[0]?.lastAssignmentDate).toBeNull()
  })

  test('excludes only the slot being edited and keeps other assignments in the same week', () => {
    const targetOrder = Date.UTC(2026, 8, 7)
    const currentSlot = history('current-slot', ['ana'], targetOrder, 'school', '7-13 De Septiembre')
    currentSlot.programId = 'current'
    currentSlot.slotKey = '0:school:0'
    const otherSlot = history('other-slot', ['beatriz'], targetOrder, 'school', '7-13 De Septiembre')
    otherSlot.programId = 'current'
    otherSlot.slotKey = '0:school:1'

    const ranked = rankParticipants({
      participants: participants.slice(0, 2),
      role: 'school',
      targetWeekDate: '7-13 De Septiembre',
      targetProgramId: 'current',
      targetChronologicalOrder: targetOrder,
      targetSlotKey: '0:school:0',
      history: [currentSlot, otherSlot],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['ana', 'beatriz'])
    expect(ranked[0]?.lastAssignmentDate).toBeNull()
    expect(ranked[1]?.lastAssignmentDate).toBe('7-13 De Septiembre')
  })

  test('recommends same-gender partners by oldest pairing, then individual participation', () => {
    const ranked = rankPartners({
      participants,
      primaryId: 'ana',
      role: 'school',
      targetWeekDate: '7-13 De Septiembre',
      history: [
        history('ana-beatriz', ['ana', 'beatriz'], 40, 'school', 'Juntas reciente'),
        history('ana-carla', ['ana', 'carla'], 10, 'school', 'Juntas antigua'),
        history('carla-latest', ['carla'], 50, 'school', 'Carla reciente'),
      ],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['carla', 'beatriz'])
    expect(ranked[0]?.lastTimeTogether).toBe('Juntas antigua')
    expect(ranked.some(candidate => candidate.participant.id === 'diego')).toBe(false)
  })

  test('prioritizes partners who have never appeared together', () => {
    const ranked = rankPartners({
      participants,
      primaryId: 'ana',
      role: 'school',
      targetWeekDate: '7-13 De Septiembre',
      history: [history('ana-beatriz', ['ana', 'beatriz'], 1, 'school', 'Juntas')],
    })

    expect(ranked.map(candidate => candidate.participant.id)).toEqual(['carla', 'beatriz'])
    expect(ranked[0]?.lastTimeTogether).toBeNull()
  })
})

function participant(id: string, name: string, gender: 'M' | 'F'): Participant {
  return { id, name, gender, hidden: false, eligibleRoles: ['school', 'reading'] }
}

function history(
  id: string,
  participantIds: string[],
  chronologicalOrder: number,
  assignmentRole: AssignmentHistoryRecord['assignmentRole'],
  weekDate: string,
): AssignmentHistoryRecord {
  return {
    id,
    participantIds,
    assignmentRole,
    assignmentTitle: 'Parte',
    weekDate,
    chronologicalOrder,
    updatedAt: chronologicalOrder,
  }
}

function calendarHistory(
  id: string,
  participantIds: string[],
  calendarOrder: number,
  assignmentRole: AssignmentHistoryRecord['assignmentRole'],
  weekDate: string,
): AssignmentHistoryRecord {
  return {
    ...history(id, participantIds, calendarOrder, assignmentRole, weekDate),
    calendarOrder,
  }
}
