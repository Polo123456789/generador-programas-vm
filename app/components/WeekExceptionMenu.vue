<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MeetingException } from '~/utils/assignments'

interface Props {
  exception?: MeetingException
  weekDate: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  cancelMeeting: []
  markCircuitOverseerVisit: []
  clearCircuitOverseerVisit: []
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const isVisit = computed(() => props.exception?.type === 'circuitOverseerVisit')

function closeAndEmit(action: 'cancel' | 'markVisit' | 'clearVisit'): void {
  open.value = false
  if (action === 'cancel') emit('cancelMeeting')
  if (action === 'markVisit') emit('markCircuitOverseerVisit')
  if (action === 'clearVisit') emit('clearCircuitOverseerVisit')
}

function handleOutsidePointer(event: PointerEvent): void {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointer))
</script>

<template>
  <div ref="root" class="dont-print relative shrink-0" @keydown.esc.stop="open = false">
    <button
      type="button"
      class="flex size-7 items-center justify-center rounded text-xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="`Opciones especiales para ${weekDate}`"
      @click="open = !open"
    >
      <span aria-hidden="true">⋯</span>
    </button>

    <div
      v-if="open"
      role="menu"
      class="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm font-normal shadow-lg"
    >
      <template v-if="!exception">
        <button
          type="button"
          role="menuitem"
          class="block w-full px-4 py-2 text-left text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
          @click="closeAndEmit('cancel')"
        >
          Cancelar reunión
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full px-4 py-2 text-left text-gray-800 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          @click="closeAndEmit('markVisit')"
        >
          Marcar visita del superintendente
        </button>
      </template>
      <button
        v-else-if="isVisit"
        type="button"
        role="menuitem"
        class="block w-full px-4 py-2 text-left text-gray-800 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
        @click="closeAndEmit('clearVisit')"
      >
        Quitar visita del superintendente
      </button>
    </div>
  </div>
</template>
