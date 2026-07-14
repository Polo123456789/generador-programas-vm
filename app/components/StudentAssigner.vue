<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { Assignment, AssignmentType } from '~/types/domain'

type ModalState = 'closed' | 'student' | 'companion'

interface Props {
  modelValue: Assignment
  weekId: string
  weekDate: string
  weekStart: string | null
  type: AssignmentType
  buttonOnly?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Assignment]
}>()

const {
  assignSlot,
  editSlotParticipant,
  getCompanionsSorted,
  getStudentName,
  getStudentsSortedByLastAssignment,
} = useAppStore()

const modalState = ref<ModalState>('closed')
const selectedStudentId = ref<string | null>(null)
const actionError = ref('')
const dialog = ref<HTMLElement | null>(null)
const previouslyFocused = ref<HTMLElement | null>(null)
const dialogTitleId = useId()
const dialogDescriptionId = useId()

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const companionRequired = computed(() => props.modelValue.companionMode === 'sameGender')

const studentsList = computed(() => {
  const candidates = getStudentsSortedByLastAssignment(
    props.type,
    props.weekId,
    props.weekStart,
    props.modelValue.id,
  )

  return props.type === 'reading'
    ? candidates.filter(student => student.gender === 'M')
    : candidates
})

const studentGroups = computed(() => {
  if (props.type === 'reading') {
    return [{
      id: 'male-reading',
      label: 'Varones',
      headingClass: 'text-blue-700 border-blue-200',
      emptyMessage: 'No hay estudiantes varones activos.',
      students: studentsList.value,
    }]
  }

  return [
    {
      id: 'male-school',
      label: 'Masculinos',
      headingClass: 'text-blue-700 border-blue-200',
      emptyMessage: 'No hay estudiantes masculinos.',
      students: studentsList.value.filter(student => student.gender === 'M'),
    },
    {
      id: 'female-school',
      label: 'Femeninos',
      headingClass: 'text-pink-700 border-pink-200',
      emptyMessage: 'No hay estudiantes femeninos.',
      students: studentsList.value.filter(student => student.gender === 'F'),
    },
  ]
})

const companionsList = computed(() => {
  if (!selectedStudentId.value) return []
  return getCompanionsSorted(
    selectedStudentId.value,
    props.type,
    props.weekId,
    props.weekStart,
    props.modelValue.id,
  )
})

const selectedStudentName = computed(() => (
  selectedStudentId.value ? getStudentName(selectedStudentId.value) : ''
))

const studentValue = computed({
  get: () => props.modelValue.student,
  set: (value: string) => {
    const result = editSlotParticipant(props.modelValue.id, 'student', value)
    if (result.ok) {
      actionError.value = ''
      emit('update:modelValue', result.value)
    }
    else {
      actionError.value = result.error
    }
  },
})

function openStudentModal(): void {
  actionError.value = ''
  selectedStudentId.value = null
  if (import.meta.client && document.activeElement instanceof HTMLElement) {
    previouslyFocused.value = document.activeElement
  }
  modalState.value = 'student'
}

function closeModal(): void {
  modalState.value = 'closed'
  selectedStudentId.value = null
  actionError.value = ''
}

function assignSelection(studentId: string, companionId?: string): void {
  const result = assignSlot(props.modelValue.id, studentId, companionId)
  if (!result.ok) {
    actionError.value = result.error
    return
  }

  emit('update:modelValue', result.value)
  closeModal()
}

function selectStudent(studentId: string): void {
  actionError.value = ''
  selectedStudentId.value = studentId

  if (companionRequired.value) {
    modalState.value = 'companion'
    return
  }

  assignSelection(studentId)
}

function selectCompanion(companionId: string): void {
  if (!selectedStudentId.value) return
  assignSelection(selectedStudentId.value, companionId)
}

function goBackToStudents(): void {
  actionError.value = ''
  modalState.value = 'student'
}

function formatLastAssignment(date: string | null): string {
  return date ? `Última asignación: ${date}` : 'Sin asignaciones anteriores'
}

function formatLastTogether(date: string | null): string {
  return date ? `Última vez juntos: ${date}` : 'Nunca han trabajado juntos'
}

function focusInitialControl(): void {
  if (!import.meta.client) return
  const firstControl = dialog.value?.querySelector<HTMLElement>(focusableSelector)
  if (firstControl) firstControl.focus()
  else dialog.value?.focus()
}

function restoreFocus(): void {
  if (!import.meta.client) return
  const target = previouslyFocused.value
  previouslyFocused.value = null
  if (target?.isConnected) target.focus()
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeModal()
    return
  }

  if (event.key !== 'Tab' || !dialog.value) return
  const controls = [...dialog.value.querySelectorAll<HTMLElement>(focusableSelector)]
  if (controls.length === 0) {
    event.preventDefault()
    dialog.value.focus()
    return
  }

  const activeIndex = controls.indexOf(document.activeElement as HTMLElement)
  if (event.shiftKey && activeIndex <= 0) {
    event.preventDefault()
    controls.at(-1)?.focus()
  }
  else if (!event.shiftKey && (activeIndex === -1 || activeIndex === controls.length - 1)) {
    event.preventDefault()
    controls[0]?.focus()
  }
}

watch(modalState, async (state) => {
  await nextTick()
  if (state === 'closed') restoreFocus()
  else focusInitialControl()
})
</script>

<template>
  <div v-if="buttonOnly" class="flex items-center gap-2">
    <button
      type="button"
      class="dont-print whitespace-nowrap rounded bg-amber-700 px-3 py-1 text-sm text-white hover:bg-amber-800"
      :aria-label="`Asignar estudiante para ${modelValue.title || 'la asignación'}`"
      @click="openStudentModal"
    >
      Asignar
    </button>
  </div>
  <div v-else class="flex items-center justify-between gap-2">
    <PrintableInput
      v-model="studentValue"
      class="flex-1"
      :aria-label="`Estudiante para ${modelValue.title || 'la asignación'}`"
    />
    <button
      type="button"
      class="dont-print whitespace-nowrap rounded bg-amber-700 px-3 py-1 text-sm text-white hover:bg-amber-800"
      :aria-label="`Asignar estudiante para ${modelValue.title || 'la asignación'}`"
      @click="openStudentModal"
    >
      Asignar
    </button>
  </div>

  <p
    v-if="actionError && modalState === 'closed'"
    class="dont-print mt-1 text-xs text-red-700"
    role="alert"
  >
    {{ actionError }}
  </p>

  <Teleport to="body">
    <div
      v-if="modalState !== 'closed'"
      class="dont-print fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeModal"
    >
      <section
        ref="dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="dialogTitleId"
        :aria-describedby="dialogDescriptionId"
        class="mx-4 max-h-[80vh] w-full overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6"
        :class="modalState === 'student' ? 'max-w-4xl' : 'max-w-md'"
        tabindex="-1"
        @keydown="handleDialogKeydown"
      >
        <template v-if="modalState === 'student'">
          <h3 :id="dialogTitleId" class="text-lg font-bold">
            Seleccionar estudiante - {{ type === 'reading' ? 'Lectura' : 'Escuela' }}
          </h3>
          <p :id="dialogDescriptionId" class="mb-4 text-sm text-gray-600">
            Semana: {{ weekDate }}
          </p>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" :class="{ 'sm:grid-cols-1 sm:max-w-md sm:mx-auto': type === 'reading' }">
            <section v-for="group in studentGroups" :key="group.id">
              <h4 class="mb-2 border-b pb-1 font-semibold" :class="group.headingClass">
                {{ group.label }}
              </h4>
              <p v-if="group.students.length === 0" class="py-4 text-center text-sm text-gray-500">
                {{ group.emptyMessage }} Añade estudiantes en la página de gestión.
              </p>
              <div v-else class="space-y-2">
                <button
                  v-for="(student, index) in group.students"
                  :key="student.id"
                  type="button"
                  class="w-full rounded border p-3 text-left transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                  :class="{ 'border-amber-500 bg-amber-100': index === 0 }"
                  @click="selectStudent(student.id)"
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class="font-medium">{{ student.name }}</span>
                    <span
                      class="rounded px-2 py-1 text-xs"
                      :class="student.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'"
                    >
                      {{ student.gender }}
                    </span>
                  </span>
                  <span class="mt-1 block text-sm text-gray-600">
                    {{ formatLastAssignment(student.lastAssignmentDate) }}
                  </span>
                  <span v-if="student.assignedThisWeek" class="mt-1 block text-xs font-medium text-orange-700">
                    Ya tiene una asignación esta semana
                  </span>
                  <span v-else-if="index === 0" class="mt-1 block text-xs font-medium text-amber-700">
                    Recomendación del sistema
                  </span>
                </button>
              </div>
            </section>
          </div>
        </template>

        <template v-else>
          <h3 :id="dialogTitleId" class="text-lg font-bold">
            Seleccionar compañero para {{ selectedStudentName }}
          </h3>
          <p :id="dialogDescriptionId" class="mb-4 text-sm text-gray-600">
            Semana: {{ weekDate }}
          </p>

          <p v-if="companionsList.length === 0" class="py-4 text-center text-gray-500">
            No hay compañeros disponibles del mismo género.
          </p>
          <div v-else class="space-y-2">
            <button
              v-for="(companion, index) in companionsList"
              :key="companion.id"
              type="button"
              class="w-full rounded border p-3 text-left transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              :class="{ 'border-amber-500 bg-amber-100': index === 0 }"
              @click="selectCompanion(companion.id)"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="font-medium">{{ companion.name }}</span>
                <span
                  class="rounded px-2 py-1 text-xs"
                  :class="companion.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'"
                >
                  {{ companion.gender }}
                </span>
              </span>
              <span class="mt-1 block text-sm text-gray-600">
                {{ formatLastTogether(companion.lastTimeTogether) }}
              </span>
              <span class="mt-1 block text-xs text-gray-500">
                {{ formatLastAssignment(companion.lastAssignmentDate) }}
              </span>
              <span v-if="companion.assignedThisWeek" class="mt-1 block text-xs font-medium text-orange-700">
                Ya tiene una asignación esta semana
              </span>
              <span v-else-if="index === 0" class="mt-1 block text-xs font-medium text-amber-700">
                Recomendación del sistema
              </span>
            </button>
          </div>
        </template>

        <p v-if="actionError" role="alert" class="mt-4 text-sm text-red-700">
          {{ actionError }}
        </p>

        <div class="mt-4 flex justify-end gap-2">
          <AppButton v-if="modalState === 'companion'" type="button" @click="goBackToStudents">
            Volver
          </AppButton>
          <AppButton type="button" @click="closeModal">
            Cancelar
          </AppButton>
        </div>
      </section>
    </div>
  </Teleport>
</template>
