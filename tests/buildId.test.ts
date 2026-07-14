import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBuildId } from '../scripts/buildId'

const temporaryDirectories: string[] = []

function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'vm-build-id-'))
  temporaryDirectories.push(root)
  mkdirSync(join(root, 'app'))
  mkdirSync(join(root, 'public'))
  mkdirSync(join(root, 'scripts'))
  writeFileSync(join(root, 'app/app.vue'), '<template>Programa</template>')
  writeFileSync(join(root, 'public/.nojekyll'), '')
  writeFileSync(join(root, 'bun.lock'), 'lock')
  writeFileSync(join(root, 'nuxt.config.ts'), 'config')
  writeFileSync(join(root, 'package.json'), '{}')
  writeFileSync(join(root, 'scripts/buildId.ts'), 'builder')
  writeFileSync(join(root, 'tsconfig.json'), '{}')
  return root
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(directory, { force: true, recursive: true }))
})

describe('deterministic build id', () => {
  test('is stable for identical inputs and changes with maintained source', () => {
    const root = createFixture()
    const first = createBuildId(root)

    expect(createBuildId(root)).toBe(first)
    expect(first).toMatch(/^[a-f0-9]{20}$/)

    writeFileSync(join(root, 'app/app.vue'), '<template>Programa actualizado</template>')
    expect(createBuildId(root)).not.toBe(first)
  })
})
