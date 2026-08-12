interface DatedWeek {
  date: string
}

interface ParsedWeekStart {
  day: number
  monthIndex: number
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const HALF_YEAR_MILLISECONDS = 183 * 24 * 60 * 60 * 1000

export function extractCalendarYear(value: string): number | null {
  const matches = value.match(/(?:19|20)\d{2}/g)
  if (!matches?.length) return null
  const year = Number(matches.at(-1))
  return Number.isInteger(year) ? year : null
}

export function resolveCalendarYear(
  storedYear: number | undefined,
  sourceUrl: string,
  createdAt: number,
): number {
  if (typeof storedYear === 'number' && Number.isInteger(storedYear)) return storedYear
  return extractCalendarYear(sourceUrl) ?? new Date(createdAt).getFullYear()
}

export function getWeekCalendarOrder(
  weeks: DatedWeek[],
  initialYear: number,
  targetIndex: number,
): number | null {
  if (!Number.isInteger(initialYear) || targetIndex < 0 || targetIndex >= weeks.length) return null

  let year = initialYear
  let previousOrder: number | null = null

  for (let index = 0; index <= targetIndex; index += 1) {
    const week = weeks[index]
    if (!week) return null
    const parsed = parseWeekStart(week.date)
    if (!parsed) return null

    let order = Date.UTC(year, parsed.monthIndex, parsed.day)
    if (previousOrder !== null && order < previousOrder - HALF_YEAR_MILLISECONDS) {
      year += 1
      order = Date.UTC(year, parsed.monthIndex, parsed.day)
    }
    previousOrder = order
  }

  return previousOrder
}

export function inferWeekCalendarOrder(weekDate: string, referenceTimestamp: number): number | null {
  const parsed = parseWeekStart(weekDate)
  if (!parsed || !Number.isFinite(referenceTimestamp)) return null

  const referenceYear = new Date(referenceTimestamp).getUTCFullYear()
  const candidates = [referenceYear - 1, referenceYear, referenceYear + 1]
    .map(year => Date.UTC(year, parsed.monthIndex, parsed.day))

  return candidates.reduce((closest, candidate) => (
    Math.abs(candidate - referenceTimestamp) < Math.abs(closest - referenceTimestamp)
      ? candidate
      : closest
  ))
}

export function parseWeekStart(value: string): ParsedWeekStart | null {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  const dayMatch = normalized.match(/\d+/)
  const monthMatch = normalized.match(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/)
  if (!dayMatch || !monthMatch) return null

  const monthIndex = MONTHS.indexOf(monthMatch[0] as typeof MONTHS[number])
  const day = Number(dayMatch[0])
  if (monthIndex < 0 || !Number.isInteger(day) || day < 1 || day > 31) return null
  return { day, monthIndex }
}
