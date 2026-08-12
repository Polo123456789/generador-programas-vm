import type { MeetingProgram } from './assignments'
import type { AssignmentHistoryRecord } from './participants'
import { getProgramSlots } from './programSlots'
import { getWeekCalendarOrder } from './weekDates'

export function buildProgramHistory(program: MeetingProgram): AssignmentHistoryRecord[] {
  const slots = getProgramSlots(program)
  const records: AssignmentHistoryRecord[] = []
  const pairedSchoolKeys = new Set<string>()
  const updatedAt = Date.now()

  for (const slot of slots) {
    if (!slot.participantId) continue

    if (slot.schoolPosition && slot.partnerId) {
      const assignmentKey = slot.key.replace(/:(conductor|student)$/, '')
      if (pairedSchoolKeys.has(assignmentKey)) continue
      pairedSchoolKeys.add(assignmentKey)

      const conductor = slots.find(candidate => candidate.key === `${assignmentKey}:conductor`)
      const student = slots.find(candidate => candidate.key === `${assignmentKey}:student`)
      if (!conductor?.participantId || !student?.participantId) continue

      records.push({
        id: `${program.id}:${assignmentKey}`,
        programId: program.id,
        slotKey: assignmentKey,
        participantIds: [conductor.participantId, student.participantId],
        assignmentRole: 'school',
        assignmentTitle: slot.assignmentTitle,
        weekDate: slot.weekDate,
        calendarOrder: getWeekCalendarOrder(program.weeks, program.calendarYear, slot.weekIndex) ?? undefined,
        chronologicalOrder: program.createdAt + slot.weekIndex,
        updatedAt,
      })
      continue
    }

    records.push({
      id: `${program.id}:${slot.key}`,
      programId: program.id,
      slotKey: slot.key,
      participantIds: [slot.participantId],
      assignmentRole: slot.role,
      assignmentTitle: slot.assignmentTitle,
      weekDate: slot.weekDate,
      calendarOrder: getWeekCalendarOrder(program.weeks, program.calendarYear, slot.weekIndex) ?? undefined,
      chronologicalOrder: program.createdAt + slot.weekIndex,
      updatedAt,
    })
  }

  return records
}
