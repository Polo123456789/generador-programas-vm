import { ref, watch } from 'vue'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const storedValue = ref<T>(initialValue)
  
  console.log(`[useLocalStorage:${key}] Inicializando...`)

  if (import.meta.client) {
    const item = window.localStorage.getItem(key)
    console.log(`[useLocalStorage:${key}] Valor en localStorage:`, item ? 'EXISTS' : 'NULL')
    
    if (item) {
      try {
        storedValue.value = JSON.parse(item)
        console.log(`[useLocalStorage:${key}] Valor cargado:`, storedValue.value)
      } catch (e) {
        console.error(`[useLocalStorage:${key}] Error parseando:`, e)
      }
    } else {
      console.log(`[useLocalStorage:${key}] Usando valor inicial`)
    }

    watch(storedValue, (newValue) => {
      console.log(`[useLocalStorage:${key}] WATCH triggered!`, newValue)
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue))
        console.log(`[useLocalStorage:${key}] Guardado exitoso`)
      } catch (e) {
        console.error(`[useLocalStorage:${key}] Error guardando:`, e)
      }
    }, { deep: true })
  } else {
    console.log(`[useLocalStorage:${key}] SSR - no se accede a localStorage`)
  }

  return storedValue
}
