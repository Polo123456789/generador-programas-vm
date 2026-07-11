import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = resolve(projectRoot, 'docs')
const metaDir = resolve(docsDir, '_nuxt/builds/meta')
const NUXT_DATA_PATTERN = /(<script type="application\/json" data-nuxt-data="[^"]+"[^>]*>)(.*?)(<\/script>)/g

function normalizeHtml(filePath: string): void {
  const original = readFileSync(filePath, 'utf8')
  const normalized = original.replace(
    NUXT_DATA_PATTERN,
    (_match, openingTag: string, rawPayload: string, closingTag: string) => {
      const payload = JSON.parse(rawPayload) as unknown[]
      const metadata = payload[0]
      if (typeof metadata === 'object' && metadata !== null && 'prerenderedAt' in metadata) {
        const pointer = (metadata as { prerenderedAt?: unknown }).prerenderedAt
        if (typeof pointer === 'number' && pointer > 0 && pointer < payload.length) payload[pointer] = 1
      }
      return `${openingTag}${JSON.stringify(payload)}${closingTag}`
    },
  )
  if (normalized !== original) writeFileSync(filePath, normalized)
}

function normalizeJsonTimestamp(filePath: string): void {
  const value = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
  value.timestamp = 1
  writeFileSync(filePath, JSON.stringify(value))
}

function walkHtml(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = resolve(directory, entry.name)
    if (entry.isDirectory()) walkHtml(filePath)
    else if (entry.name.endsWith('.html')) normalizeHtml(filePath)
  }
}

walkHtml(docsDir)
normalizeJsonTimestamp(resolve(docsDir, '_nuxt/builds/latest.json'))
for (const fileName of readdirSync(metaDir).filter(name => name.endsWith('.json'))) {
  normalizeJsonTimestamp(resolve(metaDir, fileName))
}
