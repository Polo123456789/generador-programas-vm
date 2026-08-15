<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import type { AssignmentHistoryRecord } from '~/utils/participants'
import { getSchoolHistoryWeekRecords } from '~/utils/historyPreview'

interface Props {
  assignment: AssignmentHistoryRecord
  participantId: string
}

const props = defineProps<Props>()
const { assignmentHistory, getParticipantName } = useParticipants()
const trigger = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const tooltipPosition = ref<Record<string, string>>({})
let openTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

const weekAssignments = computed(() => (
  getSchoolHistoryWeekRecords(assignmentHistory.value, props.assignment)
))

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
  const placeBelow = availableBelow >= 240 || availableBelow >= availableAbove
  const availableHeight = Math.max(144, Math.min(384, placeBelow ? availableBelow : availableAbove))
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
    class="cursor-help border-b border-dotted border-gray-400"
    @mouseenter="scheduleOpen"
    @mouseleave="scheduleClose"
  >
    <slot />
  </span>

  <Teleport to="body">
    <aside
      v-if="isOpen"
      role="tooltip"
      class="dont-print fixed z-[70] flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-2xl"
      :style="tooltipPosition"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
    >
      <header class="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Seamos Mejores Maestros</p>
        <p class="mt-0.5 text-sm font-bold text-gray-950">{{ assignment.weekDate }}</p>
      </header>
      <ul class="min-h-0 overflow-y-auto p-2">
        <li
          v-for="weekAssignment in weekAssignments"
          :key="weekAssignment.id"
          class="rounded-lg px-3 py-2"
          :class="weekAssignment.participantIds.includes(participantId) ? 'bg-amber-50' : ''"
        >
          <p class="text-sm font-semibold text-gray-900">{{ weekAssignment.assignmentTitle }}</p>
          <p class="mt-0.5 text-xs text-gray-600">{{ participantNames(weekAssignment) }}</p>
        </li>
      </ul>
    </aside>
  </Teleport>
</template>
