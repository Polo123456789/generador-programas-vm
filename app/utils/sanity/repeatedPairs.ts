import type { SanityCheck } from './types'

export const checkRepeatedPairs: SanityCheck = ({ program }) => {
  const pairs = new Map<string, Array<{ slotKeys: string[], week: string, title: string }>>()

  program.weeks.forEach((week, weekIndex) => {
    week.school.forEach((assignment, assignmentIndex) => {
      if (!assignment.conductorId || !assignment.studentId) return
      const pair = [assignment.conductorId, assignment.studentId].sort()
      const key = pair.join(':')
      const appearances = pairs.get(key) ?? []
      const slotPrefix = `${weekIndex}:school:${assignmentIndex}`
      appearances.push({
        slotKeys: [`${slotPrefix}:conductor`, `${slotPrefix}:student`],
        week: week.date,
        title: assignment.title,
      })
      pairs.set(key, appearances)
    })
  })

  return [...pairs.entries()].flatMap(([key, appearances]) => {
    if (appearances.length < 2) return []
    return [{
      id: `repeated-pair:${key}`,
      rule: 'repeatedPair' as const,
      participantIds: key.split(':'),
      reason: `Esta pareja aparece junta ${appearances.length} veces en el programa.`,
      weeks: appearances.map(appearance => appearance.week),
      assignments: appearances.map(appearance => appearance.title),
      slotKeys: appearances.flatMap(appearance => appearance.slotKeys),
    }]
  })
}
