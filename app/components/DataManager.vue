<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { exportAppState, parseImportedAppState } from '~/utils/appState'

const store = useAppStore()
const { flush, lastError, restoreBackup } = usePersistenceStatus()
const fileInput = ref<HTMLInputElement | null>(null)
const message = ref('')
const isError = ref(false)

function setMessage(value: string, error = false): void {
  message.value = value
  isError.value = error
}

function exportBackup(): void {
  const content = exportAppState(store.state.value)
  const blob = new Blob([content], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `programa-vm-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(objectUrl)
  setMessage('Respaldo exportado correctamente.')
}

function openImportPicker(): void {
  fileInput.value?.click()
}

async function importBackup(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    setMessage('El archivo supera el límite de 5 MB.', true)
    return
  }

  let contents: string
  try {
    contents = await file.text()
  }
  catch {
    setMessage('No se pudo leer el archivo seleccionado.', true)
    return
  }

  const parsed = parseImportedAppState(contents)
  if (!parsed.ok) {
    setMessage(parsed.error, true)
    return
  }
  if (!window.confirm('¿Importar este respaldo? El estado actual se conservará como respaldo anterior.')) return

  if (!flush()) {
    setMessage('No se pudo guardar el borrador actual; la importación fue cancelada para protegerlo.', true)
    return
  }

  store.replaceState(parsed.data)
  await nextTick()
  const persisted = flush()
  setMessage(
    persisted
      ? 'Respaldo importado y guardado correctamente.'
      : 'Respaldo importado en memoria, pero el navegador no permitió guardarlo.',
    !persisted,
  )
}

function restorePreviousBackup(): void {
  if (!window.confirm('¿Restaurar el respaldo anterior? El estado actual pasará a ser el respaldo disponible.')) return
  const restored = restoreBackup()
  setMessage(
    restored ? 'Se restauró el respaldo anterior.' : lastError.value ?? 'No hay un respaldo válido disponible.',
    !restored,
  )
}
</script>

<template>
  <section class="dont-print flex flex-wrap items-center gap-2" aria-label="Respaldos de datos">
    <button
      type="button"
      class="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800"
      @click="exportBackup"
    >
      Exportar respaldo
    </button>
    <button
      type="button"
      class="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800"
      @click="openImportPicker"
    >
      Importar respaldo
    </button>
    <button
      type="button"
      class="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800"
      @click="restorePreviousBackup"
    >
      Restaurar anterior
    </button>
    <input
      ref="fileInput"
      hidden
      type="file"
      accept="application/json,.json"
      @change="importBackup"
    >
    <p
      v-if="message"
      class="basis-full text-sm"
      :class="isError ? 'text-red-700' : 'text-green-700'"
      aria-live="polite"
    >
      {{ message }}
    </p>
  </section>
</template>
