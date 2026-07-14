import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const BUILD_INPUTS = [
  'app',
  'public',
  'bun.lock',
  'nuxt.config.ts',
  'package.json',
  'scripts/buildId.ts',
  'tsconfig.json',
]

function addPath(hash: ReturnType<typeof createHash>, rootDir: string, relativePath: string): void {
  const absolutePath = resolve(rootDir, relativePath)
  const stats = statSync(absolutePath)
  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolutePath).sort()) {
      addPath(hash, rootDir, `${relativePath}/${entry}`)
    }
    return
  }

  hash.update(relativePath)
  hash.update('\0')
  hash.update(readFileSync(absolutePath))
  hash.update('\0')
}

export function createBuildId(rootDir = process.cwd()): string {
  const hash = createHash('sha256')
  BUILD_INPUTS.forEach(relativePath => addPath(hash, rootDir, relativePath))
  return hash.digest('hex').slice(0, 20)
}
