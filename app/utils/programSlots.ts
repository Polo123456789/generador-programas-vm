import type { MeetingProgram } from './assignments'
import type { ParticipantRole } from './participants'

export type SchoolPosition = 'conductor' | 'student'

export interface ProgramSlot {
  key: string
  weekIndex: number
  weekDate: string
  assignmentTitle: string
  role: ParticipantRole
  participantId: string | null
  partnerId?: string | null
  schoolPosition?: SchoolPosition
}

export function getProgramSlots(program: MeetingProgram): ProgramSlot[] {
  return program.weeks.flatMap((week, weekIndex) => {
    const prefix = `${weekIndex}`
    const slots: ProgramSlot[] = [
      makeSlot(prefix, weekIndex, week.date, 'president', 'Presidente', week.presidentId),
      makeSlot(prefix, weekIndex, week.date, 'treasures', week.treasures.title, week.treasures.participantId),
      makeSlot(prefix, weekIndex, week.date, 'gems', week.gems.title, week.gems.participantId),
      makeSlot(prefix, weekIndex, week.date, 'reading', 'Lectura', week.reading.participantId),
    ]

    week.school.forEach((assignment, assignmentIndex) => {
      const assignmentKey = `${prefix}:school:${assignmentIndex}`
      slots.push({
        key: `${assignmentKey}:conductor`,
        weekIndex,
        weekDate: week.date,
        assignmentTitle: assignment.title,
        role: 'school',
        participantId: assignment.conductorId,
        partnerId: assignment.studentId,
        schoolPosition: 'conductor',
      })

      if (assignment.studentId !== undefined) {
        slots.push({
          key: `${assignmentKey}:student`,
          weekIndex,
          weekDate: week.date,
          assignmentTitle: assignment.title,
          role: 'school',
          participantId: assignment.studentId,
          partnerId: assignment.conductorId,
          schoolPosition: 'student',
        })
      }
    })

    week.livingSpeeches.forEach((assignment, assignmentIndex) => {
      slots.push(makeSlot(
        `${prefix}:living:${assignmentIndex}`,
        weekIndex,
        week.date,
        'livingSpeech',
        assignment.title,
        assignment.participantId,
      ))
    })

    slots.push(
      makeSlot(prefix, weekIndex, week.date, 'bookConductor', 'Conductor del estudio bíblico', week.bookConductorId),
      makeSlot(prefix, weekIndex, week.date, 'bookReader', 'Lector del estudio bíblico', week.bookReaderId),
      makeSlot(prefix, weekIndex, week.date, 'finalPrayer', 'Oración final', week.finalPrayerId),
    )

    return slots
  })
}

function makeSlot(
  prefix: string,
  weekIndex: number,
  weekDate: string,
  role: ParticipantRole,
  assignmentTitle: string,
  participantId: string | null,
): ProgramSlot {
  return {
    key: `${prefix}:${role}`,
    weekIndex,
    weekDate,
    assignmentTitle,
    role,
    participantId,
  }
}
