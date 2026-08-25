<script setup lang="ts">
interface Props {
  accessibleName?: string
}

defineProps<Props>()
const text = defineModel<string>({ required: true })
</script>

<template>
    <input v-model="text" type="text" :aria-label="accessibleName">
</template>

<style scoped>
input {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 1px 4px;
    width: 98%;
    font-family: inherit;
    font-size: inherit;
}


@media print {
    input {
        border: none;
        background-color: transparent;
        padding: 1px 4px;
        width: 98%;
    }
}
</style>
