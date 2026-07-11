<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'reset' | 'submit'
}>(), {
  type: 'button',
})
</script>

<template>
  <button
    :type="type"
    class="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <slot />
  </button>
</template>
