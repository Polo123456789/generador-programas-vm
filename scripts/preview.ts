import { existsSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_PATH = '/generador-programas-vm'
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(projectRoot, 'docs')
const port = Number(process.env.PORT ?? 3000)

function fileResponse(pathname: string): Response {
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(pathname)
  }
  catch {
    return new Response('Invalid path encoding', { status: 400 })
  }
  if (decodedPath !== BASE_PATH && !decodedPath.startsWith(`${BASE_PATH}/`)) {
    return new Response('Not found', { status: 404 })
  }

  const requestedPath = resolve(publicDir, decodedPath.slice(BASE_PATH.length).replace(/^\//, ''))
  if (relative(publicDir, requestedPath).startsWith('..')) {
    return new Response('Invalid path', { status: 400 })
  }

  let filePath = requestedPath
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html')
  if (!existsSync(filePath) && !decodedPath.split('/').at(-1)?.includes('.')) {
    filePath = resolve(publicDir, 'index.html')
  }
  if (!existsSync(filePath)) return new Response('Not found', { status: 404 })
  return new Response(Bun.file(filePath))
}

const server = Bun.serve({
  port,
  fetch: (request) => {
    try {
      return fileResponse(new URL(request.url).pathname)
    }
    catch {
      return new Response('Invalid request URL', { status: 400 })
    }
  },
})

process.stdout.write(`Preview disponible en ${server.url.origin}${BASE_PATH}/\n`)
