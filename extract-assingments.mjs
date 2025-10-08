// @ts-check

import * as cheerio from 'cheerio'

/**
 * @typedef {Object} Week
 * @property {string} name
 * @property {string} url
 *
 * @typedef {Object} Assignment
 * @property {string} title
 * @property {number} duration
 *
 * @typedef {Object} AssignmentResult
 * @property {string} date
 * @property {number[]} songs
 * @property {string} assignedReading
 * @property {string} treasuresTitle
 * @property {Assignment[]} school
 * @property {Assignment[]} livingSpeeches
 */

const url = process.argv[2]
if (!url) {
    console.error('Usage: node index.mjs <url>')
    process.exit(1)
}

/**
 * @param {string | URL} url
 */
async function extractWeeks(url) {
    const res = await fetch(url)
    const html = await res.text()
    const $ = cheerio.load(html)

    /** @type {Week[]} */
    const weeks = []
    const $weeks = $("a.jwac")

    $weeks.each((_, el) => {
        const $el = $(el)
        const name = $el.text().trim()
        const href = $el.attr('href')
        if (href) {
            const fullUrl = new URL(href, url).href
            weeks.push({ name, url: fullUrl })
        }
    })

    // First link is always the cover page
    weeks.shift()

    return weeks
}

/**
 * @param {Week} week
 */
async function extractAssingments(week) {
    /** @type {AssignmentResult} */
    const result = {
        date: week.name,
        assignedReading: '',
        songs: [],
        treasuresTitle: '',
        school: [],
        livingSpeeches: [],
    }

    const res = await fetch(week.url)
    const html = await res.text()
    const $ = cheerio.load(html)

    result.date = $('h1').text().trim()
    result.assignedReading = $('h2').first().text().trim()

    result.songs = extractSongs($)

    // Treasures speech title
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
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0
        result.school.push({ title, duration })
    })

    const $livingSpeeches = $('h3.du-color--maroon-600')
    $livingSpeeches.each((_, el) => {
        const title = $(el).text().trim().replace(/^\d+\.\s*/, '')
        const description = $(el).next('div').text().trim()
        const durationMatch = description.match(/\((\d+)\s*mins?\.?\)/i)
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0
        result.livingSpeeches.push({ title, duration })
    })

    if (result.livingSpeeches.length) {
        result.livingSpeeches.pop()
    }

    return result
}

/**
 * @param {cheerio.CheerioAPI} $
 */
function extractSongs($) {
    const songElements = $('h3')
        .filter((_, el) => $(el).text().includes('Canción'))

    if (songElements.length != 3) {
        throw new Error(
            'Expected exactly 3 song elements, found ' + songElements.length
        )
    }

    const songNumbers = []
    songElements.each((_, el) => {
        const text = $(el).text()
        const match = text.match(/Canción (\d+)/)
        if (match) {
            songNumbers.push(parseInt(match[1]))
        }
    })

    return songNumbers
}

async function main() {
    const weeks = await extractWeeks(url)
    for (const week of weeks) {
        const assignments = await extractAssingments(week)
        console.log(assignments)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
