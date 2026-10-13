const allowedHosts = new Set(['wol.jw.org', 'www.jw.org'])

function validateUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)
    || url.username || url.password || (url.port && url.port !== '443')) {
    throw createError({ statusCode: 400, statusMessage: 'URL not allowed' })
  }
  return url
}

export default defineEventHandler(async (event): Promise<string> => {
  const query = getQuery(event)
  if (typeof query.url !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'URL required' })
  }
  let url = validateUrl(query.url)
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) break
      url = validateUrl(new URL(location, url).href)
      continue
    }
    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: 'Upstream request failed' })
    }
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return await response.text()
  }
  throw createError({ statusCode: 502, statusMessage: 'Too many upstream redirects' })
})
