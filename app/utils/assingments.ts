import * as cheerio from 'cheerio'

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

export interface Assignment {
    title: string
    duration: number
    student: string
    assistant?: string
}

export interface Assingments {
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

export async function fetchAssingments(url: string): Promise<Assingments[]> {
    const weeks = await extractWeeks(url)
    const results: Assingments[] = []

    for (const week of weeks) {
        const scraped = await extractAssingments(week)
        const assingment: Assingments = {
            date: titleCase(scraped.date),
            songs: scraped.songs,
            president: '',
            assignedReading: titleCase(scraped.assignedReading),
            treasures: {
                title: scraped.treasuresTitle,
                duration: 10,
                student: '',
            },
            gems: {
                title: '',
                duration: 10,
                student: '',
            },
            reading: {
                title: '',
                duration: 4,
                student: '',
            },
            school: scraped.school.map(s => ({
                title: s.title,
                duration: s.duration,
                student: '',
                assistant: s.title === 'Discurso' ? undefined : '',
            })),
            livingSpeeches: scraped.livingSpeeches.map(s => ({
                title: s.title,
                duration: s.duration,
                student: '',
            })),
            book: {
                title: 'Libro',
                duration: 30,
                student: '',
                assistant: '',
            },
            finalPrayer: '',

        }
        results.push(assingment)
    }
    return results
}

function titleCase(str: string): string {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
}

async function getRequest(url: string) {
    const proxyUrl = `https://corsproxy.io/?url=${(url)}`
    const res = await fetch(proxyUrl)
    if (!res.ok) {
        throw new Error(`Failed to getRequest ${url} via proxy: ${res.statusText}`)
    }
    return res
}


async function extractWeeks(url: string): Promise<Week[]> {
    const res = await getRequest(url)
    const html = await res.text()
    const $ = cheerio.load(html)

    const weeks: Week[] = []
    const $weeks = $("a.jwac")

    $weeks.each((_, el) => {
        const $el = $(el)
        const name = $el.text().trim()
        if (name === "Lectura bíblica para la Conmemoración del 2026") {
            return
        }
        const href = $el.attr('href')
        if (href) {
            const fullUrl = new URL(href, url).href
            weeks.push({ name, url: fullUrl })
        }
    })

    weeks.shift()

    return weeks
}

async function extractAssingments(week: Week) {
    const result: ScrapedAssignmentResult = {
        date: week.name,
        assignedReading: '',
        songs: [],
        treasuresTitle: '',
        school: [],
        livingSpeeches: [],
    }

    const res = await getRequest(week.url)
    const html = await res.text()
    const $ = cheerio.load(html)

    result.date = $('h1').text().trim()
    result.assignedReading = $('h2').first().text().trim()

    result.songs = extractSongs($)

    const $speechTitle = $('h3.du-color--teal-700').first()
    if ($speechTitle.length) {
        result.treasuresTitle = $speechTitle
            .text().replace(/^\d+\.\s*/, '').trim()
    }

    const $schoolAssignments = $('h3.du-color--gold-700')
    $schoolAssignments.each((_, el) => {
        const title = $(el).text().trim().replace(/^\d+\.\s*/, '')
        const description = $(el).next('div').text().trim()
        const durationMatch = description.match(/\((\d+)\s*mins?\.?\)/i)
        let duration = 0
        if (durationMatch && durationMatch[1]) {
            duration = parseInt(durationMatch[1])
        }
        result.school.push({ title, duration })
    })

    const $livingSpeeches = $('h3.du-color--maroon-600')
    $livingSpeeches.each((_, el) => {
        const title = $(el).text().trim().replace(/^\d+\.\s*/, '')
        const description = $(el).next('div').text().trim()
        const durationMatch = description.match(/\((\d+)\s*mins?\.?\)/i)
        let duration = 0
        if (durationMatch && durationMatch[1]) {
            duration = parseInt(durationMatch[1])
        }
        result.livingSpeeches.push({ title, duration })
    })

    if (result.livingSpeeches.length) {
        result.livingSpeeches.pop()
    }

    return result
}

function extractSongs($: cheerio.CheerioAPI): number[] {
    const songElements = $('h3')
        .filter((_, el) => $(el).text().includes('Canción'))

    if (songElements.length != 3) {
        throw new Error(
            'Expected exactly 3 song elements, found ' + songElements.length
        )
    }

    const songNumbers: number[] = []
    songElements.each((_, el) => {
        const text = $(el).text()
        const match = text.match(/Canción (\d+)/)
        if (match && match[1]) {
            songNumbers.push(parseInt(match[1]))
        }
    })

    return songNumbers
}
