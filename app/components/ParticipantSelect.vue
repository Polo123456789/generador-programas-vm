<script setup lang="ts">
import { computed } from 'vue'
import type { Participant, ParticipantRole } from '~/utils/participants'

interface Props {
  modelValue: string | null
  role: ParticipantRole
  accessibleName: string
  sameGenderAsId?: string | null
  excludeIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  sameGenderAsId: null,
  excludeIds: () => [],
})
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const {
  assignmentHistory,
  getEligibleParticipants,
  getParticipantName,
  participants,
} = useParticipants()

const options = computed(() => {
  const excluded = new Set(props.excludeIds)
  const latestAssignment = new Map<string, number>()
  assignmentHistory.value.forEach(record => {
    record.participantIds.forEach((participantId) => {
      latestAssignment.set(
        participantId,
        Math.max(
          latestAssignment.get(participantId) ?? 0,
          record.chronologicalOrder ?? record.updatedAt,
        ),
      )
    })
  })

  const eligible = getEligibleParticipants(props.role, props.sameGenderAsId)
    .filter(participant => !excluded.has(participant.id))
    .sort((left, right) => {
      const dateDifference = (latestAssignment.get(left.id) ?? 0) - (latestAssignment.get(right.id) ?? 0)
      return dateDifference || left.name.localeCompare(right.name)
    })

  if (!props.modelValue || eligible.some(participant => participant.id === props.modelValue)) {
    return eligible
  }

  const current = participants.value.find(participant => participant.id === props.modelValue)
  return current ? [current, ...eligible] : eligible
})

function optionLabel(participant: Participant): string {
  const isEligible = getEligibleParticipants(props.role, props.sameGenderAsId)
    .some(candidate => candidate.id === participant.id)
  return isEligible ? participant.name : `${participant.name} (no disponible)`
}

function updateValue(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  emit('update:modelValue', value || null)
}
</script>

<template>
  <select
    class="dont-print w-full rounded border border-gray-300 bg-white px-2 py-1"
    :aria-label="accessibleName"
    :value="modelValue ?? ''"
    @change="updateValue"
  >
    <option value="">Sin asignar</option>
    <option v-for="participant in options" :key="participant.id" :value="participant.id">
      {{ optionLabel(participant) }}
    </option>
  </select>
  <span class="only-print">{{ getParticipantName(modelValue) }}</span>
</template>
