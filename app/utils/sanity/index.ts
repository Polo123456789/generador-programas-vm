import { checkConsecutiveAssignments } from './consecutiveAssignments'
import { checkEligibilityMismatch } from './eligibility'
import { checkHighFrequency, checkLowFrequency } from './frequency'
import { checkRepeatedPairs } from './repeatedPairs'
import { checkRoleBalance } from './roleBalance'
import type { SanityCheck, SanityContext, SanityFinding } from './types'
import { checkWeeklyLoad } from './weeklyLoad'

export type { SanityFinding, SanityRule } from './types'
export { SANITY_RULE_LABELS } from './types'

export const SANITY_CHECKS: SanityCheck[] = [
  checkConsecutiveAssignments,
  checkRoleBalance,
  checkHighFrequency,
  checkLowFrequency,
  checkWeeklyLoad,
  checkRepeatedPairs,
  checkEligibilityMismatch,
]

export function runSanityChecks(context: SanityContext): SanityFinding[] {
  return SANITY_CHECKS.flatMap(check => check(context))
}
