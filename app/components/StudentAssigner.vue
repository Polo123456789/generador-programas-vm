<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ParticipantRole } from '~/utils/participants'
import type { ParticipantRecommendation, PartnerRankingPriority } from '~/utils/participantRecommendations'
import { rankParticipants, rankPartners } from '~/utils/participantRecommendations'

interface Props {
  modelValue: string | null
  companionValue?: string | null
  needsCompanion?: boolean
  canChooseStudentCount?: boolean
  role: ParticipantRole
  weekDate: string
  programId: string
  calendarOrder: number
  chronologicalOrder: number
  slotKey: string
  assignmentTitle: string
  accessibleName: string
}

const props = withDefaults(defineProps<Props>(), {
  companionValue: null,
  needsCompanion: false,
  canChooseStudentCount: false,
})
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:companionValue': [value: string | null]
  'update:needsCompanion': [value: boolean]
}>()

const { assignmentHistory, getParticipantName, participants } = useParticipants()
const phase = ref<'primary' | 'companion' | null>(null)
const selectedPrimaryId = ref<string | null>(null)
const selectedNeedsCompanion = ref(false)
const partnerRankingPriority = ref<PartnerRankingPriority>('timeTogether')
const dialog = ref<HTMLElement | null>(null)
const triggerButton = ref<HTMLButtonElement | null>(null)

const candidates = computed(() => rankParticipants({
  participants: participants.value,
  history: assignmentHistory.value,
  role: props.role,
  targetWeekDate: props.weekDate,
  targetProgramId: props.programId,
  targetCalendarOrder: props.calendarOrder,
  targetChronologicalOrder: props.chronologicalOrder,
  targetSlotKey: props.slotKey,
}))
const maleCandidates = computed(() => candidates.value.filter(candidate => candidate.participant.gender === 'M'))
const femaleCandidates = computed(() => candidates.value.filter(candidate => candidate.participant.gender === 'F'))
const primaryCandidates = computed(() => (
  props.role === 'school' && !selectedNeedsCompanion.value
    ? maleCandidates.value
    : candidates.value
))
const companions = computed(() => selectedPrimaryId.value
  ? rankPartners({
      participants: participants.value,
      history: assignmentHistory.value,
      primaryId: selectedPrimaryId.value,
      role: props.role,
      targetWeekDate: props.weekDate,
      targetProgramId: props.programId,
      targetCalendarOrder: props.calendarOrder,
      targetChronologicalOrder: props.chronologicalOrder,
      targetSlotKey: props.slotKey,
    }, partnerRankingPriority.value)
  : [])
const hasAssignment = computed(() => Boolean(props.modelValue || props.companionValue))
const modalTitle = computed(() => {
  if (phase.value === 'companion') {
    return `Elige al estudiante que acompañará a ${getParticipantName(selectedPrimaryId.value)}`
  }
  if (selectedNeedsCompanion.value) return 'Elige al conductor'
  if (props.role === 'president') return 'Elige al presidente'
  if (props.role === 'bookConductor') return 'Elige al conductor'
  if (props.role === 'bookReader') return 'Elige al lector'
  if (props.role === 'reading' || props.role === 'school') return 'Elige al estudiante'
  return 'Elige al participante'
})

watch(phase, async (currentPhase) => {
  if (!currentPhase) return
  await nextTick()
  dialog.value?.focus()
})

function open(): void {
  selectedPrimaryId.value = props.modelValue
  selectedNeedsCompanion.value = props.needsCompanion
  partnerRankingPriority.value = 'timeTogether'
  phase.value = 'primary'
}

function close(): void {
  phase.value = null
  selectedPrimaryId.value = null
  void nextTick(() => triggerButton.value?.focus())
}

function selectPrimary(participantId: string): void {
  if (selectedNeedsCompanion.value) {
    selectedPrimaryId.value = participantId
    phase.value = 'companion'
    return
  }

  emit('update:modelValue', participantId)
  if (props.canChooseStudentCount) emit('update:needsCompanion', false)
  close()
}

function selectCompanion(participantId: string): void {
  if (!selectedPrimaryId.value) return
  emit('update:modelValue', selectedPrimaryId.value)
  emit('update:companionValue', participantId)
  if (props.canChooseStudentCount) emit('update:needsCompanion', true)
  close()
}

function clearAssignment(): void {
  emit('update:modelValue', null)
  if (props.needsCompanion) emit('update:companionValue', null)
  close()
}

function primaryLabel(): string {
  return getParticipantName(props.modelValue)
}

function companionLabel(): string {
  return getParticipantName(props.companionValue)
}

function assignmentHistoryLabel(candidate: ParticipantRecommendation): string {
  return candidate.lastAssignmentDate
    ? `Última participación: ${candidate.lastAssignmentDate}`
    : 'Nunca ha participado en este cargo'
}

function togetherHistoryLabel(candidate: ParticipantRecommendation): string {
  return candidate.lastTimeTogether
    ? `Última vez juntos: ${candidate.lastTimeTogether}`
    : 'Nunca han participado juntos'
}

function triggerAccessibleName(): string {
  return `${hasAssignment.value ? 'Cambiar' : 'Elegir'}: ${props.accessibleName}`
}

function trapFocus(event: KeyboardEvent): void {
  if (!dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(element => element.getClientRects().length > 0)
  if (focusable.length === 0) {
    event.preventDefault()
    dialog.value.focus()
    return
  }

  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div class="dont-print flex min-w-0 items-center gap-2">
    <div
      class="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
    >
      <template v-if="needsCompanion">
        <span class="font-medium">{{ primaryLabel() }}</span>
        <span class="px-1 text-gray-400" aria-hidden="true">/</span>
        <span class="font-medium">{{ companionLabel() }}</span>
      </template>
      <span v-else class="block truncate font-medium" :title="primaryLabel()">
        <template v-if="primaryLabel()">{{ primaryLabel() }}</template>
        <template v-else>&nbsp;</template>
      </span>
    </div>
    <button
      ref="triggerButton"
      type="button"
      :aria-label="triggerAccessibleName()"
      class="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
      @click="open"
    >
      {{ hasAssignment ? 'Cambiar' : 'Elegir' }}
    </button>
  </div>

  <span class="only-print">
    {{ primaryLabel() }}<template v-if="needsCompanion"> / {{ companionLabel() }}</template>
  </span>

  <Teleport to="body">
    <div
      v-if="phase"
      class="dont-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      @click.self="close"
      @keydown.esc="close"
    >
      <section
        ref="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-assigner-title"
        tabindex="-1"
        class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        @keydown.tab="trapFocus"
      >
        <header class="border-b border-gray-200 px-5 py-4 sm:px-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-amber-700">{{ assignmentTitle }} · {{ weekDate }}</p>
              <h2 id="student-assigner-title" class="mt-1 text-xl font-bold text-gray-950">{{ modalTitle }}</h2>
              <p class="mt-1 text-sm text-gray-600">
                <template v-if="phase === 'companion'">
                  <template v-if="partnerRankingPriority === 'timeTogether'">
                    Primero aparecen quienes llevan más tiempo sin participar con esta persona; luego, quienes tienen la asignación más antigua.
                  </template>
                  <template v-else>
                    Primero aparecen quienes tienen la asignación más antigua; luego, quienes llevan más tiempo sin participar con esta persona.
                  </template>
                </template>
                <template v-else>
                  Primero aparecen quienes llevan más tiempo sin participar en este cargo.
                </template>
              </p>
              <fieldset v-if="phase === 'companion'" class="mt-3">
                <legend class="sr-only">Criterio principal para ordenar estudiantes</legend>
                <div
                  class="inline-flex max-w-full rounded-lg border border-gray-300 bg-gray-100 p-1"
                  role="group"
                  aria-label="Ordenar primero por"
                >
                  <button
                    type="button"
                    :aria-pressed="partnerRankingPriority === 'timeTogether'"
                    class="rounded-md px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-500"
                    :class="partnerRankingPriority === 'timeTogether' ? 'bg-white text-amber-800 shadow-sm' : 'text-gray-600 hover:text-gray-950'"
                    @click="partnerRankingPriority = 'timeTogether'"
                  >
                    Tiempo sin participar juntos
                  </button>
                  <button
                    type="button"
                    :aria-pressed="partnerRankingPriority === 'assignment'"
                    class="rounded-md px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-500"
                    :class="partnerRankingPriority === 'assignment' ? 'bg-white text-amber-800 shadow-sm' : 'text-gray-600 hover:text-gray-950'"
                    @click="partnerRankingPriority = 'assignment'"
                  >
                    Asignación más antigua
                  </button>
                </div>
              </fieldset>
            </div>
            <button
              type="button"
              aria-label="Cerrar selector"
              class="rounded-full p-2 text-xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              @click="close"
            >
              ×
            </button>
          </div>
        </header>

        <div class="overflow-y-auto px-5 py-5 sm:px-6">
          <template v-if="phase === 'primary'">
            <fieldset v-if="canChooseStudentCount" class="mx-auto mb-5 max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-4">
              <legend class="px-1 text-sm font-bold text-gray-950">¿Cuántos estudiantes participan?</legend>
              <div class="mt-1 grid grid-cols-2 gap-2" role="group" aria-label="Cantidad de estudiantes">
                <button
                  type="button"
                  :aria-pressed="!selectedNeedsCompanion"
                  class="rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-500"
                  :class="!selectedNeedsCompanion ? 'border-amber-600 bg-amber-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'"
                  @click="selectedNeedsCompanion = false"
                >
                  1 estudiante
                </button>
                <button
                  type="button"
                  :aria-pressed="selectedNeedsCompanion"
                  class="rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-500"
                  :class="selectedNeedsCompanion ? 'border-amber-600 bg-amber-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'"
                  @click="selectedNeedsCompanion = true"
                >
                  2 estudiantes
                </button>
              </div>
              <p class="mt-2 text-xs text-gray-600">
                La opción inicial se detecta automáticamente al cargar el programa.
              </p>
            </fieldset>

            <p v-if="primaryCandidates.length === 0" class="py-10 text-center text-gray-500">
              No hay participantes disponibles. Revisa el padrón y sus aptitudes.
            </p>

            <div
              v-else-if="role === 'school' && selectedNeedsCompanion"
              class="grid grid-cols-2 gap-4"
            >
              <CandidateGroup
                :candidates="maleCandidates"
                label="Hombres"
                tone="blue"
                empty-history-label="Nunca ha participado en esta parte"
                show-week-preview
                @select="selectPrimary"
              />
              <CandidateGroup
                :candidates="femaleCandidates"
                label="Mujeres"
                tone="pink"
                empty-history-label="Nunca ha participado en esta parte"
                show-week-preview
                @select="selectPrimary"
              />
            </div>

            <div v-else class="mx-auto max-w-xl">
              <CandidateGroup
                :candidates="primaryCandidates"
                :label="role === 'school' ? 'Estudiantes disponibles' : 'Participantes disponibles'"
                tone="blue"
                :empty-history-label="role === 'school' ? 'Nunca ha participado en esta parte' : 'Nunca ha participado en este cargo'"
                :show-week-preview="role === 'school'"
                @select="selectPrimary"
              />
            </div>
          </template>

          <div v-else class="mx-auto max-w-xl">
            <p v-if="companions.length === 0" class="py-10 text-center text-gray-500">
              No hay estudiantes disponibles del mismo género.
            </p>
            <div v-else class="space-y-2">
              <button
                v-for="(candidate, index) in companions"
                :key="candidate.participant.id"
                type="button"
                class="w-full rounded-xl border p-4 text-left transition hover:border-amber-400 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                :class="index === 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'"
                @click="selectCompanion(candidate.participant.id)"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-semibold text-gray-950">{{ candidate.participant.name }}</span>
                  <span v-if="index === 0" class="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                    Recomendado
                  </span>
                </div>
                <p class="mt-1 text-sm font-medium text-gray-700">{{ togetherHistoryLabel(candidate) }}</p>
                <p class="mt-0.5 text-xs text-gray-500">
                  <AssignmentWeekTooltip
                    v-if="role === 'school' && candidate.lastAssignment"
                    :assignment="candidate.lastAssignment"
                    :participant-id="candidate.participant.id"
                  >
                    {{ assignmentHistoryLabel(candidate) }}
                  </AssignmentWeekTooltip>
                  <template v-else>{{ assignmentHistoryLabel(candidate) }}</template>
                </p>
              </button>
            </div>
          </div>
        </div>

        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
          <button
            v-if="hasAssignment"
            type="button"
            class="text-sm font-semibold text-red-700 hover:text-red-900"
            @click="clearAssignment"
          >
            Quitar asignación
          </button>
          <span v-else />
          <div class="flex gap-2">
            <button
              v-if="phase === 'companion'"
              type="button"
              class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              @click="phase = 'primary'"
            >
              Volver
            </button>
            <button
              type="button"
              class="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              @click="close"
            >
              Cancelar
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
