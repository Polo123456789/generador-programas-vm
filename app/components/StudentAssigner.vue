<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Assignment } from '~/utils/assingments'
import type { Student } from '~/utils/students'

interface Props {
  modelValue: Assignment
  weekDate: string
  type: 'school' | 'reading'
  needsCompanion: boolean
  buttonOnly?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Assignment]
}>()

const { getStudentsSortedByLastAssignment, getCompanionsSorted, assignStudent, getStudentName, assignmentHistory } = useStudents()

const showStudentModal = ref(false)
const showCompanionModal = ref(false)
const selectedStudentId = ref<string | null>(null)

const studentsList = computed(() => {
  return getStudentsSortedByLastAssignment(props.type, props.weekDate)
})

// Split students by gender for school assignments
const maleStudents = computed(() => {
  return studentsList.value.filter(s => s.gender === 'M')
})

const femaleStudents = computed(() => {
  return studentsList.value.filter(s => s.gender === 'F')
})

const companionsList = computed(() => {
  if (!selectedStudentId.value) return []
  return getCompanionsSorted(selectedStudentId.value, props.weekDate, props.type)
})

const studentValue = computed({
  get: () => props.modelValue.student,
  set: (value) => {
    emit('update:modelValue', { ...props.modelValue, student: value })
  }
})

function openStudentModal() {
  showStudentModal.value = true
}

function closeStudentModal() {
  showStudentModal.value = false
  selectedStudentId.value = null
}

function selectStudent(studentId: string) {
  selectedStudentId.value = studentId

  if (!props.needsCompanion) {
    // Assign directly without companion
    const studentName = getStudentName(studentId)
    assignStudent({
      studentId,
      assignmentType: props.type,
      weekDate: props.weekDate,
    })
    emit('update:modelValue', { ...props.modelValue, student: studentName })
    closeStudentModal()
  } else {
    // Open companion selection
    showStudentModal.value = false
    showCompanionModal.value = true
  }
}

function closeCompanionModal() {
  showCompanionModal.value = false
  selectedStudentId.value = null
}

function goBackToStudentModal() {
  showCompanionModal.value = false
  showStudentModal.value = true
}

function selectCompanion(companionId: string) {
  if (!selectedStudentId.value) return
  
  const studentName = getStudentName(selectedStudentId.value)
  const companionName = getStudentName(companionId)
  
  assignStudent({
    studentId: selectedStudentId.value,
    companionId,
    assignmentType: props.type,
    weekDate: props.weekDate,
  })
  
  emit('update:modelValue', { 
    ...props.modelValue, 
    student: studentName,
    assistant: companionName,
  })
  
  closeCompanionModal()
}

function formatLastAssignment(date: string | null): string {
  return date || 'Nunca'
}

function formatLastTogether(date: string | null): string {
  return date ? `Última vez juntos: ${date}` : 'Nunca juntos'
}
</script>

<template>
  <div v-if="buttonOnly" class="flex gap-2 items-center">
    <button
      @click="openStudentModal"
      class="dont-print px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 whitespace-nowrap"
      type="button"
    >
      Asignar
    </button>
  </div>
  <div v-else class="flex gap-2 items-center justify-between">
    <PrintableInput v-model="studentValue" class="flex-1" />
    <button
      @click="openStudentModal"
      class="dont-print px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 whitespace-nowrap"
      type="button"
    >
      Asignar
    </button>
  </div>

  <!-- Student Selection Modal -->
  <div v-if="showStudentModal" class="dont-print fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="closeStudentModal">
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
      <h3 class="text-lg font-bold mb-4">
        Seleccionar Estudiante
        <span v-if="type === 'reading'">- Lectura</span>
        <span v-else>- Escuela</span>
      </h3>
      
      <div v-if="studentsList.length === 0" class="text-gray-500 text-center py-4">
        No hay estudiantes activos. Añade estudiantes en la página de gestión.
      </div>
      
      <!-- Single column for reading -->
      <div v-else-if="type === 'reading'" class="space-y-2">
        <div
          v-for="(student, index) in studentsList"
          :key="student.id"
          @click="selectStudent(student.id)"
          class="p-3 border rounded cursor-pointer hover:bg-amber-50 transition-colors"
          :class="{ 'bg-amber-100 border-amber-500': index === 0 }"
        >
          <div class="flex justify-between items-center">
            <span class="font-medium">{{ student.name }}</span>
            <span class="text-xs px-2 py-1 rounded" :class="student.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'">
              {{ student.gender }}
            </span>
          </div>
          <div class="text-sm text-gray-600 mt-1">
            Última asignación: {{ formatLastAssignment(student.lastAssignmentDate) }}
          </div>
          <div v-if="index === 0" class="text-xs text-amber-700 mt-1 font-medium">
            Recomendación del sistema
          </div>
        </div>
      </div>
      
      <!-- Two columns for school -->
      <div v-else class="grid grid-cols-2 gap-4">
        <!-- Male students -->
        <div>
          <h4 class="font-semibold mb-2 text-blue-700 border-b border-blue-200 pb-1">Masculinos</h4>
          <div v-if="maleStudents.length === 0" class="text-gray-400 text-sm">
            No hay estudiantes masculinos
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(student, index) in maleStudents"
              :key="student.id"
              @click="selectStudent(student.id)"
              class="p-2 border rounded cursor-pointer hover:bg-amber-50 transition-colors text-sm"
              :class="{ 'bg-amber-100 border-amber-500': index === 0 }"
            >
              <div class="font-medium">{{ student.name }}</div>
              <div class="text-xs text-gray-600">
                {{ formatLastAssignment(student.lastAssignmentDate) }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Female students -->
        <div>
          <h4 class="font-semibold mb-2 text-pink-700 border-b border-pink-200 pb-1">Femeninos</h4>
          <div v-if="femaleStudents.length === 0" class="text-gray-400 text-sm">
            No hay estudiantes femeninos
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(student, index) in femaleStudents"
              :key="student.id"
              @click="selectStudent(student.id)"
              class="p-2 border rounded cursor-pointer hover:bg-amber-50 transition-colors text-sm"
              :class="{ 'bg-amber-100 border-amber-500': index === 0 }"
            >
              <div class="font-medium">{{ student.name }}</div>
              <div class="text-xs text-gray-600">
                {{ formatLastAssignment(student.lastAssignmentDate) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mt-4 flex justify-end">
        <Button @click="closeStudentModal">Cancelar</Button>
      </div>
    </div>
  </div>

  <!-- Companion Selection Modal -->
  <div v-if="showCompanionModal" class="dont-print fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="closeCompanionModal">
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
      <h3 class="text-lg font-bold mb-4">
        Seleccionar Compañero para {{ getStudentName(selectedStudentId || '') }}
      </h3>
      
      <div v-if="companionsList.length === 0" class="text-gray-500 text-center py-4">
        No hay compañeros disponibles del mismo género.
      </div>
      
      <div v-else class="space-y-2">
        <div
          v-for="(companion, index) in companionsList"
          :key="companion.id"
          @click="selectCompanion(companion.id)"
          class="p-3 border rounded cursor-pointer hover:bg-amber-50 transition-colors"
          :class="{ 'bg-amber-100 border-amber-500': index === 0 }"
        >
          <div class="flex justify-between items-center">
            <span class="font-medium">{{ companion.name }}</span>
            <span class="text-xs px-2 py-1 rounded" :class="companion.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'">
              {{ companion.gender }}
            </span>
          </div>
          <div class="text-sm text-gray-600 mt-1">
            {{ formatLastTogether(companion.lastTimeTogether) }}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            Última asignación: {{ formatLastAssignment(companion.lastAssignmentDate) }}
          </div>
          <div v-if="index === 0" class="text-xs text-amber-700 mt-1 font-medium">
            Recomendación del sistema
          </div>
        </div>
      </div>
      
      <div class="mt-4 flex justify-end gap-2">
        <Button @click="goBackToStudentModal">Volver</Button>
        <Button @click="closeCompanionModal">Cancelar</Button>
      </div>
    </div>
  </div>
</template>
