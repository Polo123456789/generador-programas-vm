import type { AppState } from '~/types/domain'
import {
  APP_STATE_SCHEMA_VERSION,
  canonicalAppStatePayload,
  cloneAppState,
  createEmptyAppState,
  migrateLegacyState,
  parseAppState,
} from '~/utils/appState'

export const APP_STORAGE_KEY = 'generador-programas-vm:state'
export const APP_STORAGE_BACKUP_KEY = 'generador-programas-vm:state:backup'
export const APP_STORAGE_CORRUPT_KEY = 'generador-programas-vm:state:corrupt'

const LEGACY_SOURCE_URL_KEY = 'lastAssingmentsURL'
const LEGACY_WEEKS_KEY = 'assingments'
const LEGACY_WEEKS_BACKUP_KEY = 'assingments:backup'
const LEGACY_STUDENTS_KEY = 'students'
const LEGACY_HISTORY_KEY = 'assignmentHistory'

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface StoredSnapshot {
  schemaVersion: 1
  revision: number
  savedAt: string
  data: AppState
}

export type LoadSource = 'backup' | 'empty' | 'legacy' | 'primary'

export interface PersistenceLoadResult {
  data: AppState
  source: LoadSource
  revision: number
  savedAt: string | null
  warning: string | null
  error: string | null
  needsSave: boolean
}

export type PersistenceSaveResult
  = | { ok: true, snapshot: StoredSnapshot, rawValue: string, warning?: string }
    | { ok: false, kind: 'conflict', error: string, external: StoredSnapshot }
    | { ok: false, kind: 'storage' | 'validation', error: string }

interface StorageReadResult {
  ok: boolean
  value: string | null
  error: string | null
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'El navegador se quedó sin espacio para guardar el borrador.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'El navegador bloqueó el almacenamiento local.'
}

function readStorage(storage: StorageLike, key: string): StorageReadResult {
  try {
    return { ok: true, value: storage.getItem(key), error: null }
  }
  catch (error) {
    return { ok: false, value: null, error: errorMessage(error) }
  }
}

function writeStorage(storage: StorageLike, key: string, value: string): string | null {
  try {
    storage.setItem(key, value)
    return null
  }
  catch (error) {
    return errorMessage(error)
  }
}

export function decodeStoredSnapshot(rawValue: string | null): StoredSnapshot | null {
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const value = parsed as Record<string, unknown>
    if (value.schemaVersion !== APP_STATE_SCHEMA_VERSION
      || typeof value.savedAt !== 'string'
      || Number.isNaN(Date.parse(value.savedAt))
      || typeof value.revision !== 'number'
      || !Number.isSafeInteger(value.revision)
      || value.revision < 0) {
      return null
    }

    const data = parseAppState(value.data)
    if (!data) return null

    return {
      schemaVersion: APP_STATE_SCHEMA_VERSION,
      revision: value.revision,
      savedAt: value.savedAt,
      data,
    }
  }
  catch {
    return null
  }
}

export function encodeStoredSnapshot(snapshot: StoredSnapshot): string {
  return JSON.stringify(snapshot)
}

function preserveCorruptValue(storage: StorageLike, rawValue: string | null): void {
  if (!rawValue) return
  writeStorage(storage, APP_STORAGE_CORRUPT_KEY, rawValue)
}

function readLegacyState(storage: StorageLike): ReturnType<typeof migrateLegacyState> {
  const values = {
    sourceUrl: readStorage(storage, LEGACY_SOURCE_URL_KEY).value,
    weeks: readStorage(storage, LEGACY_WEEKS_KEY).value,
    weeksBackup: readStorage(storage, LEGACY_WEEKS_BACKUP_KEY).value,
    students: readStorage(storage, LEGACY_STUDENTS_KEY).value,
    assignmentHistory: readStorage(storage, LEGACY_HISTORY_KEY).value,
  }
  return migrateLegacyState(values)
}

export function loadAppState(storage: StorageLike): PersistenceLoadResult {
  const primaryRead = readStorage(storage, APP_STORAGE_KEY)
  if (!primaryRead.ok) {
    return {
      data: createEmptyAppState(),
      source: 'empty',
      revision: 0,
      savedAt: null,
      warning: 'Los datos funcionarán solo en memoria durante esta sesión.',
      error: primaryRead.error,
      needsSave: false,
    }
  }

  const primary = decodeStoredSnapshot(primaryRead.value)
  if (primary) {
    return {
      data: primary.data,
      source: 'primary',
      revision: primary.revision,
      savedAt: primary.savedAt,
      warning: null,
      error: null,
      needsSave: false,
    }
  }

  if (primaryRead.value) preserveCorruptValue(storage, primaryRead.value)

  const backupRead = readStorage(storage, APP_STORAGE_BACKUP_KEY)
  const backup = decodeStoredSnapshot(backupRead.value)
  if (backup) {
    const restoreError = writeStorage(storage, APP_STORAGE_KEY, backupRead.value!)
    return {
      data: backup.data,
      source: 'backup',
      revision: backup.revision,
      savedAt: backup.savedAt,
      warning: 'El borrador principal estaba dañado y se recuperó el respaldo anterior.',
      error: restoreError,
      needsSave: false,
    }
  }

  const legacy = readLegacyState(storage)
  if (legacy) {
    return {
      data: legacy,
      source: 'legacy',
      revision: 0,
      savedAt: null,
      warning: 'Se migraron los datos guardados por una versión anterior.',
      error: null,
      needsSave: true,
    }
  }

  const corruptWarning = primaryRead.value || backupRead.value
    ? 'Los datos guardados no eran compatibles. Se inició un borrador vacío sin cerrar la aplicación.'
    : null
  return {
    data: createEmptyAppState(),
    source: 'empty',
    revision: 0,
    savedAt: null,
    warning: corruptWarning,
    error: backupRead.error,
    needsSave: false,
  }
}

export function saveAppState(
  storage: StorageLike,
  data: AppState,
  expectedRevision: number,
  force = false,
  expectedPayload?: string,
): PersistenceSaveResult {
  const validated = parseAppState(cloneAppState(data))
  if (!validated) {
    return { ok: false, kind: 'validation', error: 'El estado actual no es válido y no se guardó.' }
  }

  const primaryRead = readStorage(storage, APP_STORAGE_KEY)
  if (!primaryRead.ok) {
    return { ok: false, kind: 'storage', error: primaryRead.error! }
  }

  const current = decodeStoredSnapshot(primaryRead.value)
  const currentPayload = current ? canonicalAppStatePayload(current.data) : null
  if (!force && current && (
    current.revision !== expectedRevision
    || (expectedPayload !== undefined && currentPayload !== expectedPayload)
  )) {
    return {
      ok: false,
      kind: 'conflict',
      error: 'Otra pestaña guardó cambios mientras editabas.',
      external: current,
    }
  }

  if (primaryRead.value && !current) preserveCorruptValue(storage, primaryRead.value)

  const snapshot: StoredSnapshot = {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    revision: Math.max(expectedRevision, current?.revision ?? 0) + 1,
    savedAt: new Date().toISOString(),
    data: validated,
  }
  const rawValue = encodeStoredSnapshot(snapshot)

  const saveError = writeStorage(storage, APP_STORAGE_KEY, rawValue)
  if (saveError) return { ok: false, kind: 'storage', error: saveError }

  if (current && primaryRead.value !== rawValue) {
    const backupError = writeStorage(storage, APP_STORAGE_BACKUP_KEY, primaryRead.value!)
    if (backupError) {
      const rollbackError = writeStorage(storage, APP_STORAGE_KEY, primaryRead.value!)
      if (!rollbackError) {
        return {
          ok: false,
          kind: 'storage',
          error: `No se pudo actualizar el respaldo; el borrador principal anterior fue restaurado. ${backupError}`,
        }
      }
      return {
        ok: true,
        snapshot,
        rawValue,
        warning: `El borrador se guardó, pero no se pudo actualizar el respaldo anterior. ${backupError}`,
      }
    }
  }

  return { ok: true, snapshot, rawValue }
}

export function readBackupSnapshot(storage: StorageLike): StoredSnapshot | null {
  const backupRead = readStorage(storage, APP_STORAGE_BACKUP_KEY)
  return backupRead.ok ? decodeStoredSnapshot(backupRead.value) : null
}
