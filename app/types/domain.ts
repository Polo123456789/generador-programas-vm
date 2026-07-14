export type Gender = 'M' | 'F'

export type AssignmentType = 'school' | 'reading'

export type CompanionMode = 'none' | 'sameGender' | 'freeform'

export interface Assignment {
  id: string
  title: string
  duration: number
  student: string
  studentId?: string
  assistant?: string
  assistantId?: string
  companionMode: CompanionMode
}

export interface ProgramWeek {
  id: string
  weekStart: string | null
  date: string
  songs: number[]
  president: string
  assignedReading: string
  treasures: Assignment
  gems: Assignment
  reading: Assignment
  school: Assignment[]
  livingSpeeches: Assignment[]
  book: Assignment
  finalPrayer: string
}

export interface Student {
  id: string
  name: string
  gender: Gender
  hidden: boolean
}

export interface AssignmentRecord {
  slotId: string
  studentId: string
  companionId?: string
  assignmentType: AssignmentType
  weekId: string
  weekDate: string
  weekStart: string | null
  updatedAt: number
}

export interface AppState {
  schemaVersion: 1
  sourceUrl: string
  weeks: ProgramWeek[]
  students: Student[]
  assignmentHistory: Record<string, AssignmentRecord>
}

export interface ProgramSnapshot {
  assignmentHistory: Record<string, AssignmentRecord>
  sourceUrl: string
  weeks: ProgramWeek[]
}
