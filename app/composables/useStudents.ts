import { ref, type Ref } from 'vue'
import type { Student, AssignmentRecord } from '~/utils/students'
import { generateId } from '~/utils/students'

const STUDENTS_KEY = 'students'
const ASSIGNMENT_HISTORY_KEY = 'assignmentHistory'

// Mapeo de meses en español a números
const MONTHS_ES: Record<string, number> = {
  'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
  'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
}

// Parsear fecha del formato "2-8 De Marzo" a timestamp
function parseWeekDate(dateStr: string): number {
  // Ejemplo: "2-8 De Marzo" -> extraer "2" y "Marzo"
  const match = dateStr.toLowerCase().match(/(\d+)-\d+\s+de\s+(\w+)/)
  if (!match || !match[1] || !match[2]) return 0
  
  const day = parseInt(match[1])
  const monthName = match[2].toLowerCase()
  const month = MONTHS_ES[monthName]
  
  if (month === undefined) return 0
  
  // Usar el año actual (asumiendo que las asignaciones son del año actual)
  const year = new Date().getFullYear()
  return new Date(year, month, day).getTime()
}

// Variables para el estado global (lazy initialization)
let globalStudents: Ref<Student[]> | null = null
let globalAssignmentHistory: Ref<AssignmentRecord[]> | null = null

function initializeGlobalState() {
  if (!globalStudents) {
    globalStudents = useLocalStorage<Student[]>(STUDENTS_KEY, [])
  }
  if (!globalAssignmentHistory) {
    globalAssignmentHistory = useLocalStorage<AssignmentRecord[]>(ASSIGNMENT_HISTORY_KEY, [])
  }
}

export function useStudents() {
  // Inicializar estado global en la primera llamada
  initializeGlobalState()
  
  const students = globalStudents!
  const assignmentHistory = globalAssignmentHistory!

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
    // Buscar cuando el estudiante es el principal O el acompañante
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
        // Students with no assignments come first
        if (!a.lastAssignmentDate && !b.lastAssignmentDate) return 0
        if (!a.lastAssignmentDate) return -1
        if (!b.lastAssignmentDate) return 1
        
        // Parse dates and sort chronologically (oldest first)
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
        // Primary sort: by lastTimeTogether (never together first, then oldest)
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

        // If tied on lastTimeTogether, secondary sort by lastAssignmentDate
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
    console.log('[assignStudent] Iniciando asignación:', record)
    console.log('[assignStudent] Estado antes:', assignmentHistory.value.length, 'registros')
    
    const fullRecord: AssignmentRecord = {
      ...record,
      id: generateId(),
      createdAt: Date.now(),
    }
    
    console.log('[assignStudent] Registro completo:', fullRecord)
    
    // Crear nuevo array para forzar reactividad
    assignmentHistory.value = [...assignmentHistory.value, fullRecord]
    
    console.log('[assignStudent] Estado después:', assignmentHistory.value.length, 'registros')
    console.log('[assignStudent] assignmentHistory ref:', assignmentHistory)
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
