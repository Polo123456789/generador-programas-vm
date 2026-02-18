import { ref, watch } from 'vue'
import { debugLog, debugError } from '~/utils/debug'

// Global storage for refs to ensure singleton pattern
const storageRefs = new Map<string, ReturnType<typeof ref>>()

export function useLocalStorage<T>(key: string, initialValue: T) {
  debugLog('useLocalStorage', `Called for "${key}"`)

  // Return existing ref if already created (singleton pattern)
  if (storageRefs.has(key)) {
    debugLog('useLocalStorage', `"${key}" returning existing ref`)
    return storageRefs.get(key) as ReturnType<typeof ref<T>>
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
      debugError('useLocalStorage', `Error parsing "${key}":`, e)
    }
  } else {
    debugLog('useLocalStorage', `"${key}" using initial value`)
  }

  // Set up watcher
  watch(storedValue, (newValue, oldValue) => {
    debugLog('useLocalStorage', `"${key}" WATCH triggered!`, { newValue, oldValue })
    try {
      window.localStorage.setItem(key, JSON.stringify(newValue))
      debugLog('useLocalStorage', `"${key}" saved successfully`)
    } catch (e) {
      debugError('useLocalStorage', `Error saving "${key}":`, e)
    }
  }, { deep: true, immediate: false })

  debugLog('useLocalStorage', `"${key}" watcher set up`)

  return storedValue
}
