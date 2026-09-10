<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ProgramWeek, SchoolAssignment, SchoolStudentCount } from '~/utils/assignments'
import {
  fetchAssignments,
  getSchoolStudentCount,
  isCancelledMeeting,
  isCircuitOverseerVisit,
  setSchoolStudentCount,
} from '~/utils/assignments'
import type { SanityFinding } from '~/utils/sanity'
import { runSanityChecks } from '~/utils/sanity'
import { extractCalendarYear, getWeekCalendarOrder } from '~/utils/weekDates'
import { assignmentControlId, getProgramProgress } from '~/utils/programProgress'

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
const weekProgress = computed(() => program.value ? getProgramProgress(program.value) : [])
const pendingCount = computed(() => weekProgress.value.reduce((sum, week) => sum + week.pending.length, 0))

function openAssignment(slotKey: string): void {
  if (!import.meta.client) return
  const control = document.getElementById(assignmentControlId(slotKey))
  control?.scrollIntoView({ block: 'center' })
  control?.focus({ preventScroll: true })
  control?.click()
}

function printProgram(): void {
  if (!import.meta.client || !hasActiveWeeks.value) return
  if (pendingCount.value && !window.confirm(
    `Quedan ${pendingCount.value} asignaciones sin completar. ¿Deseas imprimir de todos modos? Cancela para revisarlas.`,
  )) return
  window.print()
}

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
const hasActiveWeeks = computed(() => (
  program.value?.weeks.some(week => !isCancelledMeeting(week)) ?? false
))

function findingsForSlots(...slotKeys: string[]): SanityFinding[] {
  const targetSlots = new Set(slotKeys)
  return sanityFindings.value.filter(finding => (
    finding.slotKeys.some(slotKey => targetSlots.has(slotKey))
  ))
}

function updateSchoolStudentCount(
  assignment: SchoolAssignment,
  studentCount: SchoolStudentCount,
): void {
  setSchoolStudentCount(assignment, studentCount)
}

function cancelMeeting(week: ProgramWeek): void {
  week.meetingException = { type: 'cancelled' }
}

function markCircuitOverseerVisit(week: ProgramWeek): void {
  week.meetingException = { type: 'circuitOverseerVisit', serviceTalkSpeaker: '' }
}

function clearMeetingException(week: ProgramWeek): void {
  delete week.meetingException
}

function updateServiceTalkSpeaker(week: ProgramWeek, value: string): void {
  if (week.meetingException?.type === 'circuitOverseerVisit') {
    week.meetingException.serviceTalkSpeaker = value
  }
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
    const weeks = await fetchAssignments(url.value)
    if (program.value && !window.confirm('Cargar este programa reemplazará el borrador actual. ¿Deseas continuar?')) return
    replaceProgram(weeks, calendarYear)
  } catch (error) {
    console.error('[fetchAllAssignments] Error cargando asignaciones:', error)
    assignmentsError.value = 'No se pudo cargar el programa. Revisa el enlace o intenta de nuevo.'
  } finally {
    loadingAssignments.value = false
  }
}

function confirmClearProgram(): void {
  if (!program.value) return
  if (!window.confirm('Se borrará el programa actual y sus asignaciones. ¿Deseas continuar?')) return
  clearProgram()
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

    <div class="dont-print flex flex-wrap items-center gap-2 p-4">
      <input v-model="url" class="flex-1 rounded border border-gray-300 px-2 py-1" type="url" placeholder="URL de Vida y Ministerio">
      <Button :disabled="loadingAssignments" @click="fetchAllAssignments">Cargar</Button>
      <Button :disabled="!program" @click="confirmClearProgram">Borrar</Button>
      <Button :disabled="!hasActiveWeeks" @click="printProgram">Imprimir / PDF</Button>
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
      <p v-if="pendingCount" class="only-print font-bold">
        Programa incompleto: {{ pendingCount }} asignaciones sin completar.
      </p>
      <div
        v-for="(week, weekIndex) in program.weeks"
        :key="weekIndex"
        class="dont-break mb-8"
        :class="{ 'dont-print': isCancelledMeeting(week) }"
      >
        <div
          v-if="isCancelledMeeting(week)"
          class="flex items-center justify-between gap-4 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3"
        >
          <div>
            <span class="font-semibold text-gray-900">{{ week.date }}</span>
            <span class="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
              Reunión cancelada
            </span>
          </div>
          <button
            type="button"
            class="rounded border border-gray-400 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            @click="clearMeetingException(week)"
          >
            Restaurar
          </button>
        </div>

        <div v-if="!isCancelledMeeting(week)" class="dont-print mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <span class="font-semibold">{{ week.date }}</span>
          <span :class="weekProgress[weekIndex]!.pending.length ? 'text-amber-800' : 'text-green-800'" aria-live="polite">
            {{ weekProgress[weekIndex]!.completed }} de {{ weekProgress[weekIndex]!.total }} asignaciones completas
          </span>
          <progress
            class="h-2 w-28 accent-green-700"
            :value="weekProgress[weekIndex]!.completed"
            :max="weekProgress[weekIndex]!.total || 1"
            :aria-label="`Progreso de ${week.date}`"
          />
          <button
            v-if="weekProgress[weekIndex]!.pending.length"
            type="button"
            class="rounded border border-amber-600 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-50"
            :aria-label="`Ir a la siguiente pendiente de ${week.date}`"
            @click="openAssignment(weekProgress[weekIndex]!.pending[0]!.key)"
          >
            Ir a la siguiente pendiente
          </button>
        </div>
        <table v-if="!isCancelledMeeting(week)" class="w-full border-collapse pt-4">
          <tbody>
            <tr>
              <td class="text-lg font-bold" colspan="2">
                <div class="flex items-center gap-2">
                  <span class="min-w-0">{{ week.date }} | {{ week.assignedReading }}</span>
                  <span
                    v-if="isCircuitOverseerVisit(week)"
                    class="dont-print shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800"
                  >
                    Visita del superintendente
                  </span>
                  <WeekExceptionMenu
                    :exception="week.meetingException"
                    :week-date="week.date"
                    @cancel-meeting="cancelMeeting(week)"
                    @mark-circuit-overseer-visit="markCircuitOverseerVisit(week)"
                    @clear-circuit-overseer-visit="clearMeetingException(week)"
                  />
                </div>
              </td>
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
              <td class="pr-2 text-right align-middle whitespace-nowrap">
                Estudiante:
              </td>
              <td colspan="2" class="align-middle">
                <StudentAssigner
                  v-model="assignment.conductorId"
                  v-model:companion-value="assignment.studentId"
                  role="school"
                  can-choose-student-count
                  :needs-companion="getSchoolStudentCount(assignment) === 2"
                  :week-date="week.date"
                  :program-id="program.id"
                  :calendar-order="calendarOrderForWeek(weekIndex)"
                  :chronological-order="program.createdAt + weekIndex"
                  :slot-key="getSchoolStudentCount(assignment) === 2
                    ? `${weekIndex}:school:${assignmentIndex}`
                    : `${weekIndex}:school:${assignmentIndex}:conductor`"
                  :assignment-title="assignment.title"
                  :accessible-name="`${assignment.title}, ${week.date}`"
                  @update:needs-companion="updateSchoolStudentCount(assignment, $event ? 2 : 1)"
                />
              </td>
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
            <tr v-if="isCircuitOverseerVisit(week)">
              <td class="py-1">
                ● Discurso de Servicio (30 mins.)
              </td>
              <td class="pr-2 text-right">Encargado:</td>
              <td colspan="2">
                <PrintableInput
                  :id="assignmentControlId(`${weekIndex}:serviceTalkSpeaker`)"
                  :model-value="week.meetingException?.type === 'circuitOverseerVisit'
                    ? week.meetingException.serviceTalkSpeaker
                    : ''"
                  :accessible-name="`Encargado del Discurso de Servicio, ${week.date}`"
                  @update:model-value="updateServiceTalkSpeaker(week, $event)"
                />
              </td>
            </tr>
            <tr v-else>
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

      <div v-if="hasActiveWeeks" class="dont-break mb-8">
        <table class="w-full border-collapse">
          <thead><tr><th colspan="3" class="border border-black bg-amber-700 p-1 text-lg font-bold text-white">Seamos Mejores Maestros</th></tr></thead>
          <tbody>
            <template v-for="(week, weekIndex) in program.weeks" :key="`summary-${weekIndex}`">
              <template v-if="!isCancelledMeeting(week)">
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
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </main>
</template>
