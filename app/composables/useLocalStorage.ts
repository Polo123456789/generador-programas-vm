import { ref, watch } from 'vue'

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Estado reactivo para almacenar el valor
  const storedValue = ref<T>(initialValue)

  // Solo ejecutaremos el código del localStorage en el cliente
  if (process.client) {
    // Obtenemos el valor inicial del localStorage
    const item = window.localStorage.getItem(key)
    if (item) {
      try {
        storedValue.value = JSON.parse(item)
      } catch (e) {
        console.error(`Error al parsear el valor del localStorage para la clave "${key}"`, e)
      }
    }

    // Observamos cambios en el estado y los guardamos en localStorage
    watch(storedValue, (newValue) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue))
      } catch (e) {
        console.error(`Error al guardar el valor en el localStorage para la clave "${key}"`, e)
      }
    }, { deep: true }) // 'deep' es útil para observar cambios en objetos anidados
  }

  return storedValue
}
