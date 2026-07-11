import { describe, expect, test } from 'bun:test'
import type { AssignmentRecord } from '../app/types/domain'
import { getCompanionCandidates, getStudentCandidates } from '../app/utils/recommendations'
import { createStudent } from './helpers'

function record(
  slotId: string,
  studentId: string,
  weekStart: string,
  companionId?: string,
): AssignmentRecord {
  return {
    slotId,
    studentId,
    companionId,
    assignmentType: 'school',
    weekId: `week:${weekStart}`,
    weekDate: weekStart,
    weekStart,
    updatedAt: Date.parse(`${weekStart}T00:00:00Z`),
  }
}

describe('recommendations', () => {
  const students = [
    createStudent('ana', 'Ana', 'F'),
    createStudent('bea', 'Bea', 'F'),
    createStudent('carla', 'Carla', 'F'),
  ]

  test('ignores the current slot and future weeks', () => {
    const history = {
      current: record('current', 'ana', '2026-07-06'),
      past: record('past', 'bea', '2026-06-01'),
      future: record('future', 'carla', '2026-08-03'),
    }

    const candidates = getStudentCandidates(
      students,
      history,
      'school',
      'week:2026-07-06',
      '2026-07-06',
      'current',
    )

    expect(candidates.map(student => student.id)).toEqual(['ana', 'carla', 'bea'])
    expect(candidates.find(student => student.id === 'ana')?.lastAssignmentDate).toBeNull()
    expect(candidates.find(student => student.id === 'carla')?.lastAssignmentDate).toBeNull()
  })

  test('moves students already used in the same week to the end', () => {
    const history = { other: record('other', 'ana', '2026-07-06') }
    const candidates = getStudentCandidates(
      students,
      history,
      'school',
      'week:2026-07-06',
      '2026-07-06',
      'current',
    )

    expect(candidates.at(-1)?.id).toBe('ana')
    expect(candidates.at(-1)?.assignedThisWeek).toBeTrue()
  })

  test('prioritizes companion pairs that have never worked together', () => {
    const history = {
      pair: record('pair', 'ana', '2026-06-01', 'bea'),
    }
    const candidates = getCompanionCandidates(
      students,
      history,
      'ana',
      'school',
      'week:2026-07-06',
      '2026-07-06',
      'current',
    )

    expect(candidates[0]?.id).toBe('carla')
    expect(candidates[0]?.lastTimeTogether).toBeNull()
    expect(candidates[1]?.id).toBe('bea')
  })

  test('orders assignments chronologically across a year boundary', () => {
    const history = {
      december: record('december', 'ana', '2025-12-29'),
      january: record('january', 'bea', '2026-01-05'),
    }
    const candidates = getStudentCandidates(
      students,
      history,
      'school',
      'week:2026-01-12',
      '2026-01-12',
      'current',
    )

    expect(candidates.map(student => student.id)).toEqual(['carla', 'ana', 'bea'])
    expect(candidates.find(student => student.id === 'bea')?.lastAssignmentStart).toBe('2026-01-05')
  })

  test('keeps never-used students ahead of valid history without a normalized date', () => {
    const history = {
      unknownDate: {
        ...record('unknownDate', 'ana', '2026-06-01', 'bea'),
        weekDate: 'una semana anterior',
        weekStart: null,
      },
    }
    const companions = getCompanionCandidates(
      students,
      history,
      'ana',
      'school',
      'week:2026-07-06',
      '2026-07-06',
      'current',
    )

    expect(companions.map(student => student.id)).toEqual(['carla', 'bea'])
    expect(companions[1]?.lastTimeTogether).toBe('una semana anterior')
  })

  test('excludes hidden and different-gender companions', () => {
    const hidden = createStudent('diana', 'Diana', 'F')
    hidden.hidden = true
    const mixedStudents = [
      ...students,
      hidden,
      createStudent('carlos', 'Carlos', 'M'),
    ]

    const companions = getCompanionCandidates(
      mixedStudents,
      {},
      'ana',
      'school',
      'week:2026-07-06',
      '2026-07-06',
      'current',
    )

    expect(companions.map(student => student.id)).toEqual(['bea', 'carla'])
  })
})
