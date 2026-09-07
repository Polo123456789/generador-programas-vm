import type { Ref } from 'vue'
import { effectScope, ref, watch } from 'vue'
import { debugError, debugLog } from '../utils/debug'

// Global storage for refs to ensure singleton pattern
const storageRefs = new Map<string, ReturnType<typeof ref>>()
const storageErrors = new Map<string, Ref<string | null>>()
const storageScope = effectScope(true)

export function useLocalStorageError(key: string): Ref<string | null> {
  let error = storageErrors.get(key)
  if (!error) {
    error = ref<string | null>(null)
    storageErrors.set(key, error)
  }
  return error
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const storageError = useLocalStorageError(key)
  debugLog('useLocalStorage', `Called for "${key}"`)

  // Return existing ref if already created (singleton pattern)
  if (storageRefs.has(key)) {
    const existingRef = storageRefs.get(key)
    debugLog('useLocalStorage', `"${key}" returning existing ref, current value length:`, (existingRef?.value as unknown[])?.length)
    return existingRef as ReturnType<typeof ref<T>>
  }

  // Create new ref
  const storedValue = ref<T>(initialValue)
  storageRefs.set(key, storedValue)

  debugLog('useLocalStorage', `"${key}" created new ref`)

  // Load from localStorage
  const item = window.localStorage.getItem(key)
  debugLog('useLocalStorage', `"${key}" localStorage value:`, item ? 'EXISTS' : 'NULL')

  if (item) {
    try {
      storedValue.value = JSON.parse(item)
      debugLog('useLocalStorage', `"${key}" loaded value:`, storedValue.value)
    } catch (e) {
      storageError.value = `No se pudieron leer los datos guardados de "${key}".`
      debugError('useLocalStorage', `Error parsing "${key}":`, e)
    }
  } else {
    debugLog('useLocalStorage', `"${key}" using initial value`)
  }

  // Set up watcher
  storageScope.run(() => {
    watch(storedValue, (newValue, oldValue) => {
      debugLog('useLocalStorage', `"${key}" WATCH triggered!`, { newValue, oldValue })
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue))
        storageError.value = null
        debugLog('useLocalStorage', `"${key}" saved successfully`)
      } catch (e) {
        storageError.value = `No se pudieron guardar los datos de "${key}". Descarga un respaldo antes de cerrar o recargar esta página.`
        debugError('useLocalStorage', `Error saving "${key}":`, e)
      }
    }, { deep: true, immediate: false, flush: 'sync' })
  })

  debugLog('useLocalStorage', `"${key}" watcher set up`)

  return storedValue
}
