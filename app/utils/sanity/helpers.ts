import type { Participant } from '../participants'
import { isParticipantEligible } from '../participants'
import type { ProgramSlot } from '../programSlots'

export function normalizeAssignmentTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
}

export function getEligibleForSlot(slot: ProgramSlot, participants: Participant[]): Participant[] {
  const partner = slot.partnerId
    ? participants.find(participant => participant.id === slot.partnerId)
    : undefined

  return participants.filter(participant => (
    isParticipantEligible(participant, slot.role)
    && (
      slot.role !== 'school'
      || !partner
      || participant.gender === partner.gender
    )
  ))
}
