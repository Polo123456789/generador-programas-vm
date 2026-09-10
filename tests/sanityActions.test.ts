import { expect, test } from 'bun:test'
import type { Participant } from '../app/utils/participants'
import type { ProgramSlot } from '../app/utils/programSlots'
import type { SanityFinding } from '../app/utils/sanity/types'
import { getSanityActions } from '../app/utils/sanityActions'

const participants: Participant[] = [
  { id: 'a', name: 'Ana', gender: 'F', hidden: false, eligibleRoles: ['school'] },
  { id: 'b', name: 'Beatriz', gender: 'F', hidden: false, eligibleRoles: ['school'] },
]
const slots: ProgramSlot[] = [
  { key: '0:president', weekIndex: 0, weekDate: 'Semana 1', assignmentTitle: 'Presidente', role: 'president', participantId: null },
  { key: '0:school:0:conductor', weekIndex: 0, weekDate: 'Semana 1', assignmentTitle: 'Revisita', role: 'school', participantId: 'a', partnerId: 'b', schoolStudentCount: 2 },
  { key: '0:school:0:student', weekIndex: 0, weekDate: 'Semana 1', assignmentTitle: 'Revisita', role: 'school', participantId: 'b', partnerId: 'a', schoolStudentCount: 2 },
  { key: '1:school:0:conductor', weekIndex: 1, weekDate: 'Semana 2', assignmentTitle: 'Discurso', role: 'school', participantId: null, schoolStudentCount: 1 },
  { key: '1:school:1:conductor', weekIndex: 1, weekDate: 'Semana 2', assignmentTitle: 'Conversación', role: 'school', participantId: null, schoolStudentCount: 2 },
]
function finding(rule: SanityFinding['rule'], slotKeys: string[] = []): SanityFinding {
  return { id: rule, rule, participantIds: ['a'], reason: '', weeks: [], assignments: [], slotKeys }
}

test('direct findings link only existing targets and deduplicate a shared school selector', () => {
  expect(getSanityActions(finding('repeatedPair', ['0:school:0:conductor', '0:school:0:student', 'missing']), slots, participants)).toEqual([
    { key: '0:school:0:conductor', label: 'Semana 1 · Revisita' },
  ])
})

test('high frequency offers assignments belonging to the participant', () => {
  expect(getSanityActions(finding('highFrequency'), slots, participants).map(action => action.key)).toEqual(['0:school:0:conductor'])
})

test('low frequency offers eligible opportunities without assigning someone to their own pair', () => {
  expect(getSanityActions(finding('lowFrequency'), slots, participants).map(action => action.key)).toEqual(['1:school:1:conductor'])
})

test('no actionable targets produces no broken links', () => {
  expect(getSanityActions(finding('eligibilityMismatch', ['removed']), slots, participants)).toEqual([])
  expect(getSanityActions(finding('lowFrequency'), slots, participants.map(p => ({ ...p, hidden: true })))).toEqual([])
})
