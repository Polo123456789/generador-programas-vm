import { describe, expect, test } from 'bun:test'
import { createState } from './helpers'
import { canonicalAppStatePayload } from '../app/utils/appState'
import {
  APP_STORAGE_BACKUP_KEY,
  APP_STORAGE_KEY,
  decodeStoredSnapshot,
  encodeStoredSnapshot,
  loadAppState,
  saveAppState,
  type StorageLike,
  type StoredSnapshot,
} from '../app/utils/persistence'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  failReads = false
  failKey: string | null = null

  getItem(key: string): string | null {
    if (this.failReads) throw new Error('storage blocked')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failKey === key) throw new Error('write blocked')
    this.values.set(key, value)
  }
}

function snapshot(revision: number, sourceUrl: string): StoredSnapshot {
  const data = createState()
  data.sourceUrl = sourceUrl
  return {
    schemaVersion: 1,
    revision,
    savedAt: `2026-07-10T12:00:0${revision}.000Z`,
    data,
  }
}

describe('versioned persistence', () => {
  test('rejects malformed snapshot metadata', () => {
    const malformedRevision = { ...snapshot(1, 'value'), revision: -1 }
    const malformedDate = { ...snapshot(1, 'value'), savedAt: 'not-a-date' }

    expect(decodeStoredSnapshot(JSON.stringify(malformedRevision))).toBeNull()
    expect(decodeStoredSnapshot(JSON.stringify(malformedDate))).toBeNull()
  })

  test('keeps the prior valid primary as the backup', () => {
    const storage = new MemoryStorage()
    const first = saveAppState(storage, createState(), 0)
    expect(first.ok).toBeTrue()
    if (!first.ok) return

    const changed = createState()
    changed.sourceUrl = 'https://example.com/changed'
    const second = saveAppState(storage, changed, first.snapshot.revision)
    expect(second.ok).toBeTrue()

    const backup = decodeStoredSnapshot(storage.getItem(APP_STORAGE_BACKUP_KEY))
    expect(backup?.data.sourceUrl).toBe('https://example.com/programa')
    expect(decodeStoredSnapshot(storage.getItem(APP_STORAGE_KEY))?.data.sourceUrl).toBe(changed.sourceUrl)
  })

  test('does not touch primary when the backup cannot be updated', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_STORAGE_KEY, encodeStoredSnapshot(snapshot(1, 'before')))
    storage.failKey = APP_STORAGE_BACKUP_KEY

    const changed = createState()
    changed.sourceUrl = 'after'
    const result = saveAppState(storage, changed, 1)

    expect(result.ok).toBeFalse()
    expect(decodeStoredSnapshot(storage.getItem(APP_STORAGE_KEY))?.data.sourceUrl).toBe('before')
  })

  test('does not overwrite the previous backup when writing primary fails', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_STORAGE_KEY, encodeStoredSnapshot(snapshot(2, 'primary')))
    storage.setItem(APP_STORAGE_BACKUP_KEY, encodeStoredSnapshot(snapshot(1, 'older-backup')))
    storage.failKey = APP_STORAGE_KEY

    const changed = createState()
    changed.sourceUrl = 'new-value'
    const result = saveAppState(storage, changed, 2)

    expect(result.ok).toBeFalse()
    expect(decodeStoredSnapshot(storage.getItem(APP_STORAGE_KEY))?.data.sourceUrl).toBe('primary')
    expect(decodeStoredSnapshot(storage.getItem(APP_STORAGE_BACKUP_KEY))?.data.sourceUrl).toBe('older-backup')
  })

  test('recovers a corrupt primary from a valid backup', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_STORAGE_KEY, '[{}]')
    storage.setItem(APP_STORAGE_BACKUP_KEY, encodeStoredSnapshot(snapshot(4, 'backup')))

    const loaded = loadAppState(storage)

    expect(loaded.source).toBe('backup')
    expect(loaded.data.sourceUrl).toBe('backup')
    expect(decodeStoredSnapshot(storage.getItem(APP_STORAGE_KEY))?.revision).toBe(4)
  })

  test('recovers backup instead of silently dropping foreign participant references', () => {
    const storage = new MemoryStorage()
    const corrupt = snapshot(5, 'corrupt-primary')
    corrupt.data.weeks[0]!.school[0]!.student = 'Ana'
    corrupt.data.weeks[0]!.school[0]!.studentId = 'ana'
    corrupt.data.students = corrupt.data.students.filter(student => student.id !== 'ana')
    storage.setItem(APP_STORAGE_KEY, encodeStoredSnapshot(corrupt))
    storage.setItem(APP_STORAGE_BACKUP_KEY, encodeStoredSnapshot(snapshot(4, 'healthy-backup')))

    const loaded = loadAppState(storage)

    expect(loaded.source).toBe('backup')
    expect(loaded.data.sourceUrl).toBe('healthy-backup')
  })

  test('loads a valid legacy backup when the legacy primary is corrupt', () => {
    const storage = new MemoryStorage()
    storage.setItem('assingments', '[{}]')
    storage.setItem('assingments:backup', JSON.stringify(createState().weeks))
    storage.setItem('students', JSON.stringify(createState().students))
    storage.setItem('assignmentHistory', '[]')

    const loaded = loadAppState(storage)

    expect(loaded.source).toBe('legacy')
    expect(loaded.data.weeks).toHaveLength(1)
  })

  test('continues with safe in-memory data when storage is blocked', () => {
    const storage = new MemoryStorage()
    storage.failReads = true

    const loaded = loadAppState(storage)

    expect(loaded.data.weeks).toEqual([])
    expect(loaded.error).toContain('storage blocked')
    expect(loaded.warning).toContain('solo en memoria')
  })

  test('detects a newer revision written by another tab', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_STORAGE_KEY, encodeStoredSnapshot(snapshot(3, 'external')))

    const result = saveAppState(storage, createState(), 2)

    expect(result.ok).toBeFalse()
    if (!result.ok && result.kind === 'conflict') {
      expect(result.external.revision).toBe(3)
    }
  })

  test('detects a same-revision payload written concurrently', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_STORAGE_KEY, encodeStoredSnapshot(snapshot(2, 'external')))
    const local = createState()
    local.sourceUrl = 'local'

    const result = saveAppState(storage, local, 2, false, JSON.stringify(local))

    expect(result.ok).toBeFalse()
    if (!result.ok) expect(result.kind).toBe('conflict')
  })

  test('allows sequential saves when only property insertion order differs', () => {
    const storage = new MemoryStorage()
    const state = createState()
    state.weeks[0]!.treasures.student = 'Ana'
    const first = saveAppState(storage, state, 0)
    if (!first.ok) throw new Error(first.error)

    state.weeks[0]!.president = 'Presidente nuevo'
    const second = saveAppState(
      storage,
      state,
      first.snapshot.revision,
      false,
      canonicalAppStatePayload(first.snapshot.data) ?? undefined,
    )

    expect(second.ok).toBeTrue()
    if (second.ok) expect(second.snapshot.data.weeks[0]?.president).toBe('Presidente nuevo')
  })
})
