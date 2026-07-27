import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSavedRun, loadSavedRun, saveSavedRun } from './savedRun'

const store = new Map<string, string>()

describe('savedRun', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    })
    clearSavedRun()
  })

  it('persists and loads the active run', () => {
    saveSavedRun({ era: '2010s', difficulty: 'hard' })
    expect(loadSavedRun()).toEqual({ era: '2010s', difficulty: 'hard' })
  })

  it('clears the saved run', () => {
    saveSavedRun({ era: '2000s', difficulty: 'normal' })
    clearSavedRun()
    expect(loadSavedRun()).toBeNull()
  })
})
