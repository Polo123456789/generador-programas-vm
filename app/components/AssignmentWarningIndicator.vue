<script setup lang="ts">
import { computed, useId } from 'vue'
import type { SanityFinding } from '~/utils/sanity'
import { SANITY_RULE_LABELS } from '~/utils/sanity'

const props = defineProps<{
  findings: SanityFinding[]
}>()

const { getParticipantName } = useParticipants()
const tooltipId = `assignment-warning-${useId()}`
const messages = computed(() => props.findings.map(finding => ({
  id: finding.id,
  label: SANITY_RULE_LABELS[finding.rule],
  participants: finding.participantIds.map(getParticipantName).join(' y '),
  reason: finding.reason,
})))
const accessibleLabel = computed(() => (
  `Avisos de esta asignación: ${messages.value
    .map(message => `${message.label}. ${message.participants}: ${message.reason}`)
    .join(' ')}`
))
</script>

<template>
  <span v-if="findings.length" class="dont-print group relative ml-1 inline-flex align-middle">
    <button
      type="button"
      class="inline-flex size-5 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800 ring-1 ring-amber-400 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-600"
      :aria-describedby="tooltipId"
      :aria-label="accessibleLabel"
    >
      !
    </button>
    <span
      :id="tooltipId"
      role="tooltip"
      class="pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-2 w-80 max-w-[80vw] -translate-x-1/2 space-y-2 rounded-lg bg-gray-950 p-3 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    >
      <span
        v-for="message in messages"
        :key="message.id"
        class="block"
      >
        <strong class="font-semibold text-amber-200">{{ message.label }}</strong><br>
        <strong>{{ message.participants }}:</strong> {{ message.reason }}
      </span>
    </span>
  </span>
</template>
