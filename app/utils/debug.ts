const DEBUG_KEY = '__debug_enabled__'

function isDebugEnabled(): boolean {
  if (!import.meta.client) return false
  return window.localStorage.getItem(DEBUG_KEY) === 'true'
}

export function enableDebug(): void {
  if (import.meta.client) {
    window.localStorage.setItem(DEBUG_KEY, 'true')
    console.log('[Debug] Logging enabled')
  }
}

export function disableDebug(): void {
  if (import.meta.client) {
    window.localStorage.setItem(DEBUG_KEY, 'false')
    console.log('[Debug] Logging disabled')
  }
}

export function debugLog(context: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(`[${context}]`, ...args)
  }
}

export function debugError(context: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.error(`[${context}]`, ...args)
  }
}
