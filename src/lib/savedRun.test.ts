import { beforeEach, describe, expect, it } from 'vitest'
import { clearSavedRun, loadSavedRun, saveSavedRun } from './savedRun'

describe('savedRun', () => {
  beforeEach(() => {
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
