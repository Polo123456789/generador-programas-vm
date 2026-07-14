import type { AppState, Assignment, ProgramWeek, Student } from '../app/types/domain'
import { createAssignmentId, createSectionAssignmentIds, createWeekId } from '../app/utils/appState'

export function createStudent(id: string, name: string, gender: 'M' | 'F' = 'M'): Student {
  return { id, name, gender, hidden: false }
}

export function createAssignment(
  id: string,
  title = '',
  companionMode: Assignment['companionMode'] = 'none',
): Assignment {
  return {
    id,
    title,
    duration: 5,
    student: '',
    assistant: companionMode === 'none' ? undefined : '',
    companionMode,
  }
}

export function createWeek(weekStart = '2026-07-06', date = '6-12 De Julio'): ProgramWeek {
  const id = createWeekId(date, weekStart)
  const [schoolId] = createSectionAssignmentIds(id, 'school', [{ title: 'Empiece conversaciones', duration: 5 }])
  const [livingId] = createSectionAssignmentIds(id, 'living', [{ title: 'Necesidades locales', duration: 5 }])
  return {
    id,
    weekStart,
    date,
    songs: [1, 2, 3],
    president: '',
    assignedReading: 'PROVERBIOS 1',
    treasures: createAssignment(createAssignmentId(id, 'treasures'), 'Tesoros'),
    gems: createAssignment(createAssignmentId(id, 'gems'), 'Perlas'),
    reading: createAssignment(createAssignmentId(id, 'reading'), 'Lectura'),
    school: [createAssignment(schoolId!, 'Empiece conversaciones', 'sameGender')],
    livingSpeeches: [createAssignment(livingId!, 'Necesidades locales')],
    book: createAssignment(createAssignmentId(id, 'book'), 'Libro', 'freeform'),
    finalPrayer: '',
  }
}

export function createState(): AppState {
  return {
    schemaVersion: 1,
    sourceUrl: 'https://example.com/programa',
    weeks: [createWeek()],
    students: [
      createStudent('ana', 'Ana', 'F'),
      createStudent('bea', 'Bea', 'F'),
      createStudent('carlos', 'Carlos'),
    ],
    assignmentHistory: {},
  }
}
