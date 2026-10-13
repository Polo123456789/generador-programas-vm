<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue'
import type { AssignmentHistoryRecord, ParticipantRole } from '~/utils/participants'
import { PARTICIPANT_ROLE_LABELS } from '~/utils/participants'
import { inferWeekCalendarOrder } from '~/utils/weekDates'
import { getRoleHistoryRecords } from '~/utils/historyPreview'

interface Props {
  role: ParticipantRole
  before: number
}

const props = defineProps<Props>()
const { assignmentHistory, getParticipantName } = useParticipants()
const tooltipId = useId()
const trigger = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const tooltipPosition = ref<Record<string, string>>({})
let openTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

const records = computed(() => (
  getRoleHistoryRecords(assignmentHistory.value, props.role, Math.min(props.before, Date.now()))
))

function historyDate(record: AssignmentHistoryRecord): string {
  const order = record.calendarOrder ?? inferWeekCalendarOrder(record.weekDate, record.updatedAt)
  return order === null ? record.weekDate : new Intl.DateTimeFormat('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(order)
}

function participantNames(assignment: AssignmentHistoryRecord): string {
  return assignment.participantIds
    .map(participantId => getParticipantName(participantId))
    .join(' / ')
}

function scheduleOpen(): void {
  cancelClose()
  if (isOpen.value || openTimer) return
  openTimer = setTimeout(() => {
    openTimer = null
    isOpen.value = true
    void nextTick(updatePosition)
  }, 600)
}

function scheduleClose(): void {
  cancelOpen()
  if (!isOpen.value || closeTimer) return
  closeTimer = setTimeout(() => {
    closeTimer = null
    isOpen.value = false
  }, 140)
}

function cancelOpen(): void {
  if (!openTimer) return
  clearTimeout(openTimer)
  openTimer = null
}

function cancelClose(): void {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

function updatePosition(): void {
  if (!trigger.value || !import.meta.client) return

  const rect = trigger.value.getBoundingClientRect()
  const width = 352
  const margin = 12
  const gap = 8
  const availableBelow = window.innerHeight - rect.bottom - gap - margin
  const availableAbove = rect.top - gap - margin
  const placeBelow = availableBelow >= 360 || availableBelow >= availableAbove
  const availableHeight = Math.max(144, Math.min(440, placeBelow ? availableBelow : availableAbove))
  const left = Math.min(
    Math.max(rect.left, margin),
    Math.max(margin, window.innerWidth - width - margin),
  )

  tooltipPosition.value = {
    left: `${left}px`,
    top: `${placeBelow ? rect.bottom + gap : rect.top - gap}px`,
    maxHeight: `${availableHeight}px`,
    transform: placeBelow ? 'none' : 'translateY(-100%)',
  }
}

onBeforeUnmount(() => {
  cancelOpen()
  cancelClose()
})
</script>

<template>
  <span
    ref="trigger"
    tabindex="0"
    :aria-describedby="isOpen ? tooltipId : undefined"
    class="cursor-help border-b border-dotted border-gray-400 print:border-0"
    @mouseenter="scheduleOpen"
    @mouseleave="scheduleClose"
    @focus="scheduleOpen"
    @blur="scheduleClose"
    @keydown.esc="isOpen = false; cancelOpen()"
  >
    <slot />
  </span>

  <Teleport to="body">
    <aside
      v-if="isOpen"
      :id="tooltipId"
      role="tooltip"
      class="dont-print fixed z-[70] flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-2xl"
      :style="tooltipPosition"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
    >
      <header class="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Historial de asignación</p>
        <p class="mt-0.5 text-sm font-bold text-gray-950">{{ PARTICIPANT_ROLE_LABELS[role] }}</p>
        <p class="mt-1 text-xs text-gray-500">Últimas {{ records.length }} participaciones anteriores</p>
      </header>
      <ol v-if="records.length" class="min-h-0 overflow-y-auto px-4 py-3">
        <li
          v-for="record in records"
          :key="record.id"
          class="grid grid-cols-[7rem_1rem_minmax(0,1fr)] gap-x-2 text-sm"
        >
          <time class="py-2 text-xs leading-5 text-gray-500">{{ historyDate(record) }}</time>
          <span class="relative flex justify-center" aria-hidden="true">
            <span class="absolute inset-y-0 w-px bg-gray-200" />
            <span class="relative mt-3 size-2 rounded-full bg-amber-500 ring-4 ring-white" />
          </span>
          <span class="py-2 font-medium leading-5 text-gray-900">{{ participantNames(record) }}</span>
        </li>
      </ol>
      <p v-else class="px-4 py-5 text-sm text-gray-500">No hay participaciones anteriores registradas.</p>
    </aside>
  </Teleport>
</template>
