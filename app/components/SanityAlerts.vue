<script setup lang="ts">
import { computed } from 'vue'
import type { SanityFinding, SanityRule } from '~/utils/sanity'
import { SANITY_RULE_LABELS } from '~/utils/sanity'

const props = defineProps<{
  findings: SanityFinding[]
}>()

const { getParticipantName } = useParticipants()

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
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
