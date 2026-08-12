import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'
import type { MeetingProgram, ProgramWeek } from '~/utils/assignments'
import { createMeetingProgram } from '~/utils/assignments'

interface ProgramStorageMeta {
  bytes: number
  savedAt: string
  weeks: number
}

const PROGRAM_KEY = 'meetingProgram:v2'
const PROGRAM_BACKUP_KEY = 'meetingProgram:v2:backup'
const PROGRAM_META_KEY = 'meetingProgram:v2:meta'
const AUTOSAVE_DELAY_MS = 400

let globalProgram: Ref<MeetingProgram | null> | null = null
const globalSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const globalLastSavedAt = ref<string | null>(null)
const globalLastSaveError = ref<string | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedPayload: string | null = null
let storageInitialized = false
let storageUsageCount = 0
let removeStorageListeners: (() => void) | null = null

export function usePersistentProgram() {
  globalProgram ??= ref<MeetingProgram | null>(null)

  const program = globalProgram
  const saveStatus = globalSaveStatus
  const lastSavedAt = globalLastSavedAt
  const lastSaveError = globalLastSaveError

  function parseStoredProgram(rawValue: string | null): MeetingProgram | null {
    if (!rawValue) return null
    try {
      const parsed = JSON.parse(rawValue) as Partial<MeetingProgram>
      if (typeof parsed.id !== 'string' || !Array.isArray(parsed.weeks)) return null
      return {
        ...parsed,
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      } as MeetingProgram
    } catch {
      return null
    }
  }

  function loadMeta(): void {
    const rawMeta = window.localStorage.getItem(PROGRAM_META_KEY)
    if (!rawMeta) return
    try {
      const parsed = JSON.parse(rawMeta) as Partial<ProgramStorageMeta>
      if (typeof parsed.savedAt === 'string') lastSavedAt.value = parsed.savedAt
    } catch {
      lastSavedAt.value = null
    }
  }

  function saveNow(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }

    const payload = JSON.stringify(program.value)
    if (payload === lastSavedPayload) {
      saveStatus.value = program.value ? 'saved' : 'idle'
      return
    }

    saveStatus.value = 'saving'
    lastSaveError.value = null

    try {
      if (program.value) {
        window.localStorage.setItem(PROGRAM_KEY, payload)
        window.localStorage.setItem(PROGRAM_BACKUP_KEY, payload)
        const meta: ProgramStorageMeta = {
          bytes: payload.length,
          savedAt: new Date().toISOString(),
          weeks: program.value.weeks.length,
        }
        window.localStorage.setItem(PROGRAM_META_KEY, JSON.stringify(meta))
        lastSavedAt.value = meta.savedAt
        saveStatus.value = 'saved'
      } else {
        window.localStorage.removeItem(PROGRAM_KEY)
        window.localStorage.removeItem(PROGRAM_BACKUP_KEY)
        window.localStorage.removeItem(PROGRAM_META_KEY)
        lastSavedAt.value = null
        saveStatus.value = 'idle'
      }
      lastSavedPayload = payload
    } catch (error) {
      saveStatus.value = 'error'
      lastSaveError.value = error instanceof Error ? error.message : 'No se pudo guardar el borrador'
    }
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveStatus.value = 'saving'
    saveTimer = setTimeout(saveNow, AUTOSAVE_DELAY_MS)
  }

  function replaceProgram(weeks: ProgramWeek[]): void {
    program.value = createMeetingProgram(weeks)
    saveNow()
  }

  function clearProgram(): void {
    program.value = null
    saveNow()
  }

  function restoreProgram(nextProgram: MeetingProgram | null): void {
    program.value = nextProgram
    saveNow()
  }

  if (import.meta.client && !storageInitialized) {
    storageInitialized = true
    const stored = parseStoredProgram(window.localStorage.getItem(PROGRAM_KEY))
    const backup = parseStoredProgram(window.localStorage.getItem(PROGRAM_BACKUP_KEY))
    program.value = stored ?? backup
    lastSavedPayload = stored ? JSON.stringify(program.value) : null
    loadMeta()
    if (!stored && backup) saveNow()

    watch(program, scheduleSave, { deep: true, flush: 'sync' })

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') saveNow()
    }
    window.addEventListener('pagehide', saveNow)
    window.addEventListener('beforeunload', saveNow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    removeStorageListeners = () => {
      window.removeEventListener('pagehide', saveNow)
      window.removeEventListener('beforeunload', saveNow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  storageUsageCount += 1
  onScopeDispose(() => {
    storageUsageCount -= 1
    if (storageUsageCount <= 0) {
      saveNow()
      removeStorageListeners?.()
      removeStorageListeners = null
      storageInitialized = false
      storageUsageCount = 0
    }
  })

  return {
    program,
    clearProgram,
    lastSavedAt,
    lastSaveError,
    replaceProgram,
    restoreProgram,
    saveNow,
    saveStatus,
  }
}
