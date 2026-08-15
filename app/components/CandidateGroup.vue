<script setup lang="ts">
import type { ParticipantRecommendation } from '~/utils/participantRecommendations'

interface Props {
  candidates: ParticipantRecommendation[]
  label: string
  tone: 'blue' | 'pink'
  emptyHistoryLabel: string
  showWeekPreview?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  select: [participantId: string]
}>()

function historyLabel(candidate: ParticipantRecommendation): string {
  return candidate.lastAssignmentDate
    ? `Última participación: ${candidate.lastAssignmentDate}`
    : props.emptyHistoryLabel
}
</script>

<template>
  <section>
    <h3
      class="mb-3 border-b pb-2 font-bold"
      :class="tone === 'blue' ? 'border-blue-200 text-blue-800' : 'border-pink-200 text-pink-800'"
    >
      {{ label }}
    </h3>
    <p v-if="candidates.length === 0" class="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-500">
      No hay estudiantes disponibles
    </p>
    <div v-else class="space-y-2">
      <button
        v-for="(candidate, index) in candidates"
        :key="candidate.participant.id"
        type="button"
        class="w-full rounded-xl border p-4 text-left transition hover:border-amber-400 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
        :class="index === 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'"
        @click="emit('select', candidate.participant.id)"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-semibold text-gray-950">{{ candidate.participant.name }}</span>
          <span v-if="index === 0" class="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
            Recomendado
          </span>
        </div>
        <p class="mt-1 text-sm text-gray-600">
          <AssignmentWeekTooltip
            v-if="showWeekPreview && candidate.lastAssignment"
            :assignment="candidate.lastAssignment"
            :participant-id="candidate.participant.id"
          >
            {{ historyLabel(candidate) }}
          </AssignmentWeekTooltip>
          <template v-else>{{ historyLabel(candidate) }}</template>
        </p>
      </button>
    </div>
  </section>
</template>
