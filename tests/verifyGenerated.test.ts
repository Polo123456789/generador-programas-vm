import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyGeneratedSite } from '../scripts/verifyGenerated'

const temporaryDirectories: string[] = []

function createGeneratedFixture(assetUrl = '/generador-programas-vm/_nuxt/app.js'): string {
  const root = mkdtempSync(join(tmpdir(), 'vm-generated-'))
  temporaryDirectories.push(root)
  const docs = join(root, 'docs')
  mkdirSync(join(docs, '_nuxt/builds/meta'), { recursive: true })
  writeFileSync(join(docs, '.nojekyll'), '')
  writeFileSync(join(docs, '_nuxt/app.js'), '')
  writeFileSync(join(docs, '_nuxt/builds/latest.json'), JSON.stringify({ id: 'build-id', timestamp: 1 }))
  writeFileSync(join(docs, '_nuxt/builds/meta/build-id.json'), JSON.stringify({ id: 'build-id', timestamp: 1 }))
  writeFileSync(join(docs, 'index.html'), `
    <html lang="es"><head>
      <title>Generador de Programas VM</title>
      <meta name="description" content="Programa">
      <script src="${assetUrl}"></script>
    </head><body><script>buildId:"build-id"</script></body></html>
  `)
  return root
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(directory, { force: true, recursive: true }))
})

describe('generated-site verifier', () => {
  test('accepts a consistent base URL, asset tree and build metadata', () => {
    expect(() => verifyGeneratedSite(createGeneratedFixture())).not.toThrow()
  })

  test('rejects Nuxt assets that escape the GitHub Pages base URL', () => {
    expect(() => verifyGeneratedSite(createGeneratedFixture('/_nuxt/missing.js'))).toThrow(
      'fuera de la ruta base',
    )
  })
})
