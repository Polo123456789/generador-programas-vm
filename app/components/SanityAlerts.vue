<script setup lang="ts">
import { computed } from 'vue'
import type { SanityFinding, SanityRule } from '~/utils/sanity'
import { SANITY_RULE_LABELS } from '~/utils/sanity'
import type { ProgramSlot } from '~/utils/programSlots'
import { getSanityActions } from '~/utils/sanityActions'

const props = defineProps<{
  findings: SanityFinding[]
  slots: ProgramSlot[]
}>()

const emit = defineEmits<{
  'open-assignment': [slotKey: string]
}>()
const { getParticipantName, participants } = useParticipants()
const actionsByFinding = computed(() => new Map(props.findings.map(finding => [
  finding.id,
  getSanityActions(finding, props.slots, participants.value),
])))

const groups = computed(() => {
  const grouped = new Map<SanityRule, SanityFinding[]>()
  props.findings.forEach((finding) => {
    const group = grouped.get(finding.rule) ?? []
    group.push(finding)
    grouped.set(finding.rule, group)
  })
  return [...grouped.entries()]
})

function participantNames(finding: SanityFinding): string {
  return finding.participantIds.map(getParticipantName).join(' y ')
}

function unique(values: string[]): string {
  return [...new Set(values)].join('; ')
}
</script>

<template>
  <section v-if="findings.length" class="dont-print mx-4 mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
    <div class="mb-3 flex items-start gap-3">
      <span aria-hidden="true" class="text-xl">ⓘ</span>
      <div>
        <h2 class="font-bold text-amber-950">Revisiones sugeridas ({{ findings.length }})</h2>
        <p class="text-sm text-amber-900">
          Son avisos informativos. No impiden guardar ni modifican el programa.
        </p>
      </div>
    </div>

    <div class="space-y-4">
      <div v-for="[rule, ruleFindings] in groups" :key="rule">
        <h3 class="mb-1 font-semibold text-amber-950">{{ SANITY_RULE_LABELS[rule] }}</h3>
        <ul class="list-disc space-y-1 pl-5 text-sm text-amber-950">
          <li v-for="finding in ruleFindings" :key="finding.id">
            <strong>{{ participantNames(finding) }}:</strong> {{ finding.reason }}
            <span v-if="finding.weeks.length"> Semanas: {{ unique(finding.weeks) }}.</span>
            <span v-if="finding.assignments.length"> Partes: {{ unique(finding.assignments) }}.</span>
            <details v-if="actionsByFinding.get(finding.id)?.length" class="mt-1 mb-2">
              <summary class="w-fit cursor-pointer rounded font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-800">
                {{ finding.rule === 'lowFrequency' ? 'Ver partes compatibles' : 'Revisar asignaciones' }}
                ({{ actionsByFinding.get(finding.id)!.length }})
              </summary>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="action in actionsByFinding.get(finding.id)"
                  :key="action.key"
                  type="button"
                  class="rounded border border-amber-500 bg-white px-3 py-2 text-left hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-800"
                  :aria-label="`Abrir asignación: ${action.label}`"
                  @click="emit('open-assignment', action.key)"
                >
                  {{ action.label }} →
                </button>
              </div>
            </details>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
