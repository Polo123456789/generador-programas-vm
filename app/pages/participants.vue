<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AppBackup, BackupSummary } from '~/utils/backup'
import { createBackup, parseBackup, summarizeBackup } from '~/utils/backup'
import type { ParticipantGender, ParticipantRole } from '~/utils/participants'
import { PARTICIPANT_ROLE_LABELS, PARTICIPANT_ROLES } from '~/utils/participants'

const {
  addParticipant,
  getLastAssignmentDate,
  legacyMigrationAvailable,
  migrateLegacyData,
  participants,
  assignmentHistory,
  renameParticipant,
  replaceParticipantData,
  setParticipantRoles,
  toggleParticipantHidden,
} = useParticipants()
const { program, restoreProgram } = usePersistentProgram()
const sourceUrl = useLocalStorage<string>('lastAssignmentsURL', '')

const newParticipantName = ref('')
const newParticipantGender = ref<ParticipantGender>('M')
const newParticipantRoles = ref<ParticipantRole[]>(['school', 'reading'])
const formMessage = ref('')
const formError = ref('')
const pendingBackup = ref<AppBackup | null>(null)
const pendingBackupSummary = ref<BackupSummary | null>(null)
const backupError = ref('')
const backupMessage = ref('')
const editingParticipantId = ref<string | null>(null)
const editingParticipantName = ref('')
const renameError = ref('')

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

function downloadBackup(): void {
  backupError.value = ''
  const backup = createBackup(
    program.value,
    participants.value,
    assignmentHistory.value,
    sourceUrl.value ?? '',
  )
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `generador-programas-respaldo-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(downloadUrl)
  backupMessage.value = 'Respaldo descargado.'
}

async function inspectBackup(event: Event): Promise<void> {
  backupError.value = ''
  backupMessage.value = ''
  pendingBackup.value = null
  pendingBackupSummary.value = null
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const backup = parseBackup(await file.text())
    pendingBackup.value = backup
    pendingBackupSummary.value = summarizeBackup(backup)
  } catch (error) {
    backupError.value = error instanceof Error ? error.message : 'No se pudo leer el respaldo.'
  }
}

function restorePendingBackup(): void {
  if (!pendingBackup.value) return
  const backup = pendingBackup.value
  replaceParticipantData(backup.participants, backup.assignmentHistory)
  restoreProgram(backup.program)
  sourceUrl.value = backup.sourceUrl
  pendingBackup.value = null
  pendingBackupSummary.value = null
  backupMessage.value = 'Respaldo restaurado. El padrón, historial y programa fueron reemplazados.'
}

function cancelPendingBackup(): void {
  pendingBackup.value = null
  pendingBackupSummary.value = null
}

function startRename(participantId: string, currentName: string): void {
  editingParticipantId.value = participantId
  editingParticipantName.value = currentName
  renameError.value = ''
}

function saveRename(): void {
  if (!editingParticipantId.value) return
  try {
    renameParticipant(editingParticipantId.value, editingParticipantName.value)
    editingParticipantId.value = null
    editingParticipantName.value = ''
    renameError.value = ''
  } catch (error) {
    renameError.value = error instanceof Error ? error.message : 'No se pudo cambiar el nombre.'
  }
}

function cancelRename(): void {
  editingParticipantId.value = null
  editingParticipantName.value = ''
  renameError.value = ''
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

      <section class="mb-6 rounded-lg border border-gray-300 bg-white p-4">
        <h2 class="font-semibold">Respaldo y restauración</h2>
        <p class="my-2 text-sm text-gray-600">
          El respaldo incluye el programa actual, participantes, aptitudes, historial y URL de origen.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button @click="downloadBackup">Descargar respaldo</Button>
          <label class="cursor-pointer rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-800">
            Revisar respaldo
            <input class="sr-only" type="file" accept="application/json,.json" @change="inspectBackup">
          </label>
        </div>

        <div v-if="pendingBackupSummary" class="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p class="font-semibold">Contenido listo para restaurar</p>
          <p>Exportado: {{ new Date(pendingBackupSummary.exportedAt).toLocaleString() }}</p>
          <p>
            {{ pendingBackupSummary.participants }} participantes ·
            {{ pendingBackupSummary.historyRecords }} registros históricos ·
            <span v-if="pendingBackupSummary.hasProgram">
              programa de {{ pendingBackupSummary.weeks }} semanas
            </span>
            <span v-else>sin programa guardado</span>
          </p>
          <p class="my-2 font-medium text-amber-900">
            Restaurar reemplazará todos los datos actuales. Nada se modifica hasta confirmar aquí.
          </p>
          <div class="flex gap-2">
            <Button @click="restorePendingBackup">Confirmar restauración</Button>
            <button type="button" class="rounded border border-gray-400 px-4 py-2" @click="cancelPendingBackup">
              Cancelar
            </button>
          </div>
        </div>
        <p v-if="backupError" class="mt-2 text-sm text-red-700">{{ backupError }}</p>
        <p v-if="backupMessage" class="mt-2 text-sm text-green-700">{{ backupMessage }}</p>
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
                <template v-if="editingParticipantId === participant.id">
                  <div class="flex flex-wrap gap-2">
                    <input
                      v-model="editingParticipantName"
                      :aria-label="`Nuevo nombre para ${participant.name}`"
                      class="rounded border px-2 py-1"
                      type="text"
                      @keyup.enter="saveRename"
                    >
                    <button type="button" class="rounded bg-blue-700 px-3 py-1 text-sm text-white" @click="saveRename">
                      Guardar nombre
                    </button>
                    <button type="button" class="rounded border px-3 py-1 text-sm" @click="cancelRename">
                      Cancelar
                    </button>
                  </div>
                  <p v-if="renameError" class="mt-1 text-sm text-red-700">
                    {{ renameError }}
                  </p>
                </template>
                <h3 v-else class="font-semibold">{{ participant.name }}</h3>
                <p class="text-sm">
                  {{ participant.gender === 'M' ? 'Masculino' : 'Femenino' }} ·
                  Última asignación: {{ getLastAssignmentDate(participant.id) ?? 'Nunca' }}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded border border-gray-400 px-3 py-1 text-sm"
                  @click="startRename(participant.id, participant.name)"
                >
                  Renombrar
                </button>
                <button
                  class="rounded px-3 py-1 text-sm text-white"
                  :class="participant.hidden ? 'bg-green-700' : 'bg-gray-700'"
                  type="button"
                  @click="toggleParticipantHidden(participant.id)"
                >
                  {{ participant.hidden ? 'Activar' : 'Ocultar' }}
                </button>
              </div>
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
