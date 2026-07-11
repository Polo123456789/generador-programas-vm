<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Gender, Student } from '~/types/domain'

const {
  students,
  addStudent,
  getLastAssignmentDate,
  renameStudent,
  toggleStudentHidden,
} = useAppStore()

const newStudentName = ref('')
const newStudentGender = ref<Gender>('M')
const formError = ref('')
const actionError = ref('')
const statusMessage = ref('')
const editingStudentId = ref<string | null>(null)
const editingStudentName = ref('')
const editError = ref('')

const sortedStudents = computed<Student[]>(() => (
  [...students.value].sort((a, b) => a.name.localeCompare(b.name, 'es'))
))

function clearActionFeedback(): void {
  actionError.value = ''
  statusMessage.value = ''
}

function editInputId(studentId: string): string {
  return `student-name-${studentId}`
}

function editButtonId(studentId: string): string {
  return `edit-student-${studentId}`
}

function focusElement(id: string): void {
  if (!import.meta.client) return
  void nextTick(() => document.getElementById(id)?.focus())
}

function handleAddStudent(): void {
  formError.value = ''
  clearActionFeedback()

  const result = addStudent(newStudentName.value, newStudentGender.value)
  if (!result.ok) {
    formError.value = result.error
    return
  }

  statusMessage.value = `${result.value.name} fue añadido a la lista.`
  newStudentName.value = ''
  newStudentGender.value = 'M'
}

function startEditing(student: Student): void {
  clearActionFeedback()
  editError.value = ''
  editingStudentId.value = student.id
  editingStudentName.value = student.name
  focusElement(editInputId(student.id))
}

function cancelEditing(studentId: string): void {
  editError.value = ''
  editingStudentId.value = null
  editingStudentName.value = ''
  focusElement(editButtonId(studentId))
}

function handleRenameStudent(studentId: string): void {
  clearActionFeedback()
  editError.value = ''

  const result = renameStudent(studentId, editingStudentName.value)
  if (!result.ok) {
    editError.value = result.error
    return
  }

  editingStudentId.value = null
  editingStudentName.value = ''
  statusMessage.value = `El nombre se actualizó a ${result.value.name}.`
  focusElement(editButtonId(studentId))
}

function handleToggleStudent(student: Student): void {
  clearActionFeedback()

  const result = toggleStudentHidden(student.id)
  if (!result.ok) {
    actionError.value = result.error
    return
  }

  statusMessage.value = result.value.hidden
    ? `${result.value.name} fue ocultado de las listas de asignación.`
    : `${result.value.name} volvió a estar disponible para asignaciones.`
}

function getLastAssignmentDisplay(studentId: string): string {
  const lastReading = getLastAssignmentDate(studentId, 'reading')
  const lastSchool = getLastAssignmentDate(studentId, 'school')

  if (!lastReading && !lastSchool) return 'Nunca'

  return [
    lastReading ? `Lectura: ${lastReading}` : null,
    lastSchool ? `Escuela: ${lastSchool}` : null,
  ].filter(Boolean).join(', ')
}
</script>

<template>
  <main class="dont-print container mx-auto max-w-6xl p-4 sm:p-6">
    <header class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold">
        Gestión de estudiantes
      </h1>
      <NuxtLink
        to="/"
        class="inline-flex min-h-11 items-center justify-center rounded bg-gray-600 px-4 py-2 text-center text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700"
      >
        Volver al programa
      </NuxtLink>
    </header>

    <section aria-labelledby="add-student-heading" class="mb-6 rounded-lg bg-gray-50 p-4 sm:p-5">
      <h2 id="add-student-heading" class="mb-3 text-lg font-semibold">
        Añadir estudiante
      </h2>

      <form class="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]" @submit.prevent="handleAddStudent">
        <div>
          <label for="new-student-name" class="mb-1 block text-sm font-medium">Nombre</label>
          <input
            id="new-student-name"
            v-model="newStudentName"
            type="text"
            autocomplete="off"
            class="min-h-11 w-full rounded border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
            :class="{ 'border-red-600': formError }"
            placeholder="Nombre del estudiante"
            :aria-invalid="formError ? 'true' : undefined"
            :aria-describedby="formError ? 'add-student-error' : undefined"
          >
        </div>

        <div>
          <label for="new-student-gender" class="mb-1 block text-sm font-medium">Género</label>
          <select
            id="new-student-gender"
            v-model="newStudentGender"
            class="min-h-11 w-full rounded border bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
          >
            <option value="M">
              Masculino
            </option>
            <option value="F">
              Femenino
            </option>
          </select>
        </div>

        <AppButton type="submit" class="min-h-11 w-full sm:w-auto">
          Añadir
        </AppButton>
      </form>

      <p
        v-if="formError"
        id="add-student-error"
        class="mt-2 text-sm text-red-700"
        role="alert"
        aria-live="assertive"
      >
        {{ formError }}
      </p>
    </section>

    <p v-if="actionError" class="mb-4 text-sm text-red-700" role="alert" aria-live="assertive">
      {{ actionError }}
    </p>
    <p v-if="statusMessage" class="mb-4 text-sm text-green-800" role="status" aria-live="polite">
      {{ statusMessage }}
    </p>

    <section aria-labelledby="student-list-heading">
      <h2 id="student-list-heading" class="mb-3 text-lg font-semibold">
        Lista de estudiantes
      </h2>

      <p v-if="students.length === 0" class="py-8 text-center text-gray-600">
        No hay estudiantes registrados. Añade el primero con el formulario anterior.
      </p>

      <p v-if="students.length > 0" id="student-table-scroll-hint" class="mb-2 text-xs text-gray-600 sm:hidden">
        Desliza horizontalmente para ver el historial, estado y acciones.
      </p>

      <div
        v-if="students.length > 0"
        class="overflow-x-auto rounded-lg border"
        role="region"
        aria-label="Tabla de estudiantes"
        aria-describedby="student-table-scroll-hint"
        tabindex="0"
      >
        <table class="w-full min-w-3xl border-collapse">
          <caption class="sr-only">
            Estudiantes registrados, su última asignación, estado y acciones disponibles
          </caption>
          <thead>
            <tr class="bg-gray-100">
              <th scope="col" class="border-b px-4 py-3 text-left">
                Nombre
              </th>
              <th scope="col" class="border-b px-4 py-3 text-center">
                Género
              </th>
              <th scope="col" class="border-b px-4 py-3 text-left">
                Última asignación
              </th>
              <th scope="col" class="border-b px-4 py-3 text-center">
                Estado
              </th>
              <th scope="col" class="border-b px-4 py-3 text-center">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="student in sortedStudents"
              :key="student.id"
              :class="{ 'bg-gray-50': student.hidden }"
            >
              <th
                scope="row"
                class="border-b px-4 py-3 text-left font-normal"
                :class="{ 'text-gray-500': student.hidden }"
              >
                <form
                  v-if="editingStudentId === student.id"
                  class="min-w-56"
                  @submit.prevent="handleRenameStudent(student.id)"
                >
                  <label :for="editInputId(student.id)" class="sr-only">
                    Nuevo nombre de {{ student.name }}
                  </label>
                  <input
                    :id="editInputId(student.id)"
                    v-model="editingStudentName"
                    type="text"
                    autocomplete="off"
                    class="min-h-10 w-full rounded border px-2 py-1 text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
                    :class="{ 'border-red-600': editError }"
                    :aria-invalid="editError ? 'true' : undefined"
                    :aria-describedby="editError ? `edit-student-error-${student.id}` : undefined"
                  >
                  <p
                    v-if="editError"
                    :id="`edit-student-error-${student.id}`"
                    class="mt-1 text-sm text-red-700"
                    role="alert"
                    aria-live="assertive"
                  >
                    {{ editError }}
                  </p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <AppButton type="submit" class="min-h-10 px-3 py-1 text-sm">
                      Guardar
                    </AppButton>
                    <AppButton
                      type="button"
                      class="min-h-10 bg-gray-600 px-3 py-1 text-sm hover:bg-gray-700"
                      @click="cancelEditing(student.id)"
                    >
                      Cancelar
                    </AppButton>
                  </div>
                </form>
                <span v-else>{{ student.name }}</span>
              </th>
              <td class="border-b px-4 py-3 text-center">
                <span
                  class="rounded px-2 py-1 text-xs"
                  :class="student.gender === 'M' ? 'bg-blue-100 text-blue-900' : 'bg-pink-100 text-pink-900'"
                >
                  {{ student.gender === 'M' ? 'Masculino' : 'Femenino' }}
                </span>
              </td>
              <td class="border-b px-4 py-3 text-sm" :class="{ 'text-gray-500': student.hidden }">
                {{ getLastAssignmentDisplay(student.id) }}
              </td>
              <td class="border-b px-4 py-3 text-center">
                <span
                  class="rounded px-2 py-1 text-xs"
                  :class="student.hidden ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'"
                >
                  {{ student.hidden ? 'Oculto' : 'Activo' }}
                </span>
              </td>
              <td class="border-b px-4 py-3">
                <div class="flex min-w-max flex-wrap justify-center gap-2">
                  <AppButton
                    :id="editButtonId(student.id)"
                    type="button"
                    class="min-h-10 bg-gray-600 px-3 py-1 text-sm hover:bg-gray-700"
                    :disabled="editingStudentId === student.id"
                    :aria-label="`Editar el nombre de ${student.name}`"
                    @click="startEditing(student)"
                  >
                    Editar
                  </AppButton>
                  <AppButton
                    type="button"
                    class="min-h-10 px-3 py-1 text-sm"
                    :class="student.hidden ? 'bg-green-700 hover:bg-green-800' : 'bg-red-700 hover:bg-red-800'"
                    :aria-label="`${student.hidden ? 'Mostrar' : 'Ocultar'} a ${student.name} en las listas de asignación`"
                    @click="handleToggleStudent(student)"
                  >
                    {{ student.hidden ? 'Mostrar' : 'Ocultar' }}
                  </AppButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="mt-6 text-sm text-gray-600">
      <strong>Nota:</strong> Los estudiantes ocultos no aparecen en las listas de selección para asignaciones.
    </p>
  </main>
</template>
