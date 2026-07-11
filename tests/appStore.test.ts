import { afterEach, describe, expect, test } from 'bun:test'
import { ref, type Ref } from 'vue'
import type { AppState } from '../app/types/domain'
import { useAppStore } from '../app/composables/useAppStore'
import { cloneAppState, parseAppState } from '../app/utils/appState'
import { createState } from './helpers'

const nuxtState = new Map<string, Ref<unknown>>()
let appState = ref<AppState>(createState())

Object.assign(globalThis, {
  useAppStateRef: (): Ref<AppState> => appState,
  useState: <T>(key: string, init: () => T): Ref<T> => {
    if (!nuxtState.has(key)) nuxtState.set(key, ref(init()))
    return nuxtState.get(key) as Ref<T>
  },
})

afterEach(() => {
  appState = ref<AppState>(createState())
  nuxtState.clear()
})

describe('app store assignment invariants', () => {
  test('reassigning one slot replaces its history record', () => {
    const store = useAppStore()
    const slot = store.weeks.value[0]!.school[0]!

    expect(store.assignSlot(slot.id, 'ana', 'bea').ok).toBeTrue()
    expect(store.assignSlot(slot.id, 'bea', 'ana').ok).toBeTrue()

    expect(Object.keys(store.assignmentHistory.value)).toEqual([slot.id])
    expect(store.assignmentHistory.value[slot.id]?.studentId).toBe('bea')
    expect(slot.student).toBe('Bea')
  })

  test('manual text clears a stale link and exact names relink it', () => {
    const store = useAppStore()
    const slot = store.weeks.value[0]!.school[0]!
    store.assignSlot(slot.id, 'ana', 'bea')

    store.editSlotParticipant(slot.id, 'student', 'Persona invitada')
    expect(slot.studentId).toBeUndefined()
    expect(store.assignmentHistory.value[slot.id]).toBeUndefined()

    store.editSlotParticipant(slot.id, 'student', '  ANA ')
    expect(slot.studentId).toBe('ana')
    expect(store.assignmentHistory.value[slot.id]?.studentId).toBe('ana')
  })

  test('shared state survives creating a new page-level store', () => {
    const firstPage = useAppStore()
    firstPage.addStudent('Daniel', 'M')

    const secondPage = useAppStore()
    expect(secondPage.students.value.some(student => student.name === 'Daniel')).toBeTrue()
  })

  test('clears and restores the complete program snapshot', () => {
    const store = useAppStore()
    const slot = store.weeks.value[0]!.school[0]!
    store.assignSlot(slot.id, 'ana', 'bea')
    const previousHistory = JSON.parse(JSON.stringify(store.assignmentHistory.value)) as AppState['assignmentHistory']

    expect(store.clearProgram().ok).toBeTrue()
    expect(store.weeks.value).toEqual([])
    expect(store.canUndoProgramChange.value).toBeTrue()
    expect(store.undoProgramChange().ok).toBeTrue()
    expect(store.weeks.value).toHaveLength(1)
    expect(store.assignmentHistory.value).toEqual(previousHistory)
  })

  test('invalidates program undo when replacing the complete state', () => {
    const store = useAppStore()
    store.clearProgram()
    const imported = createState()
    imported.sourceUrl = 'https://example.com/imported'
    imported.students = [imported.students[2]!]

    expect(store.replaceState(imported).ok).toBeTrue()
    expect(store.canUndoProgramChange.value).toBeFalse()
    expect(store.undoProgramChange().ok).toBeFalse()
    expect(store.sourceUrl.value).toBe(imported.sourceUrl)
    expect(store.students.value.map(student => student.id)).toEqual(['carlos'])
  })

  test('renames linked participants and hides students from assignment', () => {
    const store = useAppStore()
    const slot = store.weeks.value[0]!.school[0]!
    store.assignSlot(slot.id, 'ana', 'bea')

    expect(store.renameStudent('ana', 'Ana María').ok).toBeTrue()
    expect(slot.student).toBe('Ana María')
    expect(store.toggleStudentHidden('ana').ok).toBeTrue()
    expect(store.assignSlot(slot.id, 'ana', 'bea').ok).toBeFalse()
  })

  test('enforces companion and reading gender rules in the store', () => {
    const store = useAppStore()
    const week = store.weeks.value[0]!
    const schoolSlot = week.school[0]!

    expect(store.assignSlot(schoolSlot.id, 'ana', 'carlos').ok).toBeFalse()
    expect(store.assignSlot(schoolSlot.id, 'ana', 'bea').ok).toBeTrue()
    expect(store.editSlotParticipant(schoolSlot.id, 'student', 'Carlos').ok).toBeTrue()
    expect(schoolSlot.studentId).toBe('carlos')
    expect(schoolSlot.assistant).toBe('')
    expect(schoolSlot.assistantId).toBeUndefined()
    expect(store.assignmentHistory.value[schoolSlot.id]?.companionId).toBeUndefined()

    expect(store.assignSlot(week.reading.id, 'ana').ok).toBeFalse()
    expect(store.editSlotParticipant(week.reading.id, 'student', 'Ana').ok).toBeFalse()
    expect(week.reading.student).toBe('')
    expect(store.assignSlot(week.reading.id, 'carlos').ok).toBeTrue()
  })

  test('rejects duplicate names and reports the latest assignment', () => {
    const store = useAppStore()
    const week = store.weeks.value[0]!

    expect(store.addStudent('  ANA  ', 'F').ok).toBeFalse()
    store.assignSlot(week.reading.id, 'carlos')
    expect(store.getLastAssignmentDate('carlos', 'reading')).toBe(week.date)
  })

  test('clears stale links when editing every direct participant field', () => {
    const store = useAppStore()
    const week = store.weeks.value[0]!
    const directAssignments = [week.treasures, week.gems, ...week.livingSpeeches, week.book]

    for (const assignment of directAssignments) {
      expect(store.editSlotParticipant(assignment.id, 'student', 'Ana').ok).toBeTrue()
      expect(assignment.studentId).toBe('ana')
      expect(store.editSlotParticipant(assignment.id, 'student', 'Persona invitada').ok).toBeTrue()
      expect(assignment.studentId).toBeUndefined()
      expect(assignment.student).toBe('Persona invitada')
    }
    expect(store.editSlotParticipant(week.book.id, 'assistant', 'Bea').ok).toBeTrue()
    expect(week.book.assistantId).toBe('bea')
    expect(store.editSlotParticipant(week.book.id, 'assistant', 'Lector invitado').ok).toBeTrue()
    expect(week.book.assistantId).toBeUndefined()

    const reparsed = parseAppState(cloneAppState(store.state.value))
    expect(reparsed?.weeks[0]?.treasures.student).toBe('Persona invitada')
    expect(reparsed?.weeks[0]?.book.assistant).toBe('Lector invitado')
  })
})
