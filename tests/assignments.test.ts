import { afterEach, describe, expect, test } from 'bun:test'
import { fetchAssignments } from '../app/utils/assignments'

const originalFetch = globalThis.fetch

const libraryHtml = `
  <a class="jwac" href="/es/wol/d/r4/lp-s/header">Publicación</a>
  <a class="jwac" href="/es/wol/d/r4/lp-s/week">7-13 de septiembre</a>
`

const weekHtml = `
  <h1>7-13 DE SEPTIEMBRE</h1>
  <h2>JEREMÍAS 32, 33</h2>
  <h3>Canción 1</h3>
  <h3 class="du-color--teal-700">1. Tema principal</h3>
  <h3 class="du-color--gold-700">4. Empiece conversaciones</h3><div>(3 mins.)</div>
  <h3 class="du-color--gold-700">5. Empiece conversaciones</h3><div>(4 mins.)</div>
  <h3>Canción&nbsp;128</h3>
  <h3 class="du-color--maroon-600">6. Necesidades locales</h3><div>(15 mins.)</div>
  <h3 class="du-color--maroon-600">7. Estudio bíblico</h3><div>(30 mins.)</div>
  <h3>Conclusión | Canción 143 y oración</h3>
`

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('external assignment adapter', () => {
  test('parses current song whitespace and creates stable duplicate-title ids', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const target = new URL(String(input)).searchParams.get('url') ?? ''
      return new Response(target.endsWith('/week') ? weekHtml : libraryHtml)
    }) as typeof fetch

    const weeks = await fetchAssignments('https://wol.jw.org/es/wol/library/guia-de-actividades-2026/septiembre')

    expect(weeks).toHaveLength(1)
    expect(weeks[0]?.songs).toEqual([1, 128, 143])
    expect(weeks[0]?.weekStart).toBe('2026-09-07')
    expect(weeks[0]?.school.map(assignment => assignment.duration)).toEqual([3, 4])
    expect(weeks[0]?.school.map(assignment => assignment.id)).toEqual([
      'week:2026-09-07:school:empiece-conversaciones-3-min',
      'week:2026-09-07:school:empiece-conversaciones-4-min',
    ])
    expect(weeks[0]?.livingSpeeches.map(assignment => assignment.title)).toEqual(['Necesidades locales'])
  })

  test('uses the publication month when a January week starts in December', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const target = new URL(String(input)).searchParams.get('url') ?? ''
      const januaryWeek = weekHtml.replace('7-13 DE SEPTIEMBRE', '29 DE DICIEMBRE A 4 DE ENERO')
      return new Response(target.endsWith('/week') ? januaryWeek : libraryHtml)
    }) as typeof fetch

    const weeks = await fetchAssignments('https://wol.jw.org/es/wol/library/guia-de-actividades-2026/enero')

    expect(weeks[0]?.weekStart).toBe('2025-12-29')
  })

  test('rejects a source page without recognizable week links', async () => {
    globalThis.fetch = (async () => new Response('<html><body>Sin semanas</body></html>')) as typeof fetch

    await expect(fetchAssignments('https://wol.jw.org/es/wol/library/example')).rejects.toThrow(
      'La página no contiene semanas reconocibles',
    )
  })
})
