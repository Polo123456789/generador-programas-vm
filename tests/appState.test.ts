import { describe, expect, test } from 'bun:test'
import {
  cloneAppState,
  canonicalAppStatePayload,
  createAssignmentId,
  createSectionAssignmentIds,
  exportAppState,
  inferWeekStart,
  mergeProgramWeeks,
  migrateLegacyState,
  parseAppState,
  parseImportedAppState,
} from '../app/utils/appState'
import { createAssignment, createState, createWeek } from './helpers'

describe('app state validation and migration', () => {
  test('rejects structurally invalid persisted data', () => {
    expect(parseAppState([])).toBeNull()
    expect(parseAppState({ schemaVersion: 1, sourceUrl: '', weeks: [{}], students: [], assignmentHistory: {} })).toBeNull()
  })

  test('rejects impossible dates, invalid numbers and duplicate identities', () => {
    const impossibleDate = createState()
    impossibleDate.weeks[0]!.weekStart = '2026-02-30'
    expect(parseAppState(impossibleDate)).toBeNull()

    const invalidDuration = createState()
    invalidDuration.weeks[0]!.reading.duration = -1
    expect(parseAppState(invalidDuration)).toBeNull()

    const duplicateStudents = createState()
    duplicateStudents.students[1]!.id = duplicateStudents.students[0]!.id
    expect(parseAppState(duplicateStudents)).toBeNull()

    const duplicateWeeks = createState()
    duplicateWeeks.weeks.push(cloneAppState(duplicateWeeks).weeks[0]!)
    expect(parseAppState(duplicateWeeks)).toBeNull()

    const duplicateSlots = createState()
    duplicateSlots.weeks[0]!.school[0]!.id = duplicateSlots.weeks[0]!.reading.id
    expect(parseAppState(duplicateSlots)).toBeNull()
  })

  test('rejects broken or contradictory participant references', () => {
    const foreignReference = createState()
    foreignReference.weeks[0]!.school[0]!.student = 'Ana'
    foreignReference.weeks[0]!.school[0]!.studentId = 'ana'
    foreignReference.students = foreignReference.students.filter(student => student.id !== 'ana')
    expect(parseAppState(foreignReference)).toBeNull()

    const contradictoryReference = createState()
    contradictoryReference.weeks[0]!.school[0]!.student = 'Persona invitada'
    contradictoryReference.weeks[0]!.school[0]!.studentId = 'ana'
    expect(parseAppState(contradictoryReference)).toBeNull()
  })

  test('uses a canonical payload independent of property insertion order', () => {
    const state = createState()
    state.weeks[0]!.treasures.student = 'Ana'
    const parsed = parseAppState(state)
    if (!parsed) throw new Error('invalid fixture')
    const reordered = cloneAppState(parsed)
    const { studentId, ...assignmentWithoutId } = reordered.weeks[0]!.treasures
    reordered.weeks[0]!.treasures = { studentId, ...assignmentWithoutId }

    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(parsed))
    expect(canonicalAppStatePayload(reordered)).toBe(canonicalAppStatePayload(parsed))
  })

  test('canonicalizes missing visible history without depending on the clock', async () => {
    const state = createState()
    state.weeks[0]!.school[0]!.student = 'Ana'
    state.weeks[0]!.school[0]!.studentId = 'ana'
    state.weeks[0]!.school[0]!.assistant = 'Bea'
    state.weeks[0]!.school[0]!.assistantId = 'bea'

    const first = canonicalAppStatePayload(state)
    await Bun.sleep(5)
    const second = canonicalAppStatePayload(state)

    expect(second).toBe(first)
    expect(JSON.parse(first ?? '{}').assignmentHistory[state.weeks[0]!.school[0]!.id].updatedAt).toBe(
      Date.parse('2026-07-06T00:00:00Z'),
    )
  })

  test('sanitizes corrupt legacy collections instead of crashing', () => {
    const migrated = migrateLegacyState({
      sourceUrl: '"https://example.com"',
      weeks: '[{}]',
      weeksBackup: null,
      students: '{}',
      assignmentHistory: '{"bad":true}',
    })

    expect(migrated).not.toBeNull()
    expect(migrated?.weeks).toEqual([])
    expect(migrated?.students).toEqual([])
    expect(migrated?.sourceUrl).toBe('https://example.com')
  })

  test('uses a valid legacy backup when the primary weeks are corrupt', () => {
    const migrated = migrateLegacyState({
      sourceUrl: null,
      weeks: '[{}]',
      weeksBackup: JSON.stringify([createWeek()]),
      students: '[]',
      assignmentHistory: '[]',
    }, new Date('2026-07-10T12:00:00Z'))

    expect(migrated?.weeks).toHaveLength(1)
    expect(migrated?.weeks[0]?.weekStart).toBe('2026-07-06')
  })

  test('migrates legacy names to unambiguous student ids', () => {
    const state = createState()
    state.weeks[0]!.reading.student = 'Carlos'
    const legacyWeek = cloneAppState(state).weeks[0]
    if (!legacyWeek) throw new Error('missing fixture week')
    const legacyAssignment = legacyWeek.reading as unknown as Record<string, unknown>
    delete legacyAssignment.id
    delete legacyAssignment.companionMode
    const legacyWeekValue = legacyWeek as unknown as Record<string, unknown>
    delete legacyWeekValue.id
    delete legacyWeekValue.weekStart

    const migrated = migrateLegacyState({
      sourceUrl: JSON.stringify(state.sourceUrl),
      weeks: JSON.stringify([legacyWeek]),
      weeksBackup: null,
      students: JSON.stringify(state.students),
      assignmentHistory: JSON.stringify([]),
    }, new Date('2026-07-10T12:00:00Z'))

    expect(migrated?.weeks[0]?.reading.studentId).toBe('carlos')
    expect(migrated?.assignmentHistory[migrated.weeks[0]!.reading.id]?.studentId).toBe('carlos')
  })

  test('rebuilds active legacy history from the final visible assignment', () => {
    const state = createState()
    const week = state.weeks[0]!
    week.reading.student = 'Carlos'
    week.reading.studentId = 'carlos'
    const migrated = migrateLegacyState({
      sourceUrl: null,
      weeks: JSON.stringify(state.weeks),
      weeksBackup: null,
      students: JSON.stringify(state.students),
      assignmentHistory: JSON.stringify([
        {
          id: 'click-ana',
          slotId: 'legacy:click-ana',
          studentId: 'ana',
          assignmentType: 'reading',
          weekId: week.id,
          weekDate: week.date,
          weekStart: week.weekStart,
          createdAt: Date.parse('2026-07-06T00:00:00Z'),
        },
      ]),
    }, new Date('2026-07-10T12:00:00Z'))

    expect(Object.keys(migrated?.assignmentHistory ?? {})).toEqual([week.reading.id])
    expect(migrated?.assignmentHistory[week.reading.id]?.studentId).toBe('carlos')
  })

  test('canonicalizes legacy positional slot ids and reconciles visible history', () => {
    const state = createState()
    const week = state.weeks[0]!
    const positionalId = createAssignmentId(week.id, 'school', 0)
    week.school[0]!.id = positionalId
    week.school[0]!.student = 'Ana'
    week.school[0]!.studentId = 'ana'
    state.assignmentHistory[positionalId] = {
      slotId: positionalId,
      studentId: 'bea',
      assignmentType: 'school',
      weekId: week.id,
      weekDate: week.date,
      weekStart: week.weekStart,
      updatedAt: 1,
    }

    const parsed = parseAppState(state, new Date('2026-07-10T12:00:00Z'))
    const semanticId = createSectionAssignmentIds(week.id, 'school', [week.school[0]!])[0]!
    expect(parsed?.weeks[0]?.school[0]?.id).toBe(semanticId)
    expect(Object.keys(parsed?.assignmentHistory ?? {})).toEqual([semanticId])
    expect(parsed?.assignmentHistory[semanticId]?.studentId).toBe('ana')
  })
})

describe('dates, merge and data transfer', () => {
  test('keeps the real year and infers the nearest year around January', () => {
    expect(inferWeekStart('29 de diciembre de 2025 a 4 de enero de 2026')).toBe('2025-12-29')
    expect(inferWeekStart('29 Dic. a 4 Ene.', new Date('2026-01-02T12:00:00Z'))).toBe('2025-12-29')
  })

  test('preserves manual values when reloading matching weeks and slots', () => {
    const current = createWeek()
    current.president = 'Presidente'
    current.reading.student = 'Nombre manual'
    current.school[0]!.student = 'Ana'
    current.school[0]!.studentId = 'ana'

    const incoming = createWeek()
    const result = mergeProgramWeeks([current], [incoming])

    expect(result.weeks[0]?.president).toBe('Presidente')
    expect(result.weeks[0]?.reading.student).toBe('Nombre manual')
    expect(result.weeks[0]?.school[0]?.studentId).toBe('ana')
    expect(result.weeks[0]?.school[0]?.title).toBe('Empiece conversaciones')
    expect(result.previousFields).toBe(3)
    expect(result.preservedFields).toBe(3)
  })

  test('reports a changed dynamic-part identity instead of transferring its participant', () => {
    const current = createWeek()
    const incoming = createWeek()
    current.school[0]!.student = 'Ana'
    current.school[0]!.studentId = 'ana'
    incoming.school[0]!.title = 'Título actualizado'
    incoming.school[0]!.id = createSectionAssignmentIds(incoming.id, 'school', [incoming.school[0]!])[0]!

    const result = mergeProgramWeeks([current], [incoming])

    expect(result.weeks[0]?.school[0]?.student).toBe('')
    expect(result.previousFields).toBe(1)
    expect(result.preservedFields).toBe(0)
  })

  test('does not move participants when a new dynamic part is inserted', () => {
    const current = createWeek()
    const incoming = createWeek()
    const currentTitles = ['Parte A', 'Parte B']
    const incomingTitles = ['Parte nueva', ...currentTitles]
    const currentIdentities = currentTitles.map(title => ({ title, duration: 5 }))
    const incomingIdentities = incomingTitles.map(title => ({ title, duration: 5 }))
    const currentIds = createSectionAssignmentIds(current.id, 'school', currentIdentities)
    const incomingIds = createSectionAssignmentIds(incoming.id, 'school', incomingIdentities)
    current.school = currentTitles.map((title, index) => (
      createAssignment(currentIds[index]!, title, 'sameGender')
    ))
    incoming.school = incomingTitles.map((title, index) => (
      createAssignment(incomingIds[index]!, title, 'sameGender')
    ))
    current.school[0]!.student = 'Ana'
    current.school[0]!.studentId = 'ana'
    current.school[1]!.student = 'Bea'
    current.school[1]!.studentId = 'bea'

    const result = mergeProgramWeeks([current], [incoming])

    expect(result.weeks[0]?.school.map(assignment => assignment.student)).toEqual(['', 'Ana', 'Bea'])
    expect(result.preservedFields).toBe(2)
  })

  test('treats a changed count of indistinguishable duplicate parts as data at risk', () => {
    const current = createWeek()
    const incoming = createWeek()
    const previousParts = Array.from({ length: 2 }, () => ({ title: 'Empiece conversaciones', duration: 3 }))
    const nextParts = Array.from({ length: 3 }, () => ({ title: 'Empiece conversaciones', duration: 3 }))
    const previousIds = createSectionAssignmentIds(current.id, 'school', previousParts)
    const nextIds = createSectionAssignmentIds(incoming.id, 'school', nextParts)
    current.school = previousParts.map((part, index) => createAssignment(
      previousIds[index]!,
      part.title,
      'sameGender',
    ))
    incoming.school = nextParts.map((part, index) => createAssignment(
      nextIds[index]!,
      part.title,
      'sameGender',
    ))
    current.school[0]!.duration = 3
    current.school[1]!.duration = 3
    incoming.school.forEach(assignment => assignment.duration = 3)
    current.school[0]!.student = 'Ana'
    current.school[1]!.student = 'Bea'

    const result = mergeProgramWeeks([current], [incoming])

    expect(result.weeks[0]?.school.map(assignment => assignment.student)).toEqual(['', '', ''])
    expect(result.previousFields).toBe(2)
    expect(result.preservedFields).toBe(0)
  })

  test('round-trips exports and rejects invalid imports', () => {
    const state = createState()
    const imported = parseImportedAppState(exportAppState(state, '2026-07-10T12:00:00.000Z'))
    expect(imported.ok).toBeTrue()
    if (imported.ok) expect(imported.data).toEqual(state)

    expect(parseImportedAppState('{bad json')).toEqual({
      ok: false,
      error: 'El archivo no contiene JSON válido.',
    })
    expect(parseImportedAppState('{}').ok).toBeFalse()
  })
})
