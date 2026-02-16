<script setup lang="ts">
import { ref, computed } from 'vue'

const { students, addStudent, toggleStudentHidden, getLastAssignmentDate } = useStudents()

const newStudentName = ref('')
const newStudentGender = ref<'M' | 'F'>('M')
const errorMessage = ref('')

const sortedStudents = computed(() => {
  return [...students.value].sort((a, b) => a.name.localeCompare(b.name))
})

function handleAddStudent() {
  errorMessage.value = ''
  
  const name = newStudentName.value.trim()
  if (!name) {
    errorMessage.value = 'El nombre es requerido'
    return
  }
  
  // Check for duplicate names
  const exists = students.value.some(s => s.name.toLowerCase() === name.toLowerCase())
  if (exists) {
    errorMessage.value = 'Ya existe un estudiante con ese nombre'
    return
  }
  
  addStudent(name, newStudentGender.value)
  newStudentName.value = ''
  newStudentGender.value = 'M'
}

function getLastAssignmentDisplay(studentId: string): string {
  const lastReading = getLastAssignmentDate(studentId, 'reading')
  const lastSchool = getLastAssignmentDate(studentId, 'school')
  
  if (!lastReading && !lastSchool) return 'Nunca'
  
  const dates: string[] = []
  if (lastReading) dates.push(`Lectura: ${lastReading}`)
  if (lastSchool) dates.push(`Escuela: ${lastSchool}`)
  
  return dates.join(', ')
}
</script>

<template>
  <main class="container p-4">
    <div class="dont-print mb-6">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Gestión de Estudiantes</h1>
        <NuxtLink to="/" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          Volver al Programa
        </NuxtLink>
      </div>
      
      <!-- Add Student Form -->
      <div class="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 class="text-lg font-semibold mb-3">Añadir Estudiante</h2>
        <div class="flex gap-3 items-end">
          <div class="flex-1">
            <label class="block text-sm font-medium mb-1">Nombre</label>
            <input 
              v-model="newStudentName"
              type="text"
              class="w-full border rounded px-3 py-2"
              placeholder="Nombre del estudiante"
              @keyup.enter="handleAddStudent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Género</label>
            <select v-model="newStudentGender" class="border rounded px-3 py-2">
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
          <Button @click="handleAddStudent">Añadir</Button>
        </div>
        <p v-if="errorMessage" class="text-red-600 text-sm mt-2">{{ errorMessage }}</p>
      </div>
      
      <!-- Students List -->
      <div>
        <h2 class="text-lg font-semibold mb-3">Lista de Estudiantes</h2>
        
        <div v-if="students.length === 0" class="text-gray-500 text-center py-8">
          No hay estudiantes registrados. Añade el primer estudiante arriba.
        </div>
        
        <table v-else class="w-full border-collapse">
          <thead>
            <tr class="bg-gray-100">
              <th class="border px-4 py-2 text-left">Nombre</th>
              <th class="border px-4 py-2 text-center">Género</th>
              <th class="border px-4 py-2 text-left">Última Asignación</th>
              <th class="border px-4 py-2 text-center">Estado</th>
              <th class="border px-4 py-2 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="student in sortedStudents" 
              :key="student.id"
              :class="{ 'bg-gray-50': student.hidden }"
            >
              <td class="border px-4 py-2" :class="{ 'text-gray-400': student.hidden }">
                {{ student.name }}
              </td>
              <td class="border px-4 py-2 text-center">
                <span 
                  class="text-xs px-2 py-1 rounded"
                  :class="student.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'"
                >
                  {{ student.gender }}
                </span>
              </td>
              <td class="border px-4 py-2 text-sm" :class="{ 'text-gray-400': student.hidden }">
                {{ getLastAssignmentDisplay(student.id) }}
              </td>
              <td class="border px-4 py-2 text-center">
                <span 
                  class="text-xs px-2 py-1 rounded"
                  :class="student.hidden ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'"
                >
                  {{ student.hidden ? 'Oculto' : 'Activo' }}
                </span>
              </td>
              <td class="border px-4 py-2 text-center">
                <button 
                  @click="toggleStudentHidden(student.id)"
                  class="text-sm px-3 py-1 rounded"
                  :class="student.hidden ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'"
                >
                  {{ student.hidden ? 'Mostrar' : 'Ocultar' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="mt-6 text-sm text-gray-600">
        <p><strong>Nota:</strong> Los estudiantes ocultos no aparecerán en las listas de selección para asignaciones.</p>
      </div>
    </div>
  </main>
</template>
