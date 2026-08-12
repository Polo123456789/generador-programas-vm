import { getProgramSlots } from '../programSlots'
import { getEligibleForSlot } from './helpers'
import type { SanityCheck } from './types'

export const checkEligibilityMismatch: SanityCheck = ({ program, participants }) => {
  const participantsById = new Map(participants.map(participant => [participant.id, participant]))

  return getProgramSlots(program).flatMap((slot) => {
    if (!slot.participantId) return []
    const participant = participantsById.get(slot.participantId)
    const eligible = getEligibleForSlot(slot, participants)
      .some(candidate => candidate.id === slot.participantId)
    if (participant && eligible) return []

    const reason = !participant
      ? 'La asignación referencia a un participante que ya no está en el padrón.'
      : participant.hidden
        ? 'La persona está oculta, pero conserva esta asignación.'
        : 'La asignación ya no coincide con sus aptitudes o con el género de su pareja.'

    return [{
      id: `eligibility:${slot.key}:${slot.participantId}`,
      rule: 'eligibilityMismatch' as const,
      participantIds: [slot.participantId],
      reason,
      weeks: [slot.weekDate],
      assignments: [slot.assignmentTitle],
    }]
  })
}
