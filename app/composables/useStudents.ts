import type { Ref } from 'vue'
import type { Student, AssignmentRecord } from '~/utils/students'
import { generateId } from '~/utils/students'
import { debugLog } from '~/utils/debug'

const STUDENTS_KEY = 'students'
const ASSIGNMENT_HISTORY_KEY = 'assignmentHistory'

// Mapeo de meses en español a números
const MONTHS_ES: Record<string, number> = {
  'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
  'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
}

// Parsear fecha del formato "2-8 De Marzo" a timestamp
function parseWeekDate(dateStr: string): number {
  const match = dateStr.toLowerCase().match(/(\d+)-\d+\s+de\s+(\w+)/)
  if (!match || !match[1] || !match[2]) return 0

  const day = parseInt(match[1])
  const monthName = match[2].toLowerCase()
  const month = MONTHS_ES[monthName]

  if (month === undefined) return 0

  const year = new Date().getFullYear()
  return new Date(year, month, day).getTime()
}

// Variables para el estado global
let globalStudents: Ref<Student[]> | null = null
let globalAssignmentHistory: Ref<AssignmentRecord[]> | null = null

function initializeGlobalState() {
  debugLog('useStudents', 'Initializing global state...')
  if (!globalStudents) {
    debugLog('useStudents', 'Creating globalStudents ref')
    globalStudents = useLocalStorage<Student[]>(STUDENTS_KEY, []) as Ref<Student[]>
  }
  if (!globalAssignmentHistory) {
    debugLog('useStudents', 'Creating globalAssignmentHistory ref')
    globalAssignmentHistory = useLocalStorage<AssignmentRecord[]>(ASSIGNMENT_HISTORY_KEY, []) as Ref<AssignmentRecord[]>
  }
  debugLog('useStudents', 'Global state initialized')
}

export function useStudents() {
  debugLog('useStudents', 'useStudents() called')

  // Initialize on first call
  if (!globalStudents || !globalAssignmentHistory) {
    initializeGlobalState()
  }

  const students = globalStudents!
  const assignmentHistory = globalAssignmentHistory!

  debugLog('useStudents', 'Refs assigned:', { students: !!globalStudents, assignmentHistory: !!globalAssignmentHistory })

  function addStudent(name: string, gender: 'M' | 'F'): Student {
    const student: Student = {
      id: generateId(),
      name: name.trim(),
      gender,
      hidden: false,
    }
    students.value.push(student)
    return student
  }

  function toggleStudentHidden(id: string): void {
    const student = students.value.find(s => s.id === id)
    if (student) {
      student.hidden = !student.hidden
    }
  }

  function getLastAssignmentDate(studentId: string, type: 'school' | 'reading'): string | null {
    const records = assignmentHistory.value
      .filter(r =>
        (r.studentId === studentId || r.companionId === studentId) &&
        r.assignmentType === type
      )
      .sort((a, b) => b.createdAt - a.createdAt)

    return records.length > 0 ? records[0]?.weekDate ?? null : null
  }

  function getLastTimeTogether(studentId1: string, studentId2: string): string | null {
    const records = assignmentHistory.value
      .filter(r =>
        (r.studentId === studentId1 && r.companionId === studentId2) ||
        (r.studentId === studentId2 && r.companionId === studentId1)
      )
      .sort((a, b) => b.createdAt - a.createdAt)

    return records.length > 0 ? records[0]?.weekDate ?? null : null
  }

  function getStudentsSortedByLastAssignment(type: 'school' | 'reading', _weekDate: string): Array<Student & { lastAssignmentDate: string | null }> {
    const visibleStudents = students.value.filter(s => !s.hidden)

    return visibleStudents
      .map(student => ({
        ...student,
        lastAssignmentDate: getLastAssignmentDate(student.id, type),
      }))
      .sort((a, b) => {
        if (!a.lastAssignmentDate && !b.lastAssignmentDate) return 0
        if (!a.lastAssignmentDate) return -1
        if (!b.lastAssignmentDate) return 1

        const dateA = parseWeekDate(a.lastAssignmentDate)
        const dateB = parseWeekDate(b.lastAssignmentDate)
        return dateA - dateB
      })
  }

  function getCompanionsSorted(mainStudentId: string, _weekDate: string, type: 'school' | 'reading'): Array<Student & { lastTimeTogether: string | null, lastAssignmentDate: string | null }> {
    const mainStudent = students.value.find(s => s.id === mainStudentId)
    if (!mainStudent) return []

    const mainStudentGender = mainStudent.gender

    const visibleStudents = students.value.filter(s =>
      !s.hidden &&
      s.id !== mainStudentId &&
      s.gender === mainStudentGender
    )

    return visibleStudents
      .map(student => ({
        ...student,
        lastTimeTogether: getLastTimeTogether(mainStudentId, student.id),
        lastAssignmentDate: getLastAssignmentDate(student.id, type),
      }))
      .sort((a, b) => {
        let comparison = 0
        if (!a.lastTimeTogether && !b.lastTimeTogether) {
          comparison = 0
        } else if (!a.lastTimeTogether) {
          comparison = -1
        } else if (!b.lastTimeTogether) {
          comparison = 1
        } else {
          const dateA = parseWeekDate(a.lastTimeTogether)
          const dateB = parseWeekDate(b.lastTimeTogether)
          comparison = dateA - dateB
        }

        if (comparison === 0) {
          if (!a.lastAssignmentDate && !b.lastAssignmentDate) {
            comparison = 0
          } else if (!a.lastAssignmentDate) {
            comparison = -1
          } else if (!b.lastAssignmentDate) {
            comparison = 1
          } else {
            const assignDateA = parseWeekDate(a.lastAssignmentDate)
            const assignDateB = parseWeekDate(b.lastAssignmentDate)
            comparison = assignDateA - assignDateB
          }
        }

        return comparison
      })
  }

  function assignStudent(record: Omit<AssignmentRecord, 'id' | 'createdAt'>): void {
    debugLog('useStudents', 'assignStudent() called:', record)
    debugLog('useStudents', 'assignmentHistory ref:', assignmentHistory)
    debugLog('useStudents', 'assignmentHistory.value before:', assignmentHistory.value.length)

    const fullRecord: AssignmentRecord = {
      ...record,
      id: generateId(),
      createdAt: Date.now(),
    }

    debugLog('useStudents', 'Creating new record:', fullRecord)

    const newArray = [...assignmentHistory.value, fullRecord]
    debugLog('useStudents', 'New array length:', newArray.length)

    assignmentHistory.value = newArray

    debugLog('useStudents', 'assignmentHistory.value after:', assignmentHistory.value.length)

    // Verify localStorage was updated
    setTimeout(() => {
      const stored = window.localStorage.getItem(ASSIGNMENT_HISTORY_KEY)
      const parsed = stored ? JSON.parse(stored) : []
      debugLog('useStudents', 'localStorage verification:', parsed.length, 'records')
    }, 100)
  }

  function getStudentName(studentId: string): string {
    const student = students.value.find(s => s.id === studentId)
    return student?.name || ''
  }

  return {
    students,
    assignmentHistory,
    addStudent,
    toggleStudentHidden,
    getStudentsSortedByLastAssignment,
    getCompanionsSorted,
    assignStudent,
    getStudentName,
    getLastAssignmentDate,
  }
}
