import { ref, watch } from 'vue'
import { debugLog, debugError } from '~/utils/debug'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const storedValue = ref<T>(initialValue)

  debugLog('useLocalStorage', `Initializing "${key}"`)

  if (import.meta.client) {
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

    watch(storedValue, (newValue, oldValue) => {
      debugLog('useLocalStorage', `"${key}" WATCH triggered!`, { newValue, oldValue })
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue))
        debugLog('useLocalStorage', `"${key}" saved successfully`)
      } catch (e) {
        debugError('useLocalStorage', `Error saving "${key}":`, e)
      }
    }, { deep: true, immediate: false })
  } else {
    debugLog('useLocalStorage', `"${key}" SSR - localStorage not available`)
  }

  return storedValue
}
