import { onScopeDispose, watch, type Ref } from 'vue'
import type { AppState, ProgramSnapshot } from '~/types/domain'
import {
  canonicalAppStatePayload,
  cloneAppState,
  createEmptyAppState,
} from '~/utils/appState'
import {
  APP_STORAGE_KEY,
  decodeStoredSnapshot,
  loadAppState,
  readBackupSnapshot,
  saveAppState,
  type StorageLike,
  type StoredSnapshot,
} from '~/utils/persistence'

export type PersistenceStatus = 'conflict' | 'error' | 'idle' | 'saved' | 'saving' | 'volatile'

interface PersistenceController {
  acceptExternalChanges: () => void
  flush: (force?: boolean) => boolean
  keepLocalChanges: () => boolean
  restoreBackup: () => boolean
}

const AUTOSAVE_DELAY_MS = 350

let activeController: PersistenceController | null = null

export function useAppStateRef(): Ref<AppState> {
  return useState<AppState>('app-state', createEmptyAppState)
}

export function usePersistenceStatus() {
  const status = useState<PersistenceStatus>('persistence-status', () => 'idle')
  const ready = useState<boolean>('persistence-ready', () => false)
  const lastSavedAt = useState<string | null>('persistence-saved-at', () => null)
  const lastError = useState<string | null>('persistence-error', () => null)
  const warning = useState<string | null>('persistence-warning', () => null)
  const externalSnapshot = useState<StoredSnapshot | null>('persistence-external', () => null)

  return {
    status,
    ready,
    lastSavedAt,
    lastError,
    warning,
    externalSnapshot,
    acceptExternalChanges: (): void => activeController?.acceptExternalChanges(),
    dismissWarning: (): void => {
      warning.value = null
    },
    flush: (): boolean => activeController?.flush() ?? false,
    keepLocalChanges: (): boolean => activeController?.keepLocalChanges() ?? false,
    restoreBackup: (): boolean => activeController?.restoreBackup() ?? false,
  }
}

export function useAppPersistence(): ReturnType<typeof usePersistenceStatus> {
  const state = useAppStateRef()
  const persistence = usePersistenceStatus()

  if (!import.meta.client || activeController) return persistence

  let storage: StorageLike
  try {
    storage = window.localStorage
  }
  catch {
    storage = {
      getItem: () => {
        throw new Error('El navegador bloqueó el almacenamiento local.')
      },
      setItem: () => {
        throw new Error('El navegador bloqueó el almacenamiento local.')
      },
    }
  }
  let revision = 0
  let lastSavedPayload = ''
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let suppressWatch = true

  const setStateWithoutSaving = (nextState: AppState): void => {
    suppressWatch = true
    useState<ProgramSnapshot | null>('program-undo', () => null).value = null
    state.value = cloneAppState(nextState)
    suppressWatch = false
  }

  const applySnapshot = (snapshot: StoredSnapshot): void => {
    setStateWithoutSaving(snapshot.data)
    revision = snapshot.revision
    lastSavedPayload = canonicalAppStatePayload(snapshot.data) ?? ''
    persistence.lastSavedAt.value = snapshot.savedAt
    persistence.lastError.value = null
    persistence.externalSnapshot.value = null
    persistence.status.value = 'saved'
  }

  const flush = (force = false): boolean => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }

    const payload = canonicalAppStatePayload(state.value)
    if (!force && payload !== null && payload === lastSavedPayload) {
      if (persistence.status.value !== 'volatile') persistence.status.value = 'saved'
      return true
    }

    persistence.status.value = 'saving'
    persistence.lastError.value = null
    const result = saveAppState(
      storage,
      state.value,
      revision,
      force,
      lastSavedPayload || undefined,
    )

    if (!result.ok) {
      persistence.lastError.value = result.error
      if (result.kind === 'conflict') {
        persistence.externalSnapshot.value = result.external
        persistence.status.value = 'conflict'
      }
      else {
        persistence.status.value = 'volatile'
      }
      return false
    }

    revision = result.snapshot.revision
    lastSavedPayload = canonicalAppStatePayload(result.snapshot.data) ?? ''
    persistence.lastSavedAt.value = result.snapshot.savedAt
    persistence.externalSnapshot.value = null
    persistence.status.value = 'saved'
    if (result.warning) persistence.warning.value = result.warning
    return true
  }

  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    persistence.status.value = 'saving'
    saveTimer = setTimeout(() => flush(), AUTOSAVE_DELAY_MS)
  }

  const acceptExternalChanges = (): void => {
    const external = persistence.externalSnapshot.value
    if (external) applySnapshot(external)
  }

  const keepLocalChanges = (): boolean => {
    const external = persistence.externalSnapshot.value
    if (external) revision = external.revision
    return flush(true)
  }

  const restoreBackup = (): boolean => {
    if (!flush()) {
      persistence.lastError.value = 'No se pudo guardar el borrador actual antes de restaurar el respaldo.'
      return false
    }

    const backup = readBackupSnapshot(storage)
    if (!backup) {
      persistence.lastError.value = 'No hay un respaldo anterior disponible.'
      return false
    }

    setStateWithoutSaving(backup.data)
    return flush(true)
  }

  activeController = {
    acceptExternalChanges,
    flush,
    keepLocalChanges,
    restoreBackup,
  }

  const loaded = loadAppState(storage)
  setStateWithoutSaving(loaded.data)
  revision = loaded.revision
  lastSavedPayload = loaded.needsSave ? '' : canonicalAppStatePayload(loaded.data) ?? ''
  persistence.lastSavedAt.value = loaded.savedAt
  persistence.warning.value = loaded.warning
  persistence.lastError.value = loaded.error
  persistence.status.value = loaded.error ? 'volatile' : loaded.savedAt ? 'saved' : 'idle'
  persistence.ready.value = true
  suppressWatch = false

  const stopWatch = watch(state, () => {
    if (!suppressWatch) scheduleSave()
  }, { deep: true, flush: 'sync' })

  if (loaded.needsSave) scheduleSave()

  const handleStorage = (event: StorageEvent): void => {
    if (event.key !== APP_STORAGE_KEY || !event.newValue) return
    const external = decodeStoredSnapshot(event.newValue)
    if (!external || external.revision < revision) return

    const externalPayload = canonicalAppStatePayload(external.data) ?? ''
    if (external.revision === revision && externalPayload === lastSavedPayload) return

    if (external.revision === revision) {
      persistence.externalSnapshot.value = external
      persistence.lastError.value = 'Otra pestaña guardó una versión distinta al mismo tiempo.'
      persistence.status.value = 'conflict'
      return
    }

    const isClean = !saveTimer && canonicalAppStatePayload(state.value) === lastSavedPayload
    if (isClean) {
      applySnapshot(external)
      persistence.warning.value = 'Se aplicaron cambios guardados en otra pestaña.'
    }
    else {
      persistence.externalSnapshot.value = external
      persistence.lastError.value = 'Otra pestaña guardó cambios mientras editabas.'
      persistence.status.value = 'conflict'
    }
  }

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') flush()
  }

  const handlePageHide = (): void => {
    flush()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener('pagehide', handlePageHide)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  onScopeDispose(() => {
    flush()
    stopWatch()
    if (saveTimer) clearTimeout(saveTimer)
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('pagehide', handlePageHide)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    activeController = null
  })

  return persistence
}
