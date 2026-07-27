import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  beginAttempt,
  getEraChallengeRecord,
  loadChallengeProgress,
  recordChallengeClear,
  resetEraChallenge,
} from './challengeProgress'

const store = new Map<string, string>()

describe('challengeProgress', () => {
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
    resetEraChallenge('2000s')
  })

  it('tracks attempts since last clear', () => {
    expect(beginAttempt('2000s')).toBe(1)
    expect(beginAttempt('2000s')).toBe(2)
    expect(getEraChallengeRecord('2000s').attemptsSinceClear).toBe(2)
  })

  it('records clears and personal bests', () => {
    beginAttempt('2000s')
    beginAttempt('2000s')
    const firstClear = recordChallengeClear('2000s')
    expect(firstClear).toEqual({ attempts: 2, isBest: true, totalClears: 1 })

    beginAttempt('2000s')
    beginAttempt('2000s')
    beginAttempt('2000s')
    const secondClear = recordChallengeClear('2000s')
    expect(secondClear).toEqual({ attempts: 3, isBest: false, totalClears: 2 })

    beginAttempt('2000s')
    const thirdClear = recordChallengeClear('2000s')
    expect(thirdClear).toEqual({ attempts: 1, isBest: true, totalClears: 3 })
    expect(getEraChallengeRecord('2000s').bestClearAttempts).toBe(1)
  })

  it('resets era progress', () => {
    beginAttempt('2000s')
    recordChallengeClear('2000s')
    resetEraChallenge('2000s')
    expect(loadChallengeProgress().eras['2000s']).toBeUndefined()
  })
})
