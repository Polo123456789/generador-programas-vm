import type { MeetingProgram } from '../assignments'
import type { Participant } from '../participants'

export type SanityRule =
  | 'consecutiveAssignment'
  | 'roleBalance'
  | 'highFrequency'
  | 'lowFrequency'
  | 'weeklyLoad'
  | 'repeatedPair'
  | 'eligibilityMismatch'

export interface SanityFinding {
  id: string
  rule: SanityRule
  participantIds: string[]
  reason: string
  weeks: string[]
  assignments: string[]
  slotKeys: string[]
}

export interface SanityContext {
  program: MeetingProgram
  participants: Participant[]
}

export type SanityCheck = (context: SanityContext) => SanityFinding[]

export const SANITY_RULE_LABELS: Record<SanityRule, string> = {
  consecutiveAssignment: 'Misma asignación en semanas consecutivas',
  roleBalance: 'Balance de roles',
  highFrequency: 'Frecuencia alta',
  lowFrequency: 'Poca participación',
  weeklyLoad: 'Varias partes en una semana',
  repeatedPair: 'Pareja repetida',
  eligibilityMismatch: 'Aptitud o estado cambiado',
}
