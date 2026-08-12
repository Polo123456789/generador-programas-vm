import { expect, test } from 'bun:test'
import type { MeetingProgram } from '../app/utils/assignments'
import { BACKUP_VERSION, createBackup, parseBackup, summarizeBackup } from '../app/utils/backup'
import type { AssignmentHistoryRecord, Participant } from '../app/utils/participants'

const participants: Participant[] = [
  {
    id: 'ana',
    name: 'Ana López',
    gender: 'F',
    hidden: false,
    eligibleRoles: ['school'],
  },
  {
    id: 'beatriz',
    name: 'Beatriz Pérez',
    gender: 'F',
    hidden: false,
    eligibleRoles: ['school'],
  },
]

const program: MeetingProgram = {
  id: 'programa-1',
  createdAt: 1234,
  weeks: [{
    date: '7-13 de septiembre',
    songs: [1, 2, 3],
    presidentId: null,
    assignedReading: 'Proverbios 1',
    treasures: { title: 'Tesoros', duration: 10, participantId: null },
    gems: { title: 'Perlas', duration: 10, participantId: null },
    reading: { title: 'Lectura', duration: 4, participantId: null },
    school: [{ title: 'Primera conversación', duration: 3, conductorId: 'ana', studentId: 'beatriz' }],
    livingSpeeches: [],
    bookConductorId: null,
    bookReaderId: null,
    finalPrayerId: null,
  }],
}

const assignmentHistory: AssignmentHistoryRecord[] = [{
  id: 'programa-1:0:school:0',
  programId: 'programa-1',
  slotKey: '0:school:0',
  participantIds: ['ana', 'beatriz'],
  assignmentRole: 'school',
  assignmentTitle: 'Primera conversación',
  weekDate: '7-13 de septiembre',
  chronologicalOrder: 1234,
  updatedAt: 1234,
}]

test('backup round trip preserves all application data', () => {
  const backup = createBackup(program, participants, assignmentHistory, 'https://example.test/source')
  const restored = parseBackup(JSON.stringify(backup))

  expect(restored.version).toBe(BACKUP_VERSION)
  expect(restored.program).toEqual(program)
  expect(restored.participants).toEqual(participants)
  expect(restored.assignmentHistory).toEqual(assignmentHistory)
  expect(restored.sourceUrl).toBe('https://example.test/source')
  expect(summarizeBackup(restored)).toMatchObject({
    weeks: 1,
    participants: 2,
    historyRecords: 1,
    hasProgram: true,
  })
})

test('backup parser rejects malformed or unsupported files', () => {
  expect(() => parseBackup('{no-json')).toThrow('JSON válido')
  expect(() => parseBackup(JSON.stringify({ version: 99 }))).toThrow('Versión de respaldo no compatible')
})

test('backup parser rejects duplicate and unknown participant references', () => {
  const backup = createBackup(program, participants, assignmentHistory, '')
  backup.participants.push({ ...participants[0]! })
  expect(() => parseBackup(JSON.stringify(backup))).toThrow('ID de participante duplicado')

  const unknownReference = createBackup(program, participants, assignmentHistory, '')
  unknownReference.program!.weeks[0]!.school[0]!.studentId = 'persona-inexistente'
  expect(() => parseBackup(JSON.stringify(unknownReference))).toThrow('participante inexistente')

  const unknownHistoryReference = createBackup(null, participants, assignmentHistory, '')
  unknownHistoryReference.assignmentHistory[0]!.participantIds = ['persona-inexistente']
  expect(() => parseBackup(JSON.stringify(unknownHistoryReference))).toThrow('participante inexistente')
})
