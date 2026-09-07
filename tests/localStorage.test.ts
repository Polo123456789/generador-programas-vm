import { afterAll, beforeAll, expect, test } from 'bun:test'
import { effectScope } from 'vue'
import { useLocalStorage, useLocalStorageError } from '../app/composables/useLocalStorage'

const values = new Map<string, string>()
const originalWindow = globalThis.window

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  })
})

afterAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

test('storage watcher survives the component scope that first requested a key', () => {
  const key = `navigation-regression-${Date.now()}`
  const pageScope = effectScope()
  const value = pageScope.run(() => useLocalStorage(key, 'initial'))!

  value.value = 'before-navigation'
  expect(values.get(key)).toBe(JSON.stringify('before-navigation'))
  pageScope.stop()

  value.value = 'after-navigation'
  expect(values.get(key)).toBe(JSON.stringify('after-navigation'))
})

test('storage write failures are exposed to the interface', () => {
  const key = `storage-error-${Date.now()}`
  const value = useLocalStorage(key, 'initial')
  const error = useLocalStorageError(key)
  const originalSetItem = window.localStorage.setItem
  window.localStorage.setItem = () => {
    throw new Error('Quota exceeded')
  }

  value.value = 'not-persisted'
  expect(error.value).toContain('No se pudieron guardar')

  window.localStorage.setItem = originalSetItem
  value.value = 'persisted'
  expect(error.value).toBeNull()
})
