import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'
import type { Assingments } from '~/utils/assingments'

interface AssignmentsStorageMeta {
  bytes: number
  savedAt: string
  weeks: number
}

const ASSIGNMENTS_KEY = 'assingments'
const ASSIGNMENTS_BACKUP_KEY = 'assingments:backup'
const ASSIGNMENTS_META_KEY = 'assingments:meta'
const AUTOSAVE_DELAY_MS = 400

let globalAssignments: Ref<Assingments[]> | null = null
const globalSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const globalLastSavedAt = ref<string | null>(null)
const globalLastSaveError = ref<string | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedPayload: string | null = null
let storageInitialized = false
let storageUsageCount = 0
let removeStorageListeners: (() => void) | null = null
const flushPendingSave = () => {
  saveNow()
}

export function usePersistentAssignments() {
  if (!globalAssignments) {
    globalAssignments = ref<Assingments[]>([])
  }

  const assignments = globalAssignments
  const saveStatus = globalSaveStatus
  const lastSavedAt = globalLastSavedAt
  const lastSaveError = globalLastSaveError

  function parseStoredAssignments(rawValue: string | null): Assingments[] | null {
    if (!rawValue) return null

    try {
      const parsed = JSON.parse(rawValue) as unknown
      return Array.isArray(parsed) ? parsed as Assingments[] : null
    } catch {
      return null
    }
  }

  function loadMeta(): void {
    const rawMeta = window.localStorage.getItem(ASSIGNMENTS_META_KEY)
    if (!rawMeta) return

    try {
      const parsed = JSON.parse(rawMeta) as Partial<AssignmentsStorageMeta>
      if (typeof parsed.savedAt === 'string') {
        lastSavedAt.value = parsed.savedAt
      }
    } catch {
      lastSavedAt.value = null
    }
  }

  function writeMeta(payload: string): void {
    const meta: AssignmentsStorageMeta = {
      bytes: payload.length,
      savedAt: new Date().toISOString(),
      weeks: assignments.value.length,
    }

    window.localStorage.setItem(ASSIGNMENTS_META_KEY, JSON.stringify(meta))
    lastSavedAt.value = meta.savedAt
  }

  function saveNow(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }

    const payload = JSON.stringify(assignments.value)
    if (payload === lastSavedPayload) {
      saveStatus.value = 'saved'
      return
    }

    saveStatus.value = 'saving'
    lastSaveError.value = null

    try {
      window.localStorage.setItem(ASSIGNMENTS_KEY, payload)

      // Keep the last known non-empty snapshot as a fallback.
      if (assignments.value.length > 0) {
        window.localStorage.setItem(ASSIGNMENTS_BACKUP_KEY, payload)
      }

      writeMeta(payload)
      lastSavedPayload = payload
      saveStatus.value = 'saved'
    } catch (error) {
      saveStatus.value = 'error'
      lastSaveError.value = error instanceof Error ? error.message : 'No se pudo guardar el borrador'
    }
  }

  function scheduleSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }

    saveStatus.value = 'saving'
    saveTimer = setTimeout(() => {
      saveNow()
    }, AUTOSAVE_DELAY_MS)
  }

  function replaceAssignments(nextAssignments: Assingments[]): void {
    assignments.value = nextAssignments
    saveNow()
  }

  function clearAssignments(): void {
    assignments.value = []
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }

    window.localStorage.removeItem(ASSIGNMENTS_KEY)
    window.localStorage.removeItem(ASSIGNMENTS_BACKUP_KEY)
    window.localStorage.removeItem(ASSIGNMENTS_META_KEY)

    lastSavedPayload = '[]'
    lastSavedAt.value = null
    lastSaveError.value = null
    saveStatus.value = 'idle'
  }

  if (import.meta.client && !storageInitialized) {
    storageInitialized = true

    const storedAssignments = parseStoredAssignments(window.localStorage.getItem(ASSIGNMENTS_KEY))
    const backupAssignments = parseStoredAssignments(window.localStorage.getItem(ASSIGNMENTS_BACKUP_KEY))

    assignments.value = storedAssignments ?? backupAssignments ?? []
    lastSavedPayload = JSON.stringify(assignments.value)
    loadMeta()

    if (!storedAssignments && backupAssignments) {
      saveNow()
    }

    watch(assignments, () => {
      scheduleSave()
    }, { deep: true, flush: 'sync' })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSave()
      }
    }

    window.addEventListener('pagehide', flushPendingSave)
    window.addEventListener('beforeunload', flushPendingSave)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    removeStorageListeners = () => {
      window.removeEventListener('pagehide', flushPendingSave)
      window.removeEventListener('beforeunload', flushPendingSave)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  storageUsageCount += 1

  onScopeDispose(() => {
    storageUsageCount -= 1

    if (storageUsageCount <= 0) {
      flushPendingSave()
      removeStorageListeners?.()
      removeStorageListeners = null
      storageInitialized = false
      storageUsageCount = 0
    }
  })

  return {
    assignments,
    clearAssignments,
    lastSavedAt,
    lastSaveError,
    replaceAssignments,
    saveNow,
    saveStatus,
  }
}
