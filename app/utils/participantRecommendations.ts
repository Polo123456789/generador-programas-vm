import type {
  AssignmentHistoryRecord,
  Participant,
  ParticipantRole,
} from './participants'
import { isParticipantEligible } from './participants'
import { inferWeekCalendarOrder, parseWeekStart } from './weekDates'

export interface ParticipantRecommendation {
  participant: Participant
  lastAssignmentDate: string | null
  lastTimeTogether: string | null
}

export type PartnerRankingPriority = 'timeTogether' | 'assignment'

interface RecommendationContext {
  participants: Participant[]
  history: AssignmentHistoryRecord[]
  role: ParticipantRole
  targetWeekDate: string
  targetProgramId?: string
  targetCalendarOrder?: number
  targetChronologicalOrder?: number
  targetSlotKey?: string
}

interface PartnerRecommendationContext extends RecommendationContext {
  primaryId: string
}

export function rankParticipants({
  participants,
  history,
  role,
  targetWeekDate,
  targetProgramId,
  targetCalendarOrder,
  targetChronologicalOrder,
  targetSlotKey,
}: RecommendationContext): ParticipantRecommendation[] {
  const target: RankingTarget = {
    weekDate: targetWeekDate,
    targetProgramId,
    targetCalendarOrder,
    targetChronologicalOrder,
    targetSlotKey,
  }
  const relevantHistory = historyBeforeTarget(history, target)
  return participants
    .filter(participant => isParticipantEligible(participant, role))
    .map(participant => ({
      participant,
      lastAssignmentDate: latestAssignment(relevantHistory, participant.id, role, target)?.weekDate ?? null,
      lastTimeTogether: null,
    }))
    .sort((left, right) => (
      compareHistoryDates(
        latestAssignment(relevantHistory, left.participant.id, role, target),
        latestAssignment(relevantHistory, right.participant.id, role, target),
        target,
      ) || compareNames(left.participant, right.participant)
    ))
}

export function rankPartners({
  participants,
  history,
  primaryId,
  role,
  targetWeekDate,
  targetProgramId,
  targetCalendarOrder,
  targetChronologicalOrder,
  targetSlotKey,
}: PartnerRecommendationContext, priority: PartnerRankingPriority = 'timeTogether'): ParticipantRecommendation[] {
  const primary = participants.find(participant => participant.id === primaryId)
  if (!primary) return []
  const target: RankingTarget = {
    weekDate: targetWeekDate,
    targetProgramId,
    targetCalendarOrder,
    targetChronologicalOrder,
    targetSlotKey,
  }
  const relevantHistory = historyBeforeTarget(history, target)

  return participants
    .filter(participant => (
      participant.id !== primaryId
      && participant.gender === primary.gender
      && isParticipantEligible(participant, role)
    ))
    .map(participant => ({
      participant,
      lastAssignmentDate: latestAssignment(relevantHistory, participant.id, role, target)?.weekDate ?? null,
      lastTimeTogether: latestPairAssignment(relevantHistory, primaryId, participant.id, target)?.weekDate ?? null,
    }))
    .sort((left, right) => {
      const pairComparison = compareHistoryDates(
        latestPairAssignment(relevantHistory, primaryId, left.participant.id, target),
        latestPairAssignment(relevantHistory, primaryId, right.participant.id, target),
        target,
      )
      const assignmentComparison = compareHistoryDates(
        latestAssignment(relevantHistory, left.participant.id, role, target),
        latestAssignment(relevantHistory, right.participant.id, role, target),
        target,
      )

      return priority === 'timeTogether'
        ? pairComparison || assignmentComparison || compareNames(left.participant, right.participant)
        : assignmentComparison || pairComparison || compareNames(left.participant, right.participant)
    })
}

function latestAssignment(
  history: AssignmentHistoryRecord[],
  participantId: string,
  role: ParticipantRole,
  target: RankingTarget,
): AssignmentHistoryRecord | undefined {
  return latestRecord(history.filter(record => (
    record.participantIds.includes(participantId)
    && historyRoleMatches(record.assignmentRole, role)
  )), target)
}

function latestPairAssignment(
  history: AssignmentHistoryRecord[],
  firstId: string,
  secondId: string,
  target: RankingTarget,
): AssignmentHistoryRecord | undefined {
  return latestRecord(history.filter(record => (
    record.participantIds.includes(firstId)
    && record.participantIds.includes(secondId)
  )), target)
}

function latestRecord(
  records: AssignmentHistoryRecord[],
  target: RankingTarget,
): AssignmentHistoryRecord | undefined {
  return records.reduce<AssignmentHistoryRecord | undefined>((latest, record) => (
    !latest || compareRecords(record, latest, target) > 0 ? record : latest
  ), undefined)
}

function compareHistoryDates(
  left: AssignmentHistoryRecord | undefined,
  right: AssignmentHistoryRecord | undefined,
  target: RankingTarget,
): number {
  if (!left && !right) return 0
  if (!left) return -1
  if (!right) return 1
  return compareRecords(left, right, target)
}

function compareRecords(
  left: AssignmentHistoryRecord,
  right: AssignmentHistoryRecord,
  target: RankingTarget,
): number {
  const leftOffset = effectiveOffset(left, target)
  const rightOffset = effectiveOffset(right, target)
  if (leftOffset !== null && rightOffset !== null) {
    return leftOffset - rightOffset || historyOrder(left) - historyOrder(right)
  }
  return historyOrder(left) - historyOrder(right)
}

interface RankingTarget {
  weekDate: string
  targetProgramId?: string
  targetCalendarOrder?: number
  targetChronologicalOrder?: number
  targetSlotKey?: string
}

function historyBeforeTarget(history: AssignmentHistoryRecord[], target: RankingTarget): AssignmentHistoryRecord[] {
  return history.filter((record) => {
    if (
      target.targetProgramId
      && target.targetSlotKey
      && record.programId === target.targetProgramId
      && record.slotKey === target.targetSlotKey
    ) return false

    if (
      target.targetProgramId
      && target.targetChronologicalOrder !== undefined
      && record.programId === target.targetProgramId
      && record.chronologicalOrder !== undefined
      && record.chronologicalOrder > target.targetChronologicalOrder
    ) return false

    const offset = effectiveOffset(record, target)
    return offset === null || offset <= 0
  })
}

function historyOrder(record: AssignmentHistoryRecord): number {
  return record.chronologicalOrder ?? record.updatedAt
}

const YEAR_MILLISECONDS = 366 * 24 * 60 * 60 * 1000
const HALF_YEAR_MILLISECONDS = YEAR_MILLISECONDS / 2

function effectiveOffset(record: AssignmentHistoryRecord, target: RankingTarget): number | null {
  if (target.targetCalendarOrder !== undefined) {
    const recordCalendarOrder = record.calendarOrder
      ?? inferWeekCalendarOrder(record.weekDate, record.updatedAt)
    return recordCalendarOrder === null
      ? null
      : recordCalendarOrder - target.targetCalendarOrder
  }

  const weekDate = parseWeekStart(record.weekDate)
  const targetWeekDate = parseWeekStart(target.weekDate)
  if (!weekDate || !targetWeekDate) return null

  let calendarOffset = Date.UTC(2000, weekDate.monthIndex, weekDate.day)
    - Date.UTC(2000, targetWeekDate.monthIndex, targetWeekDate.day)
  if (calendarOffset > HALF_YEAR_MILLISECONDS) calendarOffset -= YEAR_MILLISECONDS
  if (calendarOffset < -HALF_YEAR_MILLISECONDS) calendarOffset += YEAR_MILLISECONDS
  return calendarOffset
}

function historyRoleMatches(
  historyRole: AssignmentHistoryRecord['assignmentRole'],
  role: ParticipantRole,
): boolean {
  if (historyRole === role) return true
  if (role === 'school') return historyRole === 'legacySchool'
  if (role === 'reading') return historyRole === 'legacyReading'
  return false
}

function compareNames(left: Participant, right: Participant): number {
  return left.name.localeCompare(right.name, 'es')
}
