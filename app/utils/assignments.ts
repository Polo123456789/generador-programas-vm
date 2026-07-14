import * as cheerio from 'cheerio'
import type { Assignment, ProgramWeek } from '~/types/domain'
import {
  createAssignmentId,
  createSectionAssignmentIds,
  createWeekId,
  inferWeekStart,
} from '~/utils/appState'

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

export interface FetchAssignmentsOptions {
  onProgress?: (completed: number, total: number) => void
  signal?: AbortSignal
}

const SOURCE_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
}

function sourceReferenceDate(url: URL): Date {
  const normalizedPath = decodeURIComponent(url.pathname)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const sourceYear = normalizedPath.match(/-(20\d{2})(?:\/|$)/)?.[1]
  const sourceMonthName = normalizedPath.split('/').filter(Boolean).at(-1) ?? ''
  const sourceMonth = SOURCE_MONTHS[sourceMonthName] ?? 6
  return sourceYear
    ? new Date(Date.UTC(Number(sourceYear), sourceMonth, 15))
    : new Date()
}

function emptyAssignment(
  id: string,
  title: string,
  duration: number,
  companionMode: Assignment['companionMode'],
): Assignment {
  return {
    id,
    title,
    duration,
    student: '',
    assistant: companionMode === 'none' ? undefined : '',
    companionMode,
  }
}

export async function fetchAssignments(
  sourceUrl: string,
  options: FetchAssignmentsOptions = {},
): Promise<ProgramWeek[]> {
  const parsedUrl = new URL(sourceUrl)
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('La dirección debe comenzar con http:// o https://.')
  }

  const weeks = await extractWeeks(parsedUrl.href, options.signal)
  if (weeks.length === 0) {
    throw new Error('La página no contiene semanas reconocibles. El programa actual no fue modificado.')
  }

  const results: ProgramWeek[] = []
  const referenceDate = sourceReferenceDate(parsedUrl)
  options.onProgress?.(0, weeks.length)

  for (const [index, week] of weeks.entries()) {
    const scraped = await extractAssignments(week, options.signal)
    const date = titleCase(scraped.date)
    const weekStart = inferWeekStart(date, referenceDate)
    const weekId = createWeekId(date, weekStart)
    const schoolIds = createSectionAssignmentIds(
      weekId,
      'school',
      scraped.school,
    )
    const livingIds = createSectionAssignmentIds(
      weekId,
      'living',
      scraped.livingSpeeches,
    )
    const programWeek: ProgramWeek = {
      id: weekId,
      weekStart,
      date,
      songs: scraped.songs,
      president: '',
      assignedReading: titleCase(scraped.assignedReading),
      treasures: emptyAssignment(
        createAssignmentId(weekId, 'treasures'),
        scraped.treasuresTitle,
        10,
        'none',
      ),
      gems: emptyAssignment(createAssignmentId(weekId, 'gems'), '', 10, 'none'),
      reading: emptyAssignment(createAssignmentId(weekId, 'reading'), '', 4, 'none'),
      school: scraped.school.map((assignment, assignmentIndex) => emptyAssignment(
        schoolIds[assignmentIndex]!,
        assignment.title,
        assignment.duration,
        assignment.title === 'Discurso' ? 'none' : 'sameGender',
      )),
      livingSpeeches: scraped.livingSpeeches.map((assignment, assignmentIndex) => emptyAssignment(
        livingIds[assignmentIndex]!,
        assignment.title,
        assignment.duration,
        'none',
      )),
      book: emptyAssignment(createAssignmentId(weekId, 'book'), 'Libro', 30, 'freeform'),
      finalPrayer: '',
    }
    results.push(programWeek)
    options.onProgress?.(index + 1, weeks.length)
  }

  return results
}

function titleCase(value: string): string {
  return value.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
  )
}

async function getRequest(url: string, signal?: AbortSignal): Promise<Response> {
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  const response = await fetch(proxyUrl, { signal })
  if (!response.ok) {
    throw new Error(`El proxy respondió ${response.status} al solicitar ${url}.`)
  }
  return response
}

async function extractWeeks(url: string, signal?: AbortSignal): Promise<Week[]> {
  const response = await getRequest(url, signal)
  const html = await response.text()
  const $ = cheerio.load(html)

  const weeks: Week[] = []
  const weekLinks = $('a.jwac')
  weekLinks.each((_, element) => {
    const link = $(element)
    const name = link.text().trim()
    if (name.includes('Lectura bíblica para la Conmemoración')) return

    const href = link.attr('href')
    if (href) weeks.push({ name, url: new URL(href, url).href })
  })

  weeks.shift()
  return weeks
}

async function extractAssignments(week: Week, signal?: AbortSignal): Promise<ScrapedAssignmentResult> {
  const result: ScrapedAssignmentResult = {
    date: week.name,
    assignedReading: '',
    songs: [],
    treasuresTitle: '',
    school: [],
    livingSpeeches: [],
  }

  const response = await getRequest(week.url, signal)
  const html = await response.text()
  const $ = cheerio.load(html)

  result.date = $('h1').text().trim()
  result.assignedReading = $('h2').first().text().trim()
  result.songs = extractSongs($)

  const speechTitle = $('h3.du-color--teal-700').first()
  if (speechTitle.length) {
    result.treasuresTitle = speechTitle.text().replace(/^\d+\.\s*/, '').trim()
  }

  const schoolAssignments = $('h3.du-color--gold-700')
  schoolAssignments.each((_, element) => {
    const title = $(element).text().trim().replace(/^\d+\.\s*/, '')
    const description = $(element).next('div').text().trim()
    const durationMatch = description.match(/\((\d+)\s*mins?\.?\)/i)
    result.school.push({
      title,
      duration: durationMatch?.[1] ? Number.parseInt(durationMatch[1]) : 0,
    })
  })

  const livingSpeeches = $('h3.du-color--maroon-600')
  livingSpeeches.each((_, element) => {
    const title = $(element).text().trim().replace(/^\d+\.\s*/, '')
    const description = $(element).next('div').text().trim()
    const durationMatch = description.match(/\((\d+)\s*mins?\.?\)/i)
    result.livingSpeeches.push({
      title,
      duration: durationMatch?.[1] ? Number.parseInt(durationMatch[1]) : 0,
    })
  })

  if (result.livingSpeeches.length) result.livingSpeeches.pop()
  return result
}

function extractSongs($: cheerio.CheerioAPI): number[] {
  const songElements = $('h3').filter((_, element) => $(element).text().includes('Canción'))
  if (songElements.length !== 3) {
    throw new Error(`Se esperaban 3 canciones y se encontraron ${songElements.length}.`)
  }

  const songNumbers: number[] = []
  songElements.each((_, element) => {
    const match = $(element).text().match(/Canción\s+(\d+)/u)
    if (match?.[1]) songNumbers.push(Number.parseInt(match[1]))
  })
  if (songNumbers.length !== 3) throw new Error('No se pudieron leer los números de las canciones.')
  return songNumbers
}
