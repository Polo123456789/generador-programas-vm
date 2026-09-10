import type { MeetingProgram } from './assignments'
import { getProgramSlots } from './programSlots'

export interface PendingAssignment {
  key: string
  title: string
}

export interface WeekProgress {
  total: number
  completed: number
  pending: PendingAssignment[]
}

export function getProgramProgress(program: MeetingProgram): WeekProgress[] {
  const slots = getProgramSlots(program)
  return program.weeks.map((week, weekIndex) => {
    const entries = slots.filter(slot => slot.weekIndex === weekIndex).map(slot => ({
      key: slot.key,
      title: `${slot.assignmentTitle}${slot.schoolPosition === 'student' ? ' · Acompañante' : ''}`,
      filled: Boolean(slot.participantId?.trim()),
    }))
    if (week.meetingException?.type === 'circuitOverseerVisit') {
      entries.push({
        key: `${weekIndex}:serviceTalkSpeaker`,
        title: 'Orador del discurso de servicio',
        filled: Boolean(week.meetingException.serviceTalkSpeaker.trim()),
      })
    }
    const pending = entries.filter(entry => !entry.filled).map(({ key, title }) => ({ key, title }))
    return { total: entries.length, completed: entries.length - pending.length, pending }
  })
}

// Both positions in a school assignment share one selector.
export function assignmentControlId(slotKey: string): string {
  return `assignment-${slotKey.replace(/:school:(\d+):(conductor|student)$/, ':school:$1')}`
}
