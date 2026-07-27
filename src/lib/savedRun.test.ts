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

  it('persists and loads the last selected era', () => {
    saveSavedRun({ era: '2010s' })
    expect(loadSavedRun()).toEqual({ era: '2010s' })
  })

  it('clears the saved run', () => {
    saveSavedRun({ era: '2000s' })
    clearSavedRun()
    expect(loadSavedRun()).toBeNull()
  })

  it('migrates legacy saved runs that include difficulty', () => {
    store.set('cap-god-saved-run-v1', JSON.stringify({ era: '2020s', difficulty: 'hard' }))
    expect(loadSavedRun()).toEqual({ era: '2020s' })
  })
})
