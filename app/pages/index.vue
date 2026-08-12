<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchAssignments } from '~/utils/assignments'
import type { SanityFinding } from '~/utils/sanity'
import { runSanityChecks } from '~/utils/sanity'
import { extractCalendarYear, getWeekCalendarOrder } from '~/utils/weekDates'

const url = useLocalStorage<string>('lastAssignmentsURL', '')
if (import.meta.client && !url.value) {
  const legacyUrl = window.localStorage.getItem('lastAssingmentsURL')
  if (legacyUrl) {
    try {
      const parsed = JSON.parse(legacyUrl) as unknown
      if (typeof parsed === 'string') {
        url.value = parsed
        window.localStorage.removeItem('lastAssingmentsURL')
      }
    } catch {
      // Leave malformed legacy configuration untouched for manual recovery.
    }
  }
}
const {
  clearProgram,
  lastSavedAt,
  lastSaveError,
  program,
  replaceProgram,
  saveStatus,
} = usePersistentProgram()
const { getParticipantName, participants, syncProgramHistory } = useParticipants()
const loadingAssignments = ref(false)
const assignmentsError = ref('')

function calendarOrderForWeek(weekIndex: number): number {
  const currentProgram = program.value
  if (!currentProgram) return 0
  return getWeekCalendarOrder(currentProgram.weeks, currentProgram.calendarYear, weekIndex)
    ?? currentProgram.createdAt + weekIndex
}

const saveStatusText = computed(() => {
  if (lastSaveError.value) return `Error guardando borrador: ${lastSaveError.value}`
  if (saveStatus.value === 'saving') return 'Guardando borrador...'
  if (lastSavedAt.value) return `Guardado ${new Date(lastSavedAt.value).toLocaleString()}`
  return 'Sin borrador guardado'
})

const sanityFindings = computed(() => (
  program.value
    ? runSanityChecks({ program: program.value, participants: participants.value })
    : []
))

function findingsForSlots(...slotKeys: string[]): SanityFinding[] {
  const targetSlots = new Set(slotKeys)
  return sanityFindings.value.filter(finding => (
    finding.slotKeys.some(slotKey => targetSlots.has(slotKey))
  ))
}

watch(program, (currentProgram) => {
  if (currentProgram) syncProgramHistory(currentProgram)
}, { deep: true, flush: 'post', immediate: true })

async function fetchAllAssignments(): Promise<void> {
  if (!url.value) return
  loadingAssignments.value = true
  assignmentsError.value = ''
  try {
    const calendarYear = extractCalendarYear(url.value) ?? new Date().getFullYear()
    replaceProgram(await fetchAssignments(url.value), calendarYear)
  } catch (error) {
    console.error('[fetchAllAssignments] Error cargando asignaciones:', error)
    assignmentsError.value = 'No se pudo cargar el programa. Revisa el enlace o intenta de nuevo.'
  } finally {
    loadingAssignments.value = false
  }
}
</script>

<template>
  <main class="container">
    <nav class="dont-print flex items-center justify-between bg-gray-800 p-4 text-white">
      <h1 class="text-xl font-bold">Generador de Programas</h1>
      <NuxtLink to="/participants" class="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
        Gestionar Participantes
      </NuxtLink>
    </nav>

    <div class="dont-print flex items-center gap-2 p-4">
      <input v-model="url" class="flex-1 rounded border border-gray-300 px-2 py-1" type="url" placeholder="URL de Vida y Ministerio">
      <Button :disabled="loadingAssignments" @click="fetchAllAssignments">Cargar</Button>
      <Button @click="clearProgram">Borrar</Button>
    </div>
    <div v-if="assignmentsError" class="dont-print px-4 pb-2 text-sm text-red-700">{{ assignmentsError }}</div>
    <div class="dont-print px-4 pb-3 text-sm" :class="lastSaveError ? 'text-red-700' : 'text-gray-600'">
      {{ saveStatusText }}
    </div>

    <SanityAlerts :findings="sanityFindings" />

    <div v-if="!program" class="dont-print px-4 py-16 text-center text-gray-500">
      No hay un programa cargado. Registra participantes y carga un programa para comenzar.
    </div>

    <template v-else>
      <div v-for="(week, weekIndex) in program.weeks" :key="weekIndex" class="dont-break mb-8">
        <table class="w-full border-collapse pt-4">
          <tbody>
            <tr>
              <td class="text-lg font-bold" colspan="2">{{ week.date }} | {{ week.assignedReading }}</td>
              <td class="pr-2 text-right">
                Presidente<AssignmentWarningIndicator :findings="findingsForSlots(`${weekIndex}:president`)" />:
              </td>
              <td>
                <StudentAssigner
                  v-model="week.presidentId"
                  role="president"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:president`"
                  assignment-title="Presidente"
                  :accessible-name="`Presidente, ${week.date}`"
                />
              </td>
            </tr>
            <tr><td class="py-1" colspan="4">● Canción {{ week.songs[0] }} y oración</td></tr>
            <tr><td class="py-1" colspan="4">● Palabras de introducción (1 min.)</td></tr>

            <tr><td class="bg-gray-700 p-1 font-bold text-white">TESOROS DE LA BIBLIA</td></tr>
            <tr>
              <td class="py-1" colspan="2">
                ● {{ week.treasures.title }} ({{ week.treasures.duration }} mins.)<AssignmentWarningIndicator :findings="findingsForSlots(`${weekIndex}:treasures`)" />
              </td>
              <td colspan="2">
                <StudentAssigner
                  v-model="week.treasures.participantId"
                  role="treasures"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:treasures`"
                  :assignment-title="week.treasures.title"
                  :accessible-name="`${week.treasures.title}, ${week.date}`"
                />
              </td>
            </tr>
            <tr>
              <td class="py-1" colspan="2">
                ● Busquemos perlas escondidas (10 mins.)<AssignmentWarningIndicator :findings="findingsForSlots(`${weekIndex}:gems`)" />
              </td>
              <td colspan="2">
                <StudentAssigner
                  v-model="week.gems.participantId"
                  role="gems"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:gems`"
                  assignment-title="Busquemos perlas escondidas"
                  :accessible-name="`Busquemos perlas escondidas, ${week.date}`"
                />
              </td>
            </tr>
            <tr>
              <td class="py-1">
                ● Lectura de la Biblia<AssignmentWarningIndicator :findings="findingsForSlots(`${weekIndex}:reading`)" />
              </td>
              <td class="pr-2 text-right">Estudiante:</td>
              <td colspan="2">
                <StudentAssigner
                  v-model="week.reading.participantId"
                  role="reading"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:reading`"
                  assignment-title="Lectura de la Biblia"
                  :accessible-name="`Lectura de la Biblia, ${week.date}`"
                />
              </td>
            </tr>

            <tr><td class="mt-2 bg-amber-600 p-1 font-bold text-white">SEAMOS MEJORES MAESTROS</td></tr>
            <tr v-for="(assignment, assignmentIndex) in week.school" :key="`school-${assignmentIndex}`">
              <td class="py-1 align-middle">
                ● {{ assignment.title }} ({{ assignment.duration }} mins.)<AssignmentWarningIndicator
                  :findings="findingsForSlots(
                    `${weekIndex}:school:${assignmentIndex}:conductor`,
                    `${weekIndex}:school:${assignmentIndex}:student`,
                  )"
                />
              </td>
              <template v-if="assignment.studentId !== undefined">
                <td class="pr-2 text-right align-middle whitespace-nowrap">Conductor / Estudiante:</td>
                <td colspan="2" class="align-middle">
                  <StudentAssigner
                    v-model="assignment.conductorId"
                    v-model:companion-value="assignment.studentId"
                    role="school"
                    needs-companion
                    :week-date="week.date"
                    :program-id="program.id"
                    :calendar-order="calendarOrderForWeek(weekIndex)"
                    :chronological-order="program.createdAt + weekIndex"
                    :slot-key="`${weekIndex}:school:${assignmentIndex}`"
                    :assignment-title="assignment.title"
                    :accessible-name="`Conductor de ${assignment.title}, ${week.date}`"
                  />
                </td>
              </template>
              <template v-else>
                <td class="pr-2 text-right align-middle whitespace-nowrap">Estudiante:</td>
                <td colspan="2">
                  <StudentAssigner
                    v-model="assignment.conductorId"
                    role="school"
                    :week-date="week.date"
                    :program-id="program.id"
                    :calendar-order="calendarOrderForWeek(weekIndex)"
                    :chronological-order="program.createdAt + weekIndex"
                    :slot-key="`${weekIndex}:school:${assignmentIndex}:conductor`"
                    :assignment-title="assignment.title"
                    :accessible-name="`${assignment.title}, ${week.date}`"
                  />
                </td>
              </template>
            </tr>

            <tr><td class="mt-2 bg-red-800 p-1 font-bold text-white">NUESTRA VIDA CRISTIANA</td></tr>
            <tr><td class="py-1" colspan="4">● Canción {{ week.songs[1] }}</td></tr>
            <tr v-for="(assignment, assignmentIndex) in week.livingSpeeches" :key="`living-${assignmentIndex}`">
              <td class="py-1" colspan="2">
                ● {{ assignment.title }} ({{ assignment.duration }} mins.)<AssignmentWarningIndicator
                  :findings="findingsForSlots(`${weekIndex}:living:${assignmentIndex}:livingSpeech`)"
                />
              </td>
              <td colspan="2">
                <StudentAssigner
                  v-model="assignment.participantId"
                  role="livingSpeech"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:living:${assignmentIndex}:livingSpeech`"
                  :assignment-title="assignment.title"
                  :accessible-name="`${assignment.title}, ${week.date}`"
                />
              </td>
            </tr>
            <tr>
              <td class="py-1">
                ● Estudio bíblico de la congregación (30 mins.)<AssignmentWarningIndicator
                  :findings="findingsForSlots(`${weekIndex}:bookConductor`, `${weekIndex}:bookReader`)"
                />
              </td>
              <td class="pr-2 text-right">Conductor/Lector:</td>
              <td>
                <StudentAssigner
                  v-model="week.bookConductorId"
                  role="bookConductor"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:bookConductor`"
                  assignment-title="Conductor del estudio bíblico"
                  :accessible-name="`Conductor del estudio bíblico, ${week.date}`"
                />
              </td>
              <td>
                <StudentAssigner
                  v-model="week.bookReaderId"
                  role="bookReader"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:bookReader`"
                  assignment-title="Lector del estudio bíblico"
                  :accessible-name="`Lector del estudio bíblico, ${week.date}`"
                />
              </td>
            </tr>

            <tr><td class="py-1" colspan="4">● Palabras de conclusión (3 mins.)</td></tr>
            <tr>
              <td class="py-1">● Canción {{ week.songs[2] }}</td>
              <td class="pr-2 text-right">
                Oración<AssignmentWarningIndicator :findings="findingsForSlots(`${weekIndex}:finalPrayer`)" />:
              </td>
              <td colspan="2">
                <StudentAssigner
                  v-model="week.finalPrayerId"
                  role="finalPrayer"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="`${weekIndex}:finalPrayer`"
                  assignment-title="Oración final"
                  :accessible-name="`Oración final, ${week.date}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="program.weeks.length" class="dont-break mb-8">
        <table class="w-full border-collapse">
          <thead><tr><th colspan="3" class="border border-black bg-amber-700 p-1 text-lg font-bold text-white">Seamos Mejores Maestros</th></tr></thead>
          <tbody>
            <template v-for="(week, weekIndex) in program.weeks" :key="`summary-${weekIndex}`">
              <tr><td colspan="3" class="border border-black bg-amber-600 p-1 font-bold text-white">{{ week.date }}</td></tr>
              <tr><td class="border px-2">Lectura</td><td colspan="2" class="border text-center">{{ getParticipantName(week.reading.participantId) }}</td></tr>
              <tr v-for="(assignment, assignmentIndex) in week.school" :key="`summary-school-${assignmentIndex}`">
                <td class="border px-2">{{ assignment.title }} ({{ assignment.duration }} mins.)</td>
                <template v-if="assignment.studentId !== undefined">
                  <td class="border text-center">{{ getParticipantName(assignment.conductorId) }}</td>
                  <td class="border text-center">{{ getParticipantName(assignment.studentId) }}</td>
                </template>
                <td v-else colspan="2" class="border text-center">{{ getParticipantName(assignment.conductorId) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </main>
</template>
