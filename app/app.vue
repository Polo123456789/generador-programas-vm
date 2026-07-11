<script setup lang="ts">
const { ready } = useAppPersistence()
</script>

<template>
  <AppStatusBanner />
  <NuxtPage v-if="ready" />
  <main v-else class="dont-print min-h-screen grid place-items-center p-6 text-gray-600">
    Cargando el borrador…
  </main>
</template>
