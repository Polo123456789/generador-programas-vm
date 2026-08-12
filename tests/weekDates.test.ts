import { expect, test } from 'bun:test'
import { extractCalendarYear, getWeekCalendarOrder, resolveCalendarYear } from '../app/utils/weekDates'

test('extracts the publication year from a meeting workbook URL', () => {
  expect(extractCalendarYear('https://example.test/guia-de-actividades-2026/septiembre')).toBe(2026)
  expect(extractCalendarYear('https://example.test/septiembre')).toBeNull()
})

test('restores an old local program year from its saved source URL', () => {
  expect(resolveCalendarYear(
    undefined,
    'https://example.test/guia-de-actividades-2025/diciembre',
    Date.UTC(2026, 0, 2),
  )).toBe(2025)
})

test('keeps program weeks in their publication year across a new year', () => {
  const weeks = [
    { date: '28 De Diciembre A 3 De Enero' },
    { date: '4-10 De Enero' },
  ]

  expect(getWeekCalendarOrder(weeks, 2026, 0)).toBe(Date.UTC(2026, 11, 28))
  expect(getWeekCalendarOrder(weeks, 2026, 1)).toBe(Date.UTC(2027, 0, 4))
})
