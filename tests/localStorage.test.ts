import { afterAll, beforeAll, expect, test } from 'bun:test'
import { effectScope } from 'vue'
import { useLocalStorage } from '../app/composables/useLocalStorage'

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
