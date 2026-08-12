import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import { generateId } from './participants'

interface Week {
  name: string
  url: string
}

interface ScrapedAssignment {
  title: string
  duration: number
}

interface ScrapedAssignmentResult {
  date: string
  songs: number[]
  assignedReading: string
  treasuresTitle: string
  school: ScrapedAssignment[]
  livingSpeeches: ScrapedAssignment[]
}

export interface SingleAssignment {
  title: string
  duration: number
  participantId: string | null
}

export interface SchoolAssignment {
  title: string
  duration: number
  conductorId: string | null
  studentId?: string | null
}

export type SchoolStudentCount = 1 | 2

export interface ProgramWeek {
  date: string
  songs: number[]
  presidentId: string | null
  assignedReading: string
  treasures: SingleAssignment
  gems: SingleAssignment
  reading: SingleAssignment
  school: SchoolAssignment[]
  livingSpeeches: SingleAssignment[]
  bookConductorId: string | null
  bookReaderId: string | null
  finalPrayerId: string | null
}

export interface MeetingProgram {
  id: string
  createdAt: number
  calendarYear: number
  weeks: ProgramWeek[]
}

export function createMeetingProgram(weeks: ProgramWeek[], calendarYear: number): MeetingProgram {
  return {
    id: generateId(),
    createdAt: Date.now(),
    calendarYear,
    weeks,
  }
}

export async function fetchAssignments(url: string): Promise<ProgramWeek[]> {
  const weeks = await extractWeeks(url)
  const results: ProgramWeek[] = []

  for (const week of weeks) {
    const scraped = await extractAssignments(week)
    results.push({
      date: titleCase(scraped.date),
      songs: scraped.songs,
      presidentId: null,
      assignedReading: titleCase(scraped.assignedReading),
      treasures: {
        title: scraped.treasuresTitle,
        duration: 10,
        participantId: null,
      },
      gems: {
        title: 'Busquemos perlas escondidas',
        duration: 10,
        participantId: null,
      },
      reading: {
        title: 'Lectura',
        duration: 4,
        participantId: null,
      },
      school: scraped.school.map(assignment => ({
        title: assignment.title,
        duration: assignment.duration,
        conductorId: null,
        studentId: inferSchoolStudentCount(assignment.title) === 1 ? undefined : null,
      })),
      livingSpeeches: scraped.livingSpeeches.map(assignment => ({
        ...assignment,
        participantId: null,
      })),
      bookConductorId: null,
      bookReaderId: null,
      finalPrayerId: null,
    })
  }

  return results
}

export function inferSchoolStudentCount(title: string): SchoolStudentCount {
  return title.trim().toLocaleLowerCase('es') === 'discurso' ? 1 : 2
}

export function getSchoolStudentCount(assignment: SchoolAssignment): SchoolStudentCount {
  return assignment.studentId === undefined ? 1 : 2
}

export function setSchoolStudentCount(
  assignment: SchoolAssignment,
  studentCount: SchoolStudentCount,
): void {
  if (studentCount === 1) {
    delete assignment.studentId
    return
  }

  if (assignment.studentId === undefined) assignment.studentId = null
}

function titleCase(value: string): string {
  return value.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase(),
  )
}

async function getRequest(url: string): Promise<Response> {
  const proxyUrl = `https://corsproxy.io/?url=${url}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    throw new Error(`Failed to request ${url} via proxy: ${response.statusText}`)
  }
  return response
}

async function extractWeeks(url: string): Promise<Week[]> {
  const response = await getRequest(url)
  const html = await response.text()
  const $ = cheerio.load(html)
  const weeks: Week[] = []

  $('a.jwac').each((_, element) => {
    const link = $(element)
    const name = link.text().trim()
    if (name === 'Lectura bíblica para la Conmemoración del 2026') return

    const href = link.attr('href')
    if (href) weeks.push({ name, url: new URL(href, url).href })
  })

  weeks.shift()
  return weeks
}

async function extractAssignments(week: Week): Promise<ScrapedAssignmentResult> {
  const result: ScrapedAssignmentResult = {
    date: week.name,
    assignedReading: '',
    songs: [],
    treasuresTitle: '',
    school: [],
    livingSpeeches: [],
  }

  const response = await getRequest(week.url)
  const html = await response.text()
  const $ = cheerio.load(html)

  result.date = $('h1').text().trim()
  result.assignedReading = $('h2').first().text().trim()
  result.songs = extractSongs($)

  const speechTitle = $('h3.du-color--teal-700').first()
  if (speechTitle.length) {
    result.treasuresTitle = speechTitle.text().replace(/^\d+\.\s*/, '').trim()
  }

  $('h3.du-color--gold-700').each((_, element) => {
    result.school.push(extractTitledAssignment($, element))
  })

  $('h3.du-color--maroon-600').each((_, element) => {
    result.livingSpeeches.push(extractTitledAssignment($, element))
  })

  if (result.livingSpeeches.length) result.livingSpeeches.pop()
  return result
}

function extractTitledAssignment(
  $: cheerio.CheerioAPI,
  element: AnyNode,
): ScrapedAssignment {
  const title = $(element).text().trim().replace(/^\d+\.\s*/, '')
  const description = $(element).next('div').text().trim()
  const durationMatch = description.match(/\((\d+)\s*mins?\.?\)/i)

  return {
    title,
    duration: durationMatch?.[1] ? Number.parseInt(durationMatch[1]) : 0,
  }
}

function extractSongs($: cheerio.CheerioAPI): number[] {
  const songElements = $('h3').filter((_, element) => $(element).text().includes('Canción'))
  if (songElements.length !== 3) {
    throw new Error(`Expected exactly 3 song elements, found ${songElements.length}`)
  }

  const songs: number[] = []
  songElements.each((_, element) => {
    const match = $(element).text().match(/Canción (\d+)/)
    if (match?.[1]) songs.push(Number.parseInt(match[1]))
  })
  return songs
}
