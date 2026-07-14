<script setup lang="ts">
const {
  status,
  lastError,
  warning,
  acceptExternalChanges,
  dismissWarning,
  keepLocalChanges,
} = usePersistenceStatus()
</script>

<template>
  <aside
    v-if="status === 'conflict'"
    class="dont-print border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    role="alert"
  >
    <div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Otra pestaña guardó cambios. Elige qué versión deseas conservar antes de continuar.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded bg-amber-700 px-3 py-1.5 font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          @click="acceptExternalChanges"
        >
          Usar la otra versión
        </button>
        <button
          type="button"
          class="rounded border border-amber-700 px-3 py-1.5 font-medium hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          @click="keepLocalChanges"
        >
          Conservar mis cambios
        </button>
      </div>
    </div>
  </aside>

  <aside
    v-else-if="lastError"
    class="dont-print border-b border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
    role="alert"
  >
    <div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <strong>No se pudo guardar en el navegador.</strong>
        Tus cambios siguen disponibles en esta pestaña. {{ lastError }}
      </p>
      <button
        type="button"
        class="self-start rounded border border-red-700 px-3 py-1.5 font-medium hover:bg-red-100 sm:self-auto"
        @click="keepLocalChanges"
      >
        Reintentar guardado
      </button>
    </div>
  </aside>

  <aside
    v-else-if="warning"
    class="dont-print border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
    role="status"
  >
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-3">
      <p>{{ warning }}</p>
      <button
        type="button"
        class="rounded px-2 py-1 font-medium hover:bg-blue-100"
        aria-label="Cerrar aviso"
        @click="dismissWarning"
      >
        Cerrar
      </button>
    </div>
  </aside>
</template>
