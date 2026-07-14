<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Assignment } from '~/types/domain'
import { mergeProgramWeeks } from '~/utils/appState'
import { fetchAssignments } from '~/utils/assignments'

const store = useAppStore()
const { sourceUrl: url, weeks: assignments, canUndoProgramChange } = store
const { status: saveStatus, lastSavedAt, lastError: lastSaveError } = usePersistenceStatus()
const loadingAssignments = ref(false)
const assignmentsError = ref('')
const assignmentsNotice = ref('')
const loadProgress = ref({ completed: 0, total: 0 })
let activeRequest: AbortController | null = null
let requestTimedOut = false

const saveStatusText = computed(() => {
  if (lastSaveError.value) return 'Los cambios están disponibles, pero no pudieron guardarse.'
  if (saveStatus.value === 'saving') return 'Guardando borrador…'
  if (lastSavedAt.value) {
    return `Guardado ${new Date(lastSavedAt.value).toLocaleString('es')}`
  }
  return 'Los cambios se guardan automáticamente en este navegador.'
})

async function fetchAllAssignments(): Promise<void> {
  const requestedUrl = url.value.trim()
  if (!requestedUrl) {
    assignmentsError.value = 'Escribe el enlace del programa que deseas importar.'
    return
  }

  loadingAssignments.value = true
  assignmentsError.value = ''
  assignmentsNotice.value = ''
  loadProgress.value = { completed: 0, total: 0 }
  activeRequest = new AbortController()
  requestTimedOut = false
  const timeout = window.setTimeout(() => {
    requestTimedOut = true
    activeRequest?.abort()
  }, 90_000)

  try {
    const incoming = await fetchAssignments(requestedUrl, {
      signal: activeRequest.signal,
      onProgress: (completed, total) => {
        loadProgress.value = { completed, total }
      },
    })
    const merged = mergeProgramWeeks(assignments.value, incoming)
    const fieldsAtRisk = Math.max(0, merged.previousFields - merged.preservedFields)
    if (fieldsAtRisk > 0) {
      const confirmed = window.confirm(
        `Este enlace reemplazará ${fieldsAtRisk} campo${fieldsAtRisk === 1 ? '' : 's'} completado${fieldsAtRisk === 1 ? '' : 's'} que no coincide${fieldsAtRisk === 1 ? '' : 'n'} con el nuevo programa. ¿Continuar?`,
      )
      if (!confirmed) {
        assignmentsNotice.value = 'Importación cancelada; el programa actual no cambió.'
        return
      }
    }

    const result = store.replaceProgram(requestedUrl, merged.weeks)
    if (!result.ok) throw new Error(result.error)
    assignmentsNotice.value = merged.preservedFields > 0
      ? `Programa actualizado; se conservaron ${merged.preservedFields} campos completados.`
      : `Programa cargado con ${incoming.length} semanas.`
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      assignmentsError.value = requestTimedOut
        ? 'La importación tardó más de 90 segundos. El programa actual no fue modificado.'
        : 'Importación cancelada. El programa actual no fue modificado.'
    }
    else {
      assignmentsError.value = error instanceof Error
        ? error.message
        : 'No se pudo cargar el programa. Revisa el enlace e intenta de nuevo.'
    }
  }
  finally {
    window.clearTimeout(timeout)
    activeRequest = null
    loadingAssignments.value = false
  }
}

function cancelImport(): void {
  activeRequest?.abort()
}

function clearProgram(): void {
  if (assignments.value.length === 0) return
  if (!window.confirm('¿Borrar el programa visible? Los estudiantes y el historial se conservarán.')) return
  store.clearProgram()
  assignmentsError.value = ''
  assignmentsNotice.value = 'Programa borrado. Puedes deshacer esta acción.'
}

function undoProgramChange(): void {
  const result = store.undoProgramChange()
  assignmentsNotice.value = result.ok ? 'Se restauró el programa anterior.' : result.error
}

function editAssignmentParticipant(
  assignment: Assignment,
  role: 'assistant' | 'student',
  value: string,
): void {
  store.editSlotParticipant(assignment.id, role, value)
}

function printProgram(): void {
  window.print()
}

onBeforeUnmount(() => activeRequest?.abort())
</script>

<template>
    <main class="container">
        <nav class="dont-print flex flex-col gap-3 bg-gray-800 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-xl font-bold">Generador de Programas</h1>
                <p class="text-sm text-gray-300">Borrador local y asignación de estudiantes</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <button
                    type="button"
                    class="rounded border border-gray-500 px-4 py-2 hover:bg-gray-700"
                    :disabled="assignments.length === 0"
                    @click="printProgram"
                >
                    Imprimir
                </button>
                <NuxtLink to="/students" class="rounded bg-amber-700 px-4 py-2 text-white transition-colors hover:bg-amber-800">
                    Gestionar estudiantes
                </NuxtLink>
            </div>
        </nav>

        <section class="dont-print screen-panel m-4 space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <form class="space-y-2" aria-describedby="source-help" @submit.prevent="fetchAllAssignments">
                <label for="program-url" class="block text-sm font-semibold text-gray-800">
                    Enlace del programa
                </label>
                <div class="flex flex-col gap-2 sm:flex-row">
                    <input
                        id="program-url"
                        v-model="url"
                        type="url"
                        inputmode="url"
                        autocomplete="url"
                        class="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="https://www.jw.org/..."
                        :disabled="loadingAssignments"
                    >
                    <button
                        v-if="!loadingAssignments"
                        type="submit"
                        class="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cargar programa
                    </button>
                    <button
                        v-else
                        type="button"
                        class="rounded border border-gray-400 px-4 py-2 font-medium hover:bg-gray-100"
                        @click="cancelImport"
                    >
                        Cancelar carga
                    </button>
                    <button
                        type="button"
                        class="rounded border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="loadingAssignments || assignments.length === 0"
                        @click="clearProgram"
                    >
                        Borrar programa
                    </button>
                    <button
                        v-if="canUndoProgramChange"
                        type="button"
                        class="rounded border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
                        @click="undoProgramChange"
                    >
                        Deshacer
                    </button>
                </div>
                <p id="source-help" class="text-xs text-gray-500">
                    La importación usa un proxy público. Tus estudiantes y asignaciones locales no se envían al proxy.
                </p>
            </form>

            <div v-if="loadingAssignments" class="space-y-1" role="status" aria-live="polite">
                <div class="flex justify-between text-sm text-gray-700">
                    <span>Importando programa…</span>
                    <span v-if="loadProgress.total">{{ loadProgress.completed }}/{{ loadProgress.total }} semanas</span>
                </div>
                <progress
                    class="h-2 w-full accent-amber-600"
                    :max="loadProgress.total || 1"
                    :value="loadProgress.completed"
                />
            </div>

            <p v-if="assignmentsError" class="text-sm text-red-700" role="alert">
                {{ assignmentsError }}
            </p>
            <p v-if="assignmentsNotice" class="text-sm text-green-700" aria-live="polite">
                {{ assignmentsNotice }}
            </p>

            <div class="flex flex-col gap-3 border-t border-gray-100 pt-3 lg:flex-row lg:items-start lg:justify-between">
                <DataManager />
                <p class="text-sm" :class="lastSaveError ? 'text-red-700' : 'text-gray-600'" aria-live="polite">
                    {{ saveStatusText }}
                </p>
            </div>
        </section>

        <section
            v-if="assignments.length === 0 && !loadingAssignments"
            class="dont-print mx-4 my-10 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-600"
        >
            <h2 class="text-lg font-semibold text-gray-800">Todavía no hay un programa cargado</h2>
            <p class="mt-2">Pega el enlace arriba o importa un respaldo para continuar.</p>
        </section>

        <div
            v-for="week in assignments"
            :key="week.id"
            class="program-scroll dont-break mb-8"
            role="region"
            :aria-label="`Programa de la semana ${week.date}`"
            tabindex="0"
        >
            <p class="scroll-hint dont-print px-2 text-xs text-gray-600">
                Desliza horizontalmente para ver y editar todas las columnas.
            </p>
            <table class="program-table w-full border-collapse pt-4" :aria-label="`Programa de la semana ${week.date}`">
                <tbody>
                    <!--
                    Introducción
                -->
                    <tr>
                        <td class="font-bold text-lg" colspan="2">{{ week.date }} | {{ week.assignedReading }}
                        </td>
                        <td class="text-right pr-2">Presidente:</td>
                        <td>
                            <PrintableInput v-model="week.president" :aria-label="`Presidente de la semana ${week.date}`" />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="4">● Canción {{ week.songs[0] }} y oración</td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="4">● Palabras de introducción (1 min.)</td>
                    </tr>

                    <!--
                    Primera Reunion
                -->
                    <tr>
                        <td class="bg-gray-700 text-white font-bold p-1" colspan="1">TESOROS DE LA BIBLIA</td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="2">● {{ week.treasures.title }} ({{ week.treasures.duration }}
                            mins.)</td>
                        <td colspan="2">
                            <PrintableInput
                                :model-value="week.treasures.student"
                                :aria-label="`Asignado a Tesoros de la Biblia, semana ${week.date}`"
                                @update:model-value="value => editAssignmentParticipant(week.treasures, 'student', value ?? '')"
                            />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="2">● Busquemos perlas escondidas (10 mins.)</td>
                        <td colspan="2">
                            <PrintableInput
                                :model-value="week.gems.student"
                                :aria-label="`Asignado a Busquemos perlas escondidas, semana ${week.date}`"
                                @update:model-value="value => editAssignmentParticipant(week.gems, 'student', value ?? '')"
                            />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1">● Lectura de la Biblia</td>
                        <td class="text-right pr-2">Estudiante:</td>
                        <td colspan="2">
                            <StudentAssigner
                                :model-value="week.reading"
                                :week-id="week.id"
                                :week-date="week.date"
                                :week-start="week.weekStart"
                                type="reading"
                            />
                        </td>
                    </tr>

                    <!--
                    Segunda Reunion
                -->
                    <tr>
                        <td class="school-section-heading bg-amber-600 text-white font-bold p-1 mt-2" colspan="1">SEAMOS MEJORES MAESTROS</td>
                    </tr>
                    <tr v-for="a in week.school" :key="a.id">
                        <td class="py-1 align-middle">● {{ a.title }} ({{ a.duration }} mins.)</td>
                        <template v-if="a.companionMode === 'sameGender'">
                            <td class="text-right pr-2 align-middle whitespace-nowrap">
                                Estudiante:
                            </td>
                            <td class="align-middle">
                                <PrintableInput
                                    :model-value="a.student"
                                    :aria-label="`Estudiante para ${a.title}, semana ${week.date}`"
                                    @update:model-value="value => editAssignmentParticipant(a, 'student', value ?? '')"
                                />
                            </td>
                            <td class="align-middle">
                                <div class="flex gap-2 items-center">
                                    <PrintableInput
                                        :model-value="a.assistant"
                                        class="flex-1"
                                        :aria-label="`Ayudante para ${a.title}, semana ${week.date}`"
                                        @update:model-value="value => editAssignmentParticipant(a, 'assistant', value ?? '')"
                                    />
                                    <StudentAssigner
                                        :model-value="a"
                                        :week-id="week.id"
                                        :week-date="week.date"
                                        :week-start="week.weekStart"
                                        type="school"
                                        button-only
                                    />
                                </div>
                            </td>
                        </template>
                        <template v-else>
                            <td class="text-right pr-2 align-middle whitespace-nowrap">
                                Estudiante:
                            </td>
                            <td colspan="2" class="align-middle">
                                <StudentAssigner
                                    :model-value="a"
                                    :week-id="week.id"
                                    :week-date="week.date"
                                    :week-start="week.weekStart"
                                    type="school"
                                />
                            </td>
                        </template>
                    </tr>

                    <!--
                    Tercera Reunion
                -->
                    <tr>
                        <td class="bg-red-800 text-white font-bold p-1 mt-2" colspan="1">NUESTRA VIDA CRISTIANA</td>
                    </tr>
                    <tr>
                        <td class="py-1" colspan="4">● Canción {{ week.songs[1] }}</td>
                    </tr>
                    <tr v-for="a in week.livingSpeeches" :key="a.id">
                        <td class="py-1" colspan="2">● {{ a.title }} ({{ a.duration }} mins.)</td>
                        <td colspan="2">
                            <PrintableInput
                                :model-value="a.student"
                                :aria-label="`Asignado a ${a.title}, semana ${week.date}`"
                                @update:model-value="value => editAssignmentParticipant(a, 'student', value ?? '')"
                            />
                        </td>
                    </tr>
                    <tr>
                        <td class="py-1">● Estudio bíblico de la congregación (30 mins.)</td>
                        <td class="text-right pr-2">Conductor/Lector:</td>
                        <td>
                            <PrintableInput
                                :model-value="week.book.student"
                                :aria-label="`Conductor del estudio bíblico, semana ${week.date}`"
                                @update:model-value="value => editAssignmentParticipant(week.book, 'student', value ?? '')"
                            />/
                        </td>
                        <td>
                            <PrintableInput
                                :model-value="week.book.assistant"
                                :aria-label="`Lector del estudio bíblico, semana ${week.date}`"
                                @update:model-value="value => editAssignmentParticipant(week.book, 'assistant', value ?? '')"
                            />
                        </td>
                    </tr>

                    <!--
                    Conclusión
                -->
                    <tr>
                        <td class="py-1" colspan="4">● Palabras de conclusión (3 mins.)</td>
                    </tr>
                    <tr>
                        <td class="py-1">● Canción {{ week.songs[2] }}</td>
                        <td class="text-right pr-2">Oración:</td>
                        <td colspan="2">
                            <PrintableInput v-model="week.finalPrayer" :aria-label="`Oración final, semana ${week.date}`" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div
            v-if="assignments.length > 0"
            class="program-scroll dont-break mb-8"
            role="region"
            aria-label="Resumen de asignaciones de la escuela"
            tabindex="0"
        >
            <p class="scroll-hint dont-print px-2 text-xs text-gray-600">
                Desliza horizontalmente para ver todo el resumen.
            </p>
            <table class="w-full border-collapse" aria-label="Resumen de asignaciones de la escuela">
                <thead>
                    <tr>
                        <th colspan="3" class="text-lg bg-amber-700 text-white font-bold p-1 mt-2 border border-black">
                            Seamos Mejores Maestros
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="week in assignments" :key="week.id">
                        <tr>
                            <td colspan="3" class="school-week-heading font-bold text-white bg-amber-600 p-1 mt-2 border border-black">
                                {{ week.date }}
                            </td>
                        </tr>
                        <tr>
                            <td class="border px-2">
                                Lectura
                            </td>
                            <td colspan="2" class="border text-center">
                                {{ week.reading.student }}
                            </td>
                        </tr>
                        <tr v-for="a in week.school" :key="`summary-${a.id}`">
                            <td class="border px-2">
                                {{ a.title }} ({{ a.duration }} mins.)
                            </td>
                            <template v-if="a.companionMode === 'sameGender'">
                                <td class="border text-center">
                                    {{a.student}}
                                </td>
                                <td class="border text-center">
                                    {{a.assistant}}
                                </td>
                            </template>
                            <template v-else>
                                <td colspan="2" class="border text-center">
                                    {{a.student}}
                                </td>
                            </template>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
    </main>
</template>
