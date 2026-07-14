import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = '/generador-programas-vm/'
const ASSET_PATTERN = /\b(?:href|src)="([^"]+)"/g

function walkHtml(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return walkHtml(path)
    return entry.name.endsWith('.html') ? [path] : []
  })
}

export function verifyGeneratedSite(rootDir = process.cwd()): void {
  const docsDir = resolve(rootDir, 'docs')
  const indexPath = resolve(docsDir, 'index.html')
  const failures: string[] = []
  let indexHtml = ''

  if (!existsSync(resolve(docsDir, '.nojekyll'))) failures.push('Falta docs/.nojekyll.')
  if (!existsSync(indexPath)) failures.push('Falta docs/index.html.')
  else {
    indexHtml = readFileSync(indexPath, 'utf8')
    if (!/<html[^>]*\blang="es"/.test(indexHtml)) failures.push('docs/index.html no declara lang="es".')
    if (!indexHtml.includes('<title>Generador de Programas VM</title>')) {
      failures.push('docs/index.html no incluye el título esperado.')
    }
    if (!indexHtml.includes('name="description"')) {
      failures.push('docs/index.html no incluye la descripción estática.')
    }
  }

  if (existsSync(docsDir)) {
    let nuxtAssetCount = 0
    for (const htmlPath of walkHtml(docsDir)) {
      const html = readFileSync(htmlPath, 'utf8')
      for (const match of html.matchAll(ASSET_PATTERN)) {
        const url = match[1]!
        if (!url.includes('/_nuxt/')) continue
        nuxtAssetCount += 1
        if (!url.startsWith(`${BASE_URL}_nuxt/`)) {
          failures.push(`${htmlPath} usa un asset de Nuxt fuera de la ruta base: ${url}`)
          continue
        }
        let relativePath: string
        try {
          relativePath = decodeURIComponent(url.slice(BASE_URL.length).split(/[?#]/, 1)[0]!)
        }
        catch {
          failures.push(`${htmlPath} contiene una URL de asset inválida: ${url}`)
          continue
        }
        if (!existsSync(resolve(docsDir, relativePath))) {
          failures.push(`${htmlPath} referencia un asset inexistente: ${url}`)
        }
      }
    }
    if (nuxtAssetCount === 0) failures.push('Los HTML generados no referencian assets de Nuxt.')
  }

  const latestPath = resolve(docsDir, '_nuxt/builds/latest.json')
  if (!existsSync(latestPath)) failures.push('Falta el manifiesto _nuxt/builds/latest.json.')
  else {
    const latest = JSON.parse(readFileSync(latestPath, 'utf8')) as { id?: unknown }
    if (typeof latest.id !== 'string' || !latest.id) failures.push('latest.json no contiene un build ID válido.')
    else {
      const metaPath = resolve(docsDir, `_nuxt/builds/meta/${latest.id}.json`)
      if (!existsSync(metaPath)) failures.push(`Falta la metadata del build ${latest.id}.`)
      else {
        const metadata = JSON.parse(readFileSync(metaPath, 'utf8')) as { id?: unknown }
        if (metadata.id !== latest.id) failures.push('El build ID de latest.json no coincide con su metadata.')
      }
      if (!indexHtml.includes(`buildId:"${latest.id}"`)) {
        failures.push('docs/index.html no coincide con el build ID publicado.')
      }
    }
  }

  if (failures.length > 0) throw new Error(failures.join('\n'))
}

if (import.meta.main) verifyGeneratedSite()
