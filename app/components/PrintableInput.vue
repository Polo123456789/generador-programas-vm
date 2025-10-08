<script setup lang="ts">
const text = defineModel<string>('');
</script>

<template>
    <input type="text" v-model="text" />
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
