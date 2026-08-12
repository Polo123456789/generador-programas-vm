import { describe, expect, test } from 'bun:test'
import type { SchoolAssignment } from '../app/utils/assignments'
import {
  getSchoolStudentCount,
  inferSchoolStudentCount,
  setSchoolStudentCount,
} from '../app/utils/assignments'

describe('school assignment student count', () => {
  test('uses the automatic title detection as the initial value', () => {
    expect(inferSchoolStudentCount('Discurso')).toBe(1)
    expect(inferSchoolStudentCount('Primera conversación')).toBe(2)
  })

  test('can override a two-student assignment without changing its primary student', () => {
    const assignment: SchoolAssignment = {
      title: 'Demostración especial',
      duration: 5,
      conductorId: 'principal',
      studentId: 'acompanante',
    }

    setSchoolStudentCount(assignment, 1)

    expect(getSchoolStudentCount(assignment)).toBe(1)
    expect(assignment.conductorId).toBe('principal')
    expect('studentId' in assignment).toBe(false)
  })

  test('can override a one-student assignment and creates an empty companion slot', () => {
    const assignment: SchoolAssignment = {
      title: 'Discurso basado en contenido',
      duration: 5,
      conductorId: 'principal',
    }

    setSchoolStudentCount(assignment, 2)

    expect(getSchoolStudentCount(assignment)).toBe(2)
    expect(assignment.studentId).toBeNull()
    expect(assignment.conductorId).toBe('principal')
  })
})
