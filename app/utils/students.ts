export interface Student {
  id: string
  name: string
  gender: 'M' | 'F'
  hidden: boolean
}

export interface AssignmentRecord {
  id: string
  studentId: string
  companionId?: string
  assignmentType: 'school' | 'reading'
  weekDate: string
  createdAt: number
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export function formatDate(dateString: string): string {
  return dateString
}
