import type { Participant } from './participants'
import type { ProgramSlot } from './programSlots'
import { assignmentControlId } from './programProgress'
import { getEligibleForSlot } from './sanity/helpers'
import type { SanityFinding } from './sanity/types'

export interface SanityAction {
  key: string
  label: string
}

export function getSanityActions(
  finding: SanityFinding,
  slots: ProgramSlot[],
  participants: Participant[],
): SanityAction[] {
  const targetKeys = new Set(finding.slotKeys)
  const participantIds = new Set(finding.participantIds)
  const targets = slots.filter((slot) => {
    if (targetKeys.size) return targetKeys.has(slot.key)
    if (finding.rule === 'highFrequency') return Boolean(slot.participantId && participantIds.has(slot.participantId))
    if (finding.rule === 'lowFrequency') {
      return !participantIds.has(slot.participantId ?? '')
        && getEligibleForSlot(slot, participants).some(participant => participantIds.has(participant.id))
    }
    return false
  })
  const actions = new Map<string, SanityAction>()
  for (const slot of targets) {
    const controlId = assignmentControlId(slot.key)
    if (!actions.has(controlId)) {
      actions.set(controlId, { key: slot.key, label: `${slot.weekDate} · ${slot.assignmentTitle}` })
    }
  }
  return [...actions.values()]
}
