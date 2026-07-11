import type {
  AppState,
  Assignment,
  AssignmentRecord,
  CompanionMode,
  ProgramWeek,
  Student,
} from '~/types/domain'

export const APP_STATE_SCHEMA_VERSION = 1 as const

const MONTHS_ES: ReadonlyArray<readonly [number, ReadonlyArray<string>]> = [
  [0, ['enero', 'ene']],
  [1, ['febrero', 'feb']],
  [2, ['marzo', 'mar']],
  [3, ['abril', 'abr']],
  [4, ['mayo', 'may']],
  [5, ['junio', 'jun']],
  [6, ['julio', 'jul']],
  [7, ['agosto', 'ago']],
  [8, ['septiembre', 'setiembre', 'sept', 'sep']],
  [9, ['octubre', 'oct']],
  [10, ['noviembre', 'nov']],
  [11, ['diciembre', 'dic']],
]

interface ImportEnvelope {
  format: 'generador-programas-vm'
  exportedAt: string
  data: AppState
}

export interface ProgramMergeResult {
  weeks: ProgramWeek[]
  preservedFields: number
  previousFields: number
}

export type ImportResult
  = | { ok: true, data: AppState }
    | { ok: false, error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function normalizedText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function normalizePersonName(value: string): string {
  return normalizedText(value).trim().replace(/\s+/g, ' ')
}

export function createEmptyAppState(): AppState {
  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    sourceUrl: '',
    weeks: [],
    students: [],
    assignmentHistory: {},
  }
}

export function cloneAppState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState
}

export function inferWeekStart(label: string, referenceDate = new Date()): string | null {
  const normalized = normalizedText(label)
  let monthIndex = -1
  let monthPosition = Number.POSITIVE_INFINITY

  for (const [candidateMonth, aliases] of MONTHS_ES) {
    for (const alias of aliases) {
      const position = normalized.search(new RegExp(`\\b${alias}\\.?\\b`))
      if (position >= 0 && position < monthPosition) {
        monthIndex = candidateMonth
        monthPosition = position
      }
    }
  }

  if (monthIndex < 0 || !Number.isFinite(monthPosition)) return null

  const day = [...normalized.slice(0, monthPosition).matchAll(/\b(\d{1,2})\b/g)]
    .map(match => Number(match[1]))
    .find(candidate => candidate >= 1 && candidate <= 31)
  if (!day) return null

  const explicitYear = normalized.match(/\b(20\d{2})\b/)
  let year = explicitYear ? Number(explicitYear[1]) : referenceDate.getFullYear()

  if (!explicitYear) {
    const candidates = [year - 1, year, year + 1]
    year = candidates.reduce((closest, candidate) => {
      const distance = Math.abs(Date.UTC(candidate, monthIndex, day) - referenceDate.getTime())
      const closestDistance = Math.abs(Date.UTC(closest, monthIndex, day) - referenceDate.getTime())
      return distance < closestDistance ? candidate : closest
    }, year)
  }

  const month = String(monthIndex + 1).padStart(2, '0')
  const result = `${year}-${month}-${String(day).padStart(2, '0')}`
  return isIsoDate(result) ? result : null
}

function slug(value: string): string {
  const result = normalizedText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return result || 'sin-fecha'
}

export function createWeekId(dateLabel: string, weekStart: string | null): string {
  return `week:${weekStart ?? slug(dateLabel)}`
}

export function createAssignmentId(weekId: string, section: string, identity?: number | string): string {
  return identity === undefined ? `${weekId}:${section}` : `${weekId}:${section}:${identity}`
}

export function createSectionAssignmentIds(
  weekId: string,
  section: string,
  assignments: ReadonlyArray<Pick<Assignment, 'duration' | 'title'>>,
): string[] {
  const occurrences = new Map<string, number>()
  return assignments.map((assignment) => {
    const baseIdentity = slug(`${assignment.title}-${assignment.duration}-min`)
    const occurrence = (occurrences.get(baseIdentity) ?? 0) + 1
    occurrences.set(baseIdentity, occurrence)
    const identity = occurrence === 1 ? baseIdentity : `${baseIdentity}:${occurrence}`
    return createAssignmentId(weekId, section, identity)
  })
}

function parseCompanionMode(value: unknown, fallback: CompanionMode): CompanionMode {
  return value === 'none' || value === 'sameGender' || value === 'freeform' ? value : fallback
}

function parseAssignment(
  value: unknown,
  fallbackId: string,
  fallbackMode: CompanionMode,
): Assignment | null {
  if (!isRecord(value)
    || typeof value.title !== 'string'
    || !isNonNegativeInteger(value.duration)
    || typeof value.student !== 'string') {
    return null
  }

  const companionMode = parseCompanionMode(value.companionMode, fallbackMode)
  const assistant = typeof value.assistant === 'string'
    ? value.assistant
    : companionMode === 'none' ? undefined : ''

  return {
    id: fallbackId,
    title: value.title,
    duration: value.duration,
    student: value.student,
    studentId: optionalString(value.studentId),
    assistant,
    assistantId: optionalString(value.assistantId),
    companionMode,
  }
}

interface ParsedWeek {
  assignmentIdMap: Map<string, string>
  suppliedAssignmentIds: string[]
  week: ProgramWeek
}

function parseWeek(value: unknown, index: number, referenceDate: Date): ParsedWeek | null {
  if (!isRecord(value)
    || !isNonEmptyString(value.date)
    || typeof value.assignedReading !== 'string'
    || typeof value.president !== 'string'
    || typeof value.finalPrayer !== 'string'
    || !Array.isArray(value.songs)
    || value.songs.length < 3
    || !value.songs.every(isPositiveInteger)
    || !Array.isArray(value.school)
    || !Array.isArray(value.livingSpeeches)) {
    return null
  }
  if (value.weekStart !== undefined && value.weekStart !== null && !isIsoDate(value.weekStart)) {
    return null
  }

  const weekStart = isIsoDate(value.weekStart)
    ? value.weekStart
    : inferWeekStart(value.date, referenceDate)
  const weekId = isNonEmptyString(value.id)
    ? value.id
    : createWeekId(value.date, weekStart)

  const schoolIdentities = value.school.map(assignment => ({
    title: isRecord(assignment) && typeof assignment.title === 'string' ? assignment.title : '',
    duration: isRecord(assignment) && isNonNegativeInteger(assignment.duration) ? assignment.duration : 0,
  }))
  const livingIdentities = value.livingSpeeches.map(assignment => ({
    title: isRecord(assignment) && typeof assignment.title === 'string' ? assignment.title : '',
    duration: isRecord(assignment) && isNonNegativeInteger(assignment.duration) ? assignment.duration : 0,
  }))
  const schoolIds = createSectionAssignmentIds(weekId, 'school', schoolIdentities)
  const livingIds = createSectionAssignmentIds(weekId, 'living', livingIdentities)

  const treasures = parseAssignment(value.treasures, createAssignmentId(weekId, 'treasures'), 'none')
  const gems = parseAssignment(value.gems, createAssignmentId(weekId, 'gems'), 'none')
  const reading = parseAssignment(value.reading, createAssignmentId(weekId, 'reading'), 'none')
  const book = parseAssignment(value.book, createAssignmentId(weekId, 'book'), 'freeform')
  const school = value.school.map((assignment, assignmentIndex) => {
    const fallbackMode = isRecord(assignment) && assignment.assistant === undefined
      ? 'none'
      : 'sameGender'
    return parseAssignment(
      assignment,
      schoolIds[assignmentIndex]!,
      fallbackMode,
    )
  })
  const livingSpeeches = value.livingSpeeches.map((assignment, assignmentIndex) => parseAssignment(
    assignment,
    livingIds[assignmentIndex]!,
    'none',
  ))

  if (!treasures || !gems || !reading || !book || school.some(item => !item) || livingSpeeches.some(item => !item)) {
    return null
  }

  const assignments = [
    [value.treasures, treasures],
    [value.gems, gems],
    [value.reading, reading],
    ...value.school.map((assignment, assignmentIndex) => [assignment, school[assignmentIndex]!] as const),
    ...value.livingSpeeches.map((assignment, assignmentIndex) => [assignment, livingSpeeches[assignmentIndex]!] as const),
    [value.book, book],
  ] as const
  const suppliedAssignmentIds: string[] = []
  const assignmentIdMap = new Map<string, string>()
  for (const [rawAssignment, assignment] of assignments) {
    if (!isRecord(rawAssignment) || !isNonEmptyString(rawAssignment.id)) continue
    suppliedAssignmentIds.push(rawAssignment.id)
    assignmentIdMap.set(rawAssignment.id, assignment.id)
  }

  return {
    assignmentIdMap,
    suppliedAssignmentIds,
    week: {
      id: weekId || `week:${index}`,
      weekStart,
      date: value.date,
      songs: [...value.songs],
      president: value.president,
      assignedReading: value.assignedReading,
      treasures,
      gems,
      reading,
      school: school as Assignment[],
      livingSpeeches: livingSpeeches as Assignment[],
      book,
      finalPrayer: value.finalPrayer,
    },
  }
}

function parseStudent(value: unknown): Student | null {
  if (!isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.name)
    || (value.gender !== 'M' && value.gender !== 'F')
    || typeof value.hidden !== 'boolean') {
    return null
  }

  return {
    id: value.id,
    name: value.name.trim(),
    gender: value.gender,
    hidden: value.hidden,
  }
}

function parseHistoryRecord(
  value: unknown,
  fallbackSlotId?: string,
  referenceDate = new Date(),
): AssignmentRecord | null {
  if (!isRecord(value)
    || !isNonEmptyString(value.studentId)
    || (value.assignmentType !== 'school' && value.assignmentType !== 'reading')
    || !isNonEmptyString(value.weekDate)) {
    return null
  }
  if (value.weekStart !== undefined && value.weekStart !== null && !isIsoDate(value.weekStart)) {
    return null
  }

  const weekStart = isIsoDate(value.weekStart)
    ? value.weekStart
    : inferWeekStart(value.weekDate, new Date(isFiniteNumber(value.createdAt) ? value.createdAt : referenceDate.getTime()))
  const weekId = isNonEmptyString(value.weekId)
    ? value.weekId
    : createWeekId(value.weekDate, weekStart)
  const slotId = isNonEmptyString(value.slotId)
    ? value.slotId
    : fallbackSlotId
  if (!slotId) return null

  return {
    slotId,
    studentId: value.studentId,
    companionId: optionalString(value.companionId),
    assignmentType: value.assignmentType,
    weekId,
    weekDate: value.weekDate,
    weekStart,
    updatedAt: isFiniteNumber(value.updatedAt)
      ? value.updatedAt
      : isFiniteNumber(value.createdAt) ? value.createdAt : referenceDate.getTime(),
  }
}

function assignmentValues(week: ProgramWeek): Assignment[] {
  return [
    week.treasures,
    week.gems,
    week.reading,
    ...week.school,
    ...week.livingSpeeches,
    week.book,
  ]
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
}

function linkParticipants(state: AppState): AppState {
  const idsByName = new Map<string, string | null>()
  const studentsById = new Map(state.students.map(student => [student.id, student]))
  for (const student of state.students) {
    const normalized = normalizePersonName(student.name)
    idsByName.set(normalized, idsByName.has(normalized) ? null : student.id)
  }

  const link = (assignment: Assignment): void => {
    const linkedStudent = assignment.studentId ? studentsById.get(assignment.studentId) : undefined
    if (linkedStudent) assignment.student = linkedStudent.name
    else delete assignment.studentId
    if (!assignment.studentId && assignment.student.trim()) {
      assignment.studentId = idsByName.get(normalizePersonName(assignment.student)) ?? undefined
    }

    const linkedAssistant = assignment.assistantId ? studentsById.get(assignment.assistantId) : undefined
    if (linkedAssistant) assignment.assistant = linkedAssistant.name
    else delete assignment.assistantId
    if (!assignment.assistantId && assignment.assistant?.trim()) {
      assignment.assistantId = idsByName.get(normalizePersonName(assignment.assistant)) ?? undefined
    }

    if (assignment.companionMode === 'none') {
      delete assignment.assistant
      delete assignment.assistantId
      return
    }

    if (assignment.companionMode === 'sameGender' && assignment.studentId && assignment.assistantId) {
      const student = studentsById.get(assignment.studentId)
      const assistant = studentsById.get(assignment.assistantId)
      if (!student || !assistant || student.id === assistant.id || student.gender !== assistant.gender) {
        assignment.assistant = ''
        delete assignment.assistantId
      }
    }
  }

  for (const week of state.weeks) {
    assignmentValues(week).forEach(link)
  }

  const validStudentIds = new Set(state.students.map(student => student.id))
  state.assignmentHistory = Object.fromEntries(
    Object.values(state.assignmentHistory)
      .filter(record => validStudentIds.has(record.studentId))
      .map((record) => {
        if (record.companionId && !validStudentIds.has(record.companionId)) delete record.companionId
        return [record.slotId, record]
      }),
  )

  return state
}

function recordBelongsToWeek(record: AssignmentRecord, week: ProgramWeek): boolean {
  if (record.weekId === week.id) return true
  if (record.weekStart && week.weekStart) return record.weekStart === week.weekStart
  return normalizePersonName(record.weekDate) === normalizePersonName(week.date)
}

function reconcileVisibleHistory(state: AppState): AppState {
  const previousHistory = state.assignmentHistory
  state.assignmentHistory = Object.fromEntries(
    Object.entries(previousHistory).filter(([, record]) => (
      !state.weeks.some(week => recordBelongsToWeek(record, week))
    )),
  )

  for (const week of state.weeks) {
    const slots: Array<readonly [Assignment, 'school' | 'reading']> = [
      [week.reading, 'reading'],
      ...week.school.map(assignment => [assignment, 'school'] as const),
    ]
    for (const [assignment, assignmentType] of slots) {
      if (!assignment.studentId) continue
      const previous = previousHistory[assignment.id]
      state.assignmentHistory[assignment.id] = {
        slotId: assignment.id,
        studentId: assignment.studentId,
        companionId: assignment.assistantId,
        assignmentType,
        weekId: week.id,
        weekDate: week.date,
        weekStart: week.weekStart,
        updatedAt: previous?.updatedAt
          ?? (week.weekStart ? Date.parse(`${week.weekStart}T00:00:00Z`) : 0),
      }
    }
  }

  return state
}

function hasValidParticipantReferences(state: AppState): boolean {
  const studentsById = new Map(state.students.map(student => [student.id, student]))
  for (const week of state.weeks) {
    for (const assignment of assignmentValues(week)) {
      if (assignment.studentId) {
        const student = studentsById.get(assignment.studentId)
        if (!student || normalizePersonName(assignment.student) !== normalizePersonName(student.name)) return false
      }
      if (assignment.assistantId) {
        const assistant = studentsById.get(assignment.assistantId)
        if (!assistant
          || normalizePersonName(assignment.assistant ?? '') !== normalizePersonName(assistant.name)) {
          return false
        }
      }
      if (assignment.companionMode === 'sameGender'
        && assignment.studentId
        && assignment.assistantId) {
        const student = studentsById.get(assignment.studentId)!
        const assistant = studentsById.get(assignment.assistantId)!
        if (student.id === assistant.id || student.gender !== assistant.gender) return false
      }
    }
  }

  return Object.values(state.assignmentHistory).every(record => (
    studentsById.has(record.studentId)
    && (!record.companionId || studentsById.has(record.companionId))
  ))
}

export function parseAppState(value: unknown, referenceDate = new Date()): AppState | null {
  if (!isRecord(value)
    || value.schemaVersion !== APP_STATE_SCHEMA_VERSION
    || typeof value.sourceUrl !== 'string'
    || !Array.isArray(value.weeks)
    || !Array.isArray(value.students)
    || (!isRecord(value.assignmentHistory) && !Array.isArray(value.assignmentHistory))) {
    return null
  }

  const parsedWeeks = value.weeks.map((week, index) => parseWeek(week, index, referenceDate))
  const students = value.students.map(parseStudent)
  if (parsedWeeks.some(week => !week) || students.some(student => !student)) return null

  const validWeeks = parsedWeeks as ParsedWeek[]
  const validStudents = students as Student[]
  const weekIds = validWeeks.map(item => item.week.id)
  const weekStarts = validWeeks
    .map(item => item.week.weekStart)
    .filter((weekStart): weekStart is string => Boolean(weekStart))
  const studentIds = validStudents.map(student => student.id)
  const studentNames = validStudents.map(student => normalizePersonName(student.name))
  const suppliedAssignmentIds = validWeeks.flatMap(item => item.suppliedAssignmentIds)
  const canonicalAssignmentIds = validWeeks.flatMap(item => assignmentValues(item.week).map(assignment => assignment.id))
  if (!hasUniqueValues(weekIds)
    || !hasUniqueValues(weekStarts)
    || !hasUniqueValues(studentIds)
    || !hasUniqueValues(studentNames)
    || !hasUniqueValues(suppliedAssignmentIds)
    || !hasUniqueValues(canonicalAssignmentIds)) {
    return null
  }

  const assignmentIdMap = new Map(
    validWeeks.flatMap(item => [...item.assignmentIdMap.entries()]),
  )

  const historyValues = Array.isArray(value.assignmentHistory)
    ? value.assignmentHistory.map((record, index) => [
        isRecord(record) && isNonEmptyString(record.id) ? `legacy:${record.id}` : `legacy:${index}`,
        record,
      ] as const)
    : Object.entries(value.assignmentHistory)
  const assignmentHistory: Record<string, AssignmentRecord> = {}
  for (const [key, recordValue] of historyValues) {
    const record = parseHistoryRecord(recordValue, key, referenceDate)
    if (!record) return null
    record.slotId = assignmentIdMap.get(record.slotId) ?? record.slotId
    if (assignmentHistory[record.slotId]) return null
    assignmentHistory[record.slotId] = record
  }

  const state: AppState = {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    sourceUrl: value.sourceUrl,
    weeks: validWeeks.map(item => item.week),
    students: validStudents,
    assignmentHistory,
  }
  if (!hasValidParticipantReferences(state)) return null
  return reconcileVisibleHistory(linkParticipants(state))
}

export function canonicalAppStatePayload(state: AppState): string | null {
  const parsed = parseAppState(cloneAppState(state))
  return parsed ? JSON.stringify(parsed) : null
}

function parseJson(rawValue: string | null): unknown {
  if (!rawValue) return null
  try {
    return JSON.parse(rawValue) as unknown
  }
  catch {
    return null
  }
}

function parseLegacyUrl(rawValue: string | null): string {
  const parsed = parseJson(rawValue)
  if (typeof parsed === 'string') return parsed
  return rawValue?.startsWith('http') ? rawValue : ''
}

export interface LegacyStateValues {
  sourceUrl: string | null
  weeks: string | null
  weeksBackup: string | null
  students: string | null
  assignmentHistory: string | null
}

function parseLegacyWeeks(value: unknown, referenceDate: Date): { complete: boolean, weeks: ParsedWeek[] } | null {
  if (!Array.isArray(value)) return null
  const parsed = value.map((week, index) => parseWeek(week, index, referenceDate))
  return {
    complete: parsed.every(week => week !== null),
    weeks: parsed.filter((week): week is ParsedWeek => week !== null),
  }
}

function deduplicateLegacyStudents(students: Student[]): Student[] {
  const ids = new Set<string>()
  const names = new Set<string>()
  return students.filter((student) => {
    const name = normalizePersonName(student.name)
    if (ids.has(student.id) || names.has(name)) return false
    ids.add(student.id)
    names.add(name)
    return true
  })
}

export function migrateLegacyState(values: LegacyStateValues, referenceDate = new Date()): AppState | null {
  const hasLegacyData = Object.values(values).some(value => value !== null)
  if (!hasLegacyData) return null

  const rawWeeks = parseJson(values.weeks)
  const backupWeeks = parseJson(values.weeksBackup)
  const primaryCandidate = parseLegacyWeeks(rawWeeks, referenceDate)
  const backupCandidate = parseLegacyWeeks(backupWeeks, referenceDate)
  const selectedCandidate = primaryCandidate?.complete
    ? primaryCandidate
    : backupCandidate?.complete
      ? backupCandidate
      : [primaryCandidate, backupCandidate]
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
          .sort((a, b) => b.weeks.length - a.weeks.length)[0]
  const parsedWeeks = selectedCandidate?.weeks ?? []
  const seenWeekIds = new Set<string>()
  const seenWeekStarts = new Set<string>()
  const validWeeks = parsedWeeks.filter(({ week }) => {
    if (seenWeekIds.has(week.id) || (week.weekStart && seenWeekStarts.has(week.weekStart))) return false
    seenWeekIds.add(week.id)
    if (week.weekStart) seenWeekStarts.add(week.weekStart)
    return true
  })
  const assignmentIdMap = new Map(validWeeks.flatMap(item => [...item.assignmentIdMap.entries()]))

  const rawStudents = parseJson(values.students)
  const students = Array.isArray(rawStudents)
    ? deduplicateLegacyStudents(rawStudents.map(parseStudent).filter((student): student is Student => student !== null))
    : []

  const assignmentHistory: Record<string, AssignmentRecord> = {}
  const rawHistory = parseJson(values.assignmentHistory)
  if (Array.isArray(rawHistory)) {
    rawHistory.forEach((value, index) => {
      const legacyId = isRecord(value) && isNonEmptyString(value.id) ? value.id : String(index)
      const record = parseHistoryRecord(value, `legacy:${legacyId}`, referenceDate)
      if (record) {
        record.slotId = assignmentIdMap.get(record.slotId) ?? record.slotId
        assignmentHistory[record.slotId] = record
      }
    })
  }

  const state = linkParticipants({
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    sourceUrl: parseLegacyUrl(values.sourceUrl),
    weeks: validWeeks.map(item => item.week),
    students,
    assignmentHistory,
  })
  return reconcileVisibleHistory(state)
}

function mergeAssignment(current: Assignment | undefined, incoming: Assignment): Assignment {
  if (!current) return incoming
  return {
    ...incoming,
    student: current.student,
    studentId: current.studentId,
    assistant: incoming.assistant === undefined ? undefined : current.assistant ?? '',
    assistantId: incoming.assistant === undefined ? undefined : current.assistantId,
  }
}

function findMatchingWeek(current: ProgramWeek[], incoming: ProgramWeek): ProgramWeek | undefined {
  return current.find(week => week.id === incoming.id)
    ?? current.find(week => week.weekStart && week.weekStart === incoming.weekStart)
    ?? current.find(week => normalizePersonName(week.date) === normalizePersonName(incoming.date))
}

function mergeDynamicAssignments(
  current: Assignment[],
  incoming: Assignment[],
  assignmentsById: Map<string, Assignment>,
): Assignment[] {
  const identity = (assignment: Assignment): string => `${slug(assignment.title)}:${assignment.duration}`
  const countByIdentity = (assignments: Assignment[]): Map<string, number> => {
    const counts = new Map<string, number>()
    assignments.forEach((assignment) => {
      const key = identity(assignment)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }
  const currentCounts = countByIdentity(current)
  const incomingCounts = countByIdentity(incoming)
  const ambiguous = new Set(
    [...new Set([...currentCounts.keys(), ...incomingCounts.keys()])]
      .filter((key) => {
        const previousCount = currentCounts.get(key) ?? 0
        const nextCount = incomingCounts.get(key) ?? 0
        return previousCount !== nextCount && Math.max(previousCount, nextCount) > 1
      }),
  )

  return incoming.map(assignment => mergeAssignment(
    ambiguous.has(identity(assignment)) ? undefined : assignmentsById.get(assignment.id),
    assignment,
  ))
}

export function countProgramFields(weeks: ProgramWeek[]): number {
  let count = 0
  const filled = (value: string | undefined): void => {
    if (value?.trim()) count += 1
  }

  for (const week of weeks) {
    filled(week.president)
    filled(week.finalPrayer)
    const assignments = [
      week.treasures,
      week.gems,
      week.reading,
      ...week.school,
      ...week.livingSpeeches,
      week.book,
    ]
    for (const assignment of assignments) {
      filled(assignment.student)
      filled(assignment.assistant)
    }
  }

  return count
}

export function mergeProgramWeeks(current: ProgramWeek[], incoming: ProgramWeek[]): ProgramMergeResult {
  const previousFields = countProgramFields(current)
  const weeks = incoming.map((nextWeek) => {
    const previousWeek = findMatchingWeek(current, nextWeek)
    if (!previousWeek) return nextWeek

    const previousAssignments = new Map([
      previousWeek.treasures,
      previousWeek.gems,
      previousWeek.reading,
      ...previousWeek.school,
      ...previousWeek.livingSpeeches,
      previousWeek.book,
    ].map(assignment => [assignment.id, assignment]))

    return {
      ...nextWeek,
      president: previousWeek.president,
      finalPrayer: previousWeek.finalPrayer,
      treasures: mergeAssignment(previousAssignments.get(nextWeek.treasures.id) ?? previousWeek.treasures, nextWeek.treasures),
      gems: mergeAssignment(previousAssignments.get(nextWeek.gems.id) ?? previousWeek.gems, nextWeek.gems),
      reading: mergeAssignment(previousAssignments.get(nextWeek.reading.id) ?? previousWeek.reading, nextWeek.reading),
      school: mergeDynamicAssignments(previousWeek.school, nextWeek.school, previousAssignments),
      livingSpeeches: mergeDynamicAssignments(
        previousWeek.livingSpeeches,
        nextWeek.livingSpeeches,
        previousAssignments,
      ),
      book: mergeAssignment(previousAssignments.get(nextWeek.book.id) ?? previousWeek.book, nextWeek.book),
    }
  })

  return {
    weeks,
    preservedFields: countProgramFields(weeks),
    previousFields,
  }
}

export function exportAppState(state: AppState, exportedAt = new Date().toISOString()): string {
  const envelope: ImportEnvelope = {
    format: 'generador-programas-vm',
    exportedAt,
    data: cloneAppState(state),
  }
  return JSON.stringify(envelope, null, 2)
}

export function parseImportedAppState(rawValue: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawValue) as unknown
  }
  catch {
    return { ok: false, error: 'El archivo no contiene JSON válido.' }
  }

  const candidate = isRecord(parsed) && parsed.format === 'generador-programas-vm'
    ? parsed.data
    : isRecord(parsed) && isRecord(parsed.data) && parsed.schemaVersion === APP_STATE_SCHEMA_VERSION
      ? parsed.data
      : parsed
  const data = parseAppState(candidate)
  return data
    ? { ok: true, data }
    : { ok: false, error: 'El archivo no tiene un respaldo compatible o está incompleto.' }
}
