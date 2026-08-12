<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ParticipantGender, ParticipantRole } from '~/utils/participants'
import { PARTICIPANT_ROLE_LABELS, PARTICIPANT_ROLES } from '~/utils/participants'

const {
  addParticipant,
  getLastAssignmentDate,
  legacyMigrationAvailable,
  migrateLegacyData,
  participants,
  setParticipantRoles,
  toggleParticipantHidden,
} = useParticipants()

const newParticipantName = ref('')
const newParticipantGender = ref<ParticipantGender>('M')
const newParticipantRoles = ref<ParticipantRole[]>(['school', 'reading'])
const formMessage = ref('')
const formError = ref('')

const sortedParticipants = computed(() => (
  [...participants.value].sort((left, right) => left.name.localeCompare(right.name))
))

function handleAddParticipant(): void {
  formError.value = ''
  formMessage.value = ''
  const name = newParticipantName.value.trim()

  if (!name) {
    formError.value = 'El nombre es requerido'
    return
  }

  if (participants.value.some(participant => participant.name.localeCompare(name, undefined, { sensitivity: 'base' }) === 0)) {
    formError.value = 'Ya existe un participante con ese nombre'
    return
  }

  addParticipant(name, newParticipantGender.value, newParticipantRoles.value)
  newParticipantName.value = ''
  newParticipantGender.value = 'M'
  newParticipantRoles.value = ['school', 'reading']
}

function toggleRole(participantId: string, currentRoles: ParticipantRole[], role: ParticipantRole): void {
  const roles = currentRoles.includes(role)
    ? currentRoles.filter(candidate => candidate !== role)
    : [...currentRoles, role]
  setParticipantRoles(participantId, roles)
}

function toggleNewRole(role: ParticipantRole): void {
  newParticipantRoles.value = newParticipantRoles.value.includes(role)
    ? newParticipantRoles.value.filter(candidate => candidate !== role)
    : [...newParticipantRoles.value, role]
}

function handleMigration(): void {
  formError.value = ''
  try {
    const result = migrateLegacyData()
    formMessage.value = `Migración terminada: ${result.participants} participantes y ${result.historyRecords} registros históricos incorporados.`
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'No se pudo completar la migración'
  }
}
</script>

<template>
  <main class="container p-4">
    <div class="dont-print mb-6">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">Gestión de Participantes</h1>
        <NuxtLink to="/" class="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">
          Volver al Programa
        </NuxtLink>
      </div>

      <section v-if="legacyMigrationAvailable" class="mb-6 rounded-lg border border-blue-300 bg-blue-50 p-4">
        <h2 class="font-semibold text-blue-900">Datos anteriores disponibles</h2>
        <p class="my-2 text-sm text-blue-900">
          Puedes importar el padrón y el historial de fechas y parejas. El programa anterior no se importará.
        </p>
        <Button @click="handleMigration">Migrar padrón e historial</Button>
      </section>

      <section class="mb-6 rounded-lg bg-gray-50 p-4">
        <h2 class="mb-3 text-lg font-semibold">Añadir participante</h2>
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-64 flex-1">
            <label for="new-participant-name" class="mb-1 block text-sm font-medium">Nombre</label>
            <input
              id="new-participant-name"
              v-model="newParticipantName"
              type="text"
              class="w-full rounded border px-3 py-2"
              placeholder="Nombre del participante"
              @keyup.enter="handleAddParticipant"
            >
          </div>
          <div>
            <label for="new-participant-gender" class="mb-1 block text-sm font-medium">Género</label>
            <select id="new-participant-gender" v-model="newParticipantGender" class="rounded border px-3 py-2">
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
          <Button @click="handleAddParticipant">Añadir</Button>
        </div>

        <div v-if="newParticipantGender === 'M'" class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label v-for="role in PARTICIPANT_ROLES" :key="role" class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              :checked="newParticipantRoles.includes(role)"
              @change="toggleNewRole(role)"
            >
            {{ PARTICIPANT_ROLE_LABELS[role] }}
          </label>
        </div>
        <p v-else class="mt-3 text-sm text-gray-600">
          Las mujeres quedan habilitadas únicamente para Seamos Mejores Maestros.
        </p>
        <p v-if="formError" class="mt-2 text-sm text-red-700">{{ formError }}</p>
        <p v-if="formMessage" class="mt-2 text-sm text-green-700">{{ formMessage }}</p>
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Lista de participantes</h2>
        <div v-if="participants.length === 0" class="py-8 text-center text-gray-500">
          No hay participantes registrados.
        </div>

        <div v-else class="space-y-3">
          <article
            v-for="participant in sortedParticipants"
            :key="participant.id"
            class="rounded border p-4"
            :class="participant.hidden ? 'bg-gray-100 text-gray-500' : 'bg-white'"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 class="font-semibold">{{ participant.name }}</h3>
                <p class="text-sm">
                  {{ participant.gender === 'M' ? 'Masculino' : 'Femenino' }} ·
                  Última asignación: {{ getLastAssignmentDate(participant.id) ?? 'Nunca' }}
                </p>
              </div>
              <button
                class="rounded px-3 py-1 text-sm text-white"
                :class="participant.hidden ? 'bg-green-700' : 'bg-gray-700'"
                type="button"
                @click="toggleParticipantHidden(participant.id)"
              >
                {{ participant.hidden ? 'Activar' : 'Ocultar' }}
              </button>
            </div>

            <div v-if="participant.gender === 'M'" class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label v-for="role in PARTICIPANT_ROLES" :key="role" class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="participant.eligibleRoles.includes(role)"
                  @change="toggleRole(participant.id, participant.eligibleRoles, role)"
                >
                {{ PARTICIPANT_ROLE_LABELS[role] }}
              </label>
            </div>
            <p v-else class="mt-3 text-sm">Habilitada para Seamos Mejores Maestros.</p>
          </article>
        </div>
      </section>

      <p class="mt-6 text-sm text-gray-600">
        Ocultar o cambiar aptitudes conserva las asignaciones existentes; el programa mostrará una alerta informativa cuando corresponda.
      </p>
    </div>
  </main>
</template>
