import { describe, expect, test } from 'bun:test'
import type { MeetingProgram, ProgramWeek, SchoolAssignment } from '../app/utils/assignments'
import type { Participant, ParticipantRole } from '../app/utils/participants'
import { checkConsecutiveAssignments } from '../app/utils/sanity/consecutiveAssignments'
import { checkEligibilityMismatch } from '../app/utils/sanity/eligibility'
import { checkHighFrequency, checkLowFrequency } from '../app/utils/sanity/frequency'
import { checkRepeatedPairs } from '../app/utils/sanity/repeatedPairs'
import { checkRoleBalance } from '../app/utils/sanity/roleBalance'
import { checkWeeklyLoad } from '../app/utils/sanity/weeklyLoad'

function participant(id: string, roles: ParticipantRole[] = ['school']): Participant {
  return { id, name: id, gender: 'M', hidden: false, eligibleRoles: roles }
}

function week(date: string, school: SchoolAssignment[] = []): ProgramWeek {
  return {
    date,
    songs: [1, 2, 3],
    presidentId: null,
    assignedReading: '',
    treasures: { title: 'Tesoros', duration: 10, participantId: null },
    gems: { title: 'Perlas', duration: 10, participantId: null },
    reading: { title: 'Lectura', duration: 4, participantId: null },
    school,
    livingSpeeches: [],
    bookConductorId: null,
    bookReaderId: null,
    finalPrayerId: null,
  }
}

function program(weeks: ProgramWeek[]): MeetingProgram {
  return { id: 'program', createdAt: 1_000, weeks }
}

describe('sanity checks', () => {
  test('same student assignment in adjacent weeks is reported, but a different title is not', () => {
    const first = week('Semana 1', [{ title: 'Haga revisitas', duration: 4, conductorId: 'a', studentId: 'b' }])
    const second = week('Semana 2', [{ title: 'Haga revisitas', duration: 5, conductorId: 'b', studentId: 'a' }])
    const third = week('Semana 3', [{ title: 'Discurso', duration: 5, conductorId: 'a' }])
    const findings = checkConsecutiveAssignments({ program: program([first, second, third]), participants: [] })

    expect(findings).toHaveLength(2)
    expect(findings.map(finding => finding.participantIds[0]).sort()).toEqual(['a', 'b'])
  })

  test('role balance starts at three two-person assignments in one role', () => {
    const weeks = ['1', '2', '3'].map(date => week(date, [
      { title: 'Revisita', duration: 4, conductorId: 'a', studentId: 'b' },
    ]))
    const findings = checkRoleBalance({ program: program(weeks), participants: [] })

    expect(findings).toHaveLength(2)
    expect(findings[0]?.reason).toContain('3 participaciones')
  })

  test('weekly load counts separate occupied slots', () => {
    const currentWeek = week('Semana 1')
    currentWeek.presidentId = 'a'
    currentWeek.finalPrayerId = 'a'
    expect(checkWeeklyLoad({ program: program([currentWeek]), participants: [] })).toHaveLength(1)
  })

  test('a repeated pair is unordered', () => {
    const findings = checkRepeatedPairs({
      program: program([
        week('1', [{ title: 'Revisita', duration: 4, conductorId: 'a', studentId: 'b' }]),
        week('2', [{ title: 'Conversación', duration: 4, conductorId: 'b', studentId: 'a' }]),
      ]),
      participants: [],
    })
    expect(findings).toHaveLength(1)
  })

  test('hidden or ineligible assignments remain present and are reported', () => {
    const currentWeek = week('Semana 1')
    currentWeek.presidentId = 'a'
    expect(checkEligibilityMismatch({
      program: program([currentWeek]),
      participants: [participant('a', ['school'])],
    })).toHaveLength(1)
  })

  test('frequency rules stay quiet before eight weeks', () => {
    const context = {
      program: program(Array.from({ length: 7 }, (_, index) => week(String(index)))),
      participants: [participant('a')],
    }
    expect(checkHighFrequency(context)).toEqual([])
    expect(checkLowFrequency(context)).toEqual([])
  })

  test('high and low frequency use role-adjusted opportunities', () => {
    const people = Array.from({ length: 5 }, (_, index) => participant(String(index), ['president']))
    const weeks = Array.from({ length: 25 }, (_, index) => {
      const currentWeek = week(String(index))
      currentWeek.presidentId = index < 13 ? '0' : String(1 + (index % 4))
      return currentWeek
    })
    const context = { program: program(weeks), participants: people }

    expect(checkHighFrequency(context).map(finding => finding.participantIds[0])).toEqual(['0'])
    expect(checkLowFrequency(context)).toEqual([])
  })

  test('low frequency reports an eligible participant with a meaningful deficit', () => {
    const people = Array.from({ length: 4 }, (_, index) => participant(String(index), ['president']))
    const weeks = Array.from({ length: 24 }, (_, index) => {
      const currentWeek = week(String(index))
      currentWeek.presidentId = String(index % 3)
      return currentWeek
    })

    expect(checkLowFrequency({ program: program(weeks), participants: people })
      .map(finding => finding.participantIds[0])).toEqual(['3'])
  })
})
