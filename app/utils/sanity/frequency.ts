import { getProgramSlots } from '../programSlots'
import { getEligibleForSlot } from './helpers'
import type { SanityCheck, SanityFinding } from './types'

interface FrequencyStats {
  participantId: string
  observed: number
  expected: number
  variance: number
  comparableSlots: number
}

const MIN_WEEKS = 8
const MIN_COMPARABLE_SLOTS = 20

export const checkHighFrequency: SanityCheck = (context) => {
  if (context.program.weeks.length < MIN_WEEKS) return []

  return buildFrequencyStats(context).flatMap((stats): SanityFinding[] => {
    const excess = stats.observed - stats.expected
    const ratio = stats.expected > 0 ? stats.observed / stats.expected : 0
    const zScore = (stats.observed - stats.expected - 0.5) / Math.sqrt(Math.max(stats.variance, 1))

    if (
      stats.comparableSlots < MIN_COMPARABLE_SLOTS
      || stats.expected < 2
      || stats.observed < 4
      || excess < 3
      || ratio < 1.75
      || zScore < 2.5
    ) return []

    return [{
      id: `high-frequency:${stats.participantId}`,
      rule: 'highFrequency',
      participantIds: [stats.participantId],
      reason: `Tiene ${stats.observed} participaciones; según sus aptitudes, la referencia es ${formatExpected(stats.expected)}.`,
      weeks: [],
      assignments: [],
    }]
  })
}

export const checkLowFrequency: SanityCheck = (context) => {
  if (context.program.weeks.length < MIN_WEEKS) return []

  return buildFrequencyStats(context).flatMap((stats): SanityFinding[] => {
    const deficit = stats.expected - stats.observed
    if (
      stats.comparableSlots < MIN_COMPARABLE_SLOTS
      || stats.expected < 3
      || deficit < 2
      || stats.observed > stats.expected * 0.5
    ) return []

    return [{
      id: `low-frequency:${stats.participantId}`,
      rule: 'lowFrequency',
      participantIds: [stats.participantId],
      reason: `Tiene ${stats.observed} participaciones; según sus aptitudes, la referencia es ${formatExpected(stats.expected)}.`,
      weeks: [],
      assignments: [],
    }]
  })
}

function buildFrequencyStats({ program, participants }: Parameters<SanityCheck>[0]): FrequencyStats[] {
  const filledSlots = getProgramSlots(program).filter(slot => slot.participantId)
  const statsByParticipant = new Map<string, FrequencyStats>()

  participants.filter(participant => !participant.hidden).forEach((participant) => {
    statsByParticipant.set(participant.id, {
      participantId: participant.id,
      observed: 0,
      expected: 0,
      variance: 0,
      comparableSlots: 0,
    })
  })

  filledSlots.forEach((slot) => {
    const observed = slot.participantId ? statsByParticipant.get(slot.participantId) : undefined
    if (observed) observed.observed += 1

    const eligible = getEligibleForSlot(slot, participants)
    if (eligible.length === 0) return
    const probability = 1 / eligible.length

    eligible.forEach((participant) => {
      const stats = statsByParticipant.get(participant.id)
      if (!stats) return
      stats.expected += probability
      stats.variance += probability * (1 - probability)
      stats.comparableSlots += 1
    })
  })

  return [...statsByParticipant.values()]
}

function formatExpected(expected: number): string {
  return expected.toLocaleString('es-GT', { maximumFractionDigits: 1 })
}
