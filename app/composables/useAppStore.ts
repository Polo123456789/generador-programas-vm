import { computed, type ComputedRef, type WritableComputedRef } from 'vue'
import type {
  AppState,
  Assignment,
  AssignmentRecord,
  AssignmentType,
  Gender,
  ProgramSnapshot,
  ProgramWeek,
  Student,
} from '~/types/domain'
import { cloneAppState, normalizePersonName } from '~/utils/appState'
import {
  getCompanionCandidates,
  getStudentCandidates,
  type CompanionCandidate,
  type StudentCandidate,
} from '~/utils/recommendations'

export type ActionResult<T = undefined>
  = | { ok: true, value: T }
    | { ok: false, error: string }

interface LocatedSlot {
  assignment: Assignment
  assignmentType: AssignmentType
  week: ProgramWeek
}

interface LocatedAssignment {
  assignment: Assignment
  assignmentType: AssignmentType | null
  week: ProgramWeek
}

export interface AppStore {
  state: Readonly<ReturnType<typeof useAppStateRef>>
  sourceUrl: WritableComputedRef<string>
  weeks: ComputedRef<ProgramWeek[]>
  students: ComputedRef<Student[]>
  assignmentHistory: ComputedRef<Record<string, AssignmentRecord>>
  canUndoProgramChange: ComputedRef<boolean>
  addStudent: (name: string, gender: Gender) => ActionResult<Student>
  assignSlot: (slotId: string, studentId: string, companionId?: string) => ActionResult<Assignment>
  clearProgram: () => ActionResult
  editSlotParticipant: (slotId: string, role: 'assistant' | 'student', name: string) => ActionResult<Assignment>
  getCompanionsSorted: (
    mainStudentId: string,
    type: AssignmentType,
    weekId: string,
    weekStart: string | null,
    slotId: string,
  ) => CompanionCandidate[]
  getLastAssignmentDate: (studentId: string, type: AssignmentType) => string | null
  getStudentName: (studentId: string) => string
  getStudentsSortedByLastAssignment: (
    type: AssignmentType,
    weekId: string,
    weekStart: string | null,
    slotId: string,
  ) => StudentCandidate[]
  renameStudent: (studentId: string, name: string) => ActionResult<Student>
  replaceProgram: (sourceUrl: string, weeks: ProgramWeek[]) => ActionResult
  replaceState: (nextState: AppState) => ActionResult
  resolveStudentId: (name: string) => string | undefined
  setSourceUrl: (value: string) => void
  setStudentHidden: (studentId: string, hidden: boolean) => ActionResult<Student>
  toggleStudentHidden: (studentId: string) => ActionResult<Student>
  undoProgramChange: () => ActionResult
}

function cloneProgramWeeks(weeks: ProgramWeek[]): ProgramWeek[] {
  return JSON.parse(JSON.stringify(weeks)) as ProgramWeek[]
}

function cloneAssignmentHistory(
  history: Record<string, AssignmentRecord>,
): Record<string, AssignmentRecord> {
  return JSON.parse(JSON.stringify(history)) as Record<string, AssignmentRecord>
}

function createStudentId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
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

export function useAppStore(): AppStore {
  const state = useAppStateRef()
  const programUndo = useState<ProgramSnapshot | null>('program-undo', () => null)

  const sourceUrl = computed({
    get: () => state.value.sourceUrl,
    set: (value: string) => {
      state.value.sourceUrl = value
    },
  })
  const weeks = computed(() => state.value.weeks)
  const students = computed(() => state.value.students)
  const assignmentHistory = computed(() => state.value.assignmentHistory)
  const canUndoProgramChange = computed(() => programUndo.value !== null)

  function findSlot(slotId: string): LocatedSlot | null {
    const located = findAssignment(slotId)
    return located?.assignmentType
      ? { ...located, assignmentType: located.assignmentType }
      : null
  }

  function findAssignment(assignmentId: string): LocatedAssignment | null {
    for (const week of state.value.weeks) {
      if (week.reading.id === assignmentId) {
        return { assignment: week.reading, assignmentType: 'reading', week }
      }
      const schoolAssignment = week.school.find(assignment => assignment.id === assignmentId)
      if (schoolAssignment) {
        return { assignment: schoolAssignment, assignmentType: 'school', week }
      }
      const untrackedAssignment = [
        week.treasures,
        week.gems,
        ...week.livingSpeeches,
        week.book,
      ].find(assignment => assignment.id === assignmentId)
      if (untrackedAssignment) {
        return { assignment: untrackedAssignment, assignmentType: null, week }
      }
    }
    return null
  }

  function resolveStudentId(name: string): string | undefined {
    const normalized = normalizePersonName(name)
    if (!normalized) return undefined
    const matches = state.value.students.filter(student => normalizePersonName(student.name) === normalized)
    return matches.length === 1 ? matches[0]!.id : undefined
  }

  function getStudentName(studentId: string): string {
    return state.value.students.find(student => student.id === studentId)?.name ?? ''
  }

  function reconcileHistory(
    slot: LocatedSlot,
    previousHistory = state.value.assignmentHistory,
  ): void {
    const { assignment, assignmentType, week } = slot
    if (!assignment.studentId) {
      state.value.assignmentHistory = Object.fromEntries(
        Object.entries(state.value.assignmentHistory)
          .filter(([slotId]) => slotId !== assignment.id),
      )
      return
    }

    const previous = previousHistory[assignment.id]
    const next: AssignmentRecord = {
      slotId: assignment.id,
      studentId: assignment.studentId,
      companionId: assignment.assistantId,
      assignmentType,
      weekId: week.id,
      weekDate: week.date,
      weekStart: week.weekStart,
      updatedAt: previous
        && previous.studentId === assignment.studentId
        && previous.companionId === assignment.assistantId
        && previous.weekId === week.id
        ? previous.updatedAt
        : Date.now(),
    }
    state.value.assignmentHistory[assignment.id] = next
  }

  function reconcileCurrentProgram(): void {
    const currentWeeks = state.value.weeks
    const previousHistory = state.value.assignmentHistory
    state.value.assignmentHistory = Object.fromEntries(
      Object.entries(previousHistory).filter(([, record]) => (
        !currentWeeks.some(week => (
          record.weekId === week.id
          || (record.weekStart && week.weekStart
            ? record.weekStart === week.weekStart
            : normalizePersonName(record.weekDate) === normalizePersonName(week.date))
        ))
      )),
    )

    for (const week of state.value.weeks) {
      const slots: LocatedSlot[] = [
        { assignment: week.reading, assignmentType: 'reading', week },
        ...week.school.map(assignment => ({ assignment, assignmentType: 'school' as const, week })),
      ]
      slots.forEach(slot => reconcileHistory(slot, previousHistory))
    }
  }

  function setSourceUrl(value: string): void {
    state.value.sourceUrl = value
  }

  function replaceProgram(nextSourceUrl: string, nextWeeks: ProgramWeek[]): ActionResult {
    if (nextWeeks.length === 0) {
      return { ok: false, error: 'El programa importado no contiene semanas utilizables.' }
    }

    programUndo.value = {
      assignmentHistory: cloneAssignmentHistory(state.value.assignmentHistory),
      sourceUrl: state.value.sourceUrl,
      weeks: cloneProgramWeeks(state.value.weeks),
    }
    state.value.sourceUrl = nextSourceUrl
    state.value.weeks = cloneProgramWeeks(nextWeeks)
    reconcileCurrentProgram()
    return { ok: true, value: undefined }
  }

  function clearProgram(): ActionResult {
    if (state.value.weeks.length === 0) return { ok: true, value: undefined }
    programUndo.value = {
      assignmentHistory: cloneAssignmentHistory(state.value.assignmentHistory),
      sourceUrl: state.value.sourceUrl,
      weeks: cloneProgramWeeks(state.value.weeks),
    }
    state.value.weeks = []
    return { ok: true, value: undefined }
  }

  function undoProgramChange(): ActionResult {
    const previous = programUndo.value
    if (!previous) return { ok: false, error: 'No hay un cambio de programa para deshacer.' }

    const current: ProgramSnapshot = {
      assignmentHistory: cloneAssignmentHistory(state.value.assignmentHistory),
      sourceUrl: state.value.sourceUrl,
      weeks: cloneProgramWeeks(state.value.weeks),
    }
    state.value.sourceUrl = previous.sourceUrl
    state.value.weeks = cloneProgramWeeks(previous.weeks)
    state.value.assignmentHistory = cloneAssignmentHistory(previous.assignmentHistory)
    programUndo.value = current
    reconcileCurrentProgram()
    return { ok: true, value: undefined }
  }

  function replaceState(nextState: AppState): ActionResult {
    programUndo.value = null
    state.value = cloneAppState(nextState)
    return { ok: true, value: undefined }
  }

  function addStudent(name: string, gender: Gender): ActionResult<Student> {
    const trimmedName = name.trim().replace(/\s+/g, ' ')
    if (!trimmedName) return { ok: false, error: 'El nombre es requerido.' }
    const duplicate = state.value.students.some(student => (
      normalizePersonName(student.name) === normalizePersonName(trimmedName)
    ))
    if (duplicate) return { ok: false, error: 'Ya existe un estudiante con ese nombre.' }

    const student: Student = {
      id: createStudentId(),
      name: trimmedName,
      gender,
      hidden: false,
    }
    state.value.students.push(student)
    return { ok: true, value: student }
  }

  function setStudentHidden(studentId: string, hidden: boolean): ActionResult<Student> {
    const student = state.value.students.find(item => item.id === studentId)
    if (!student) return { ok: false, error: 'No se encontró el estudiante.' }
    student.hidden = hidden
    return { ok: true, value: student }
  }

  function toggleStudentHidden(studentId: string): ActionResult<Student> {
    const student = state.value.students.find(item => item.id === studentId)
    return student
      ? setStudentHidden(studentId, !student.hidden)
      : { ok: false, error: 'No se encontró el estudiante.' }
  }

  function renameStudent(studentId: string, name: string): ActionResult<Student> {
    const student = state.value.students.find(item => item.id === studentId)
    if (!student) return { ok: false, error: 'No se encontró el estudiante.' }

    const trimmedName = name.trim().replace(/\s+/g, ' ')
    if (!trimmedName) return { ok: false, error: 'El nombre es requerido.' }
    const duplicate = state.value.students.some(item => (
      item.id !== studentId && normalizePersonName(item.name) === normalizePersonName(trimmedName)
    ))
    if (duplicate) return { ok: false, error: 'Ya existe un estudiante con ese nombre.' }

    student.name = trimmedName
    for (const week of state.value.weeks) {
      for (const assignment of assignmentValues(week)) {
        if (assignment.studentId === studentId) assignment.student = trimmedName
        if (assignment.assistantId === studentId) assignment.assistant = trimmedName
      }
    }
    return { ok: true, value: student }
  }

  function assignSlot(slotId: string, studentId: string, companionId?: string): ActionResult<Assignment> {
    const slot = findSlot(slotId)
    if (!slot) return { ok: false, error: 'No se encontró la parte del programa.' }

    const student = state.value.students.find(item => item.id === studentId && !item.hidden)
    if (!student) return { ok: false, error: 'El estudiante no está disponible.' }
    if (slot.assignmentType === 'reading' && student.gender !== 'M') {
      return { ok: false, error: 'La lectura bíblica debe asignarse a un estudiante varón.' }
    }

    let companion: Student | undefined
    if (slot.assignment.companionMode === 'sameGender') {
      companion = state.value.students.find(item => item.id === companionId && !item.hidden)
      if (!companion || companion.id === student.id || companion.gender !== student.gender) {
        return { ok: false, error: 'Selecciona un compañero disponible del mismo género.' }
      }
    }

    slot.assignment.student = student.name
    slot.assignment.studentId = student.id
    if (slot.assignment.companionMode === 'sameGender') {
      slot.assignment.assistant = companion!.name
      slot.assignment.assistantId = companion!.id
    }
    else {
      delete slot.assignment.assistantId
    }
    reconcileHistory(slot)
    return { ok: true, value: slot.assignment }
  }

  function editSlotParticipant(
    slotId: string,
    role: 'assistant' | 'student',
    name: string,
  ): ActionResult<Assignment> {
    const located = findAssignment(slotId)
    if (!located) return { ok: false, error: 'No se encontró la parte del programa.' }

    if (role === 'student') {
      const studentId = resolveStudentId(name)
      const student = studentId
        ? state.value.students.find(item => item.id === studentId)
        : undefined
      if (located.assignmentType === 'reading' && student && student.gender !== 'M') {
        return { ok: false, error: 'La lectura bíblica debe asignarse a un estudiante varón.' }
      }
      located.assignment.student = name
      located.assignment.studentId = studentId
    }
    else {
      located.assignment.assistant = name
      located.assignment.assistantId = resolveStudentId(name)
    }

    if (located.assignment.companionMode === 'sameGender'
      && located.assignment.studentId
      && located.assignment.assistantId) {
      const student = state.value.students.find(item => item.id === located.assignment.studentId)
      const assistant = state.value.students.find(item => item.id === located.assignment.assistantId)
      if (!student || !assistant || student.gender !== assistant.gender || student.id === assistant.id) {
        located.assignment.assistant = ''
        delete located.assignment.assistantId
      }
    }

    if (located.assignmentType) {
      reconcileHistory({ ...located, assignmentType: located.assignmentType })
    }
    return { ok: true, value: located.assignment }
  }

  function getStudentsSortedByLastAssignment(
    type: AssignmentType,
    weekId: string,
    weekStart: string | null,
    slotId: string,
  ): StudentCandidate[] {
    return getStudentCandidates(
      state.value.students,
      state.value.assignmentHistory,
      type,
      weekId,
      weekStart,
      slotId,
    )
  }

  function getCompanionsSorted(
    mainStudentId: string,
    type: AssignmentType,
    weekId: string,
    weekStart: string | null,
    slotId: string,
  ): CompanionCandidate[] {
    return getCompanionCandidates(
      state.value.students,
      state.value.assignmentHistory,
      mainStudentId,
      type,
      weekId,
      weekStart,
      slotId,
    )
  }

  function getLastAssignmentDate(studentId: string, type: AssignmentType): string | null {
    const records = Object.values(state.value.assignmentHistory)
      .filter(record => (
        record.assignmentType === type
        && (record.studentId === studentId || record.companionId === studentId)
      ))
      .sort((a, b) => {
        if (a.weekStart && b.weekStart) return b.weekStart.localeCompare(a.weekStart)
        return b.updatedAt - a.updatedAt
      })
    return records[0]?.weekDate ?? null
  }

  return {
    state,
    sourceUrl,
    weeks,
    students,
    assignmentHistory,
    canUndoProgramChange,
    addStudent,
    assignSlot,
    clearProgram,
    editSlotParticipant,
    getCompanionsSorted,
    getLastAssignmentDate,
    getStudentName,
    getStudentsSortedByLastAssignment,
    renameStudent,
    replaceProgram,
    replaceState,
    resolveStudentId,
    setSourceUrl,
    setStudentHidden,
    toggleStudentHidden,
    undoProgramChange,
  }
}
