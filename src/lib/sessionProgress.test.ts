import { describe, expect, it } from 'vitest'
import {
  createInitialPersistentProgress,
  getChampionAttempts,
  updatePersistentProgress,
} from './sessionProgress'

describe('sessionProgress', () => {
  it('tracks session outcomes and badge counts', () => {
    const progress = updatePersistentProgress({
      outcome: 'win',
      championId: '2017-warriors',
      badges: ['capGod', 'dynastyKiller'],
    })

    expect(progress.session.wins).toBe(1)
    expect(progress.session.streak).toBe(1)
    expect(progress.session.streakType).toBe('win')
    expect(progress.badgeCounts.capGod).toBe(1)
    expect(progress.badgeCounts.dynastyKiller).toBe(1)
    expect(getChampionAttempts(progress, '2017-warriors')).toBe(1)
  })

  it('increments champion attempts without a win on loss', () => {
    const initial = createInitialPersistentProgress()
    const progress = updatePersistentProgress({
      outcome: 'loss',
      championId: '2017-warriors',
      badges: ['heartbreakLoss'],
    })

    expect(progress.session.losses).toBe(initial.session.losses + 1)
    expect(progress.championRecords['2017-warriors']).toEqual({ attempts: 1, wins: 0 })
  })
})
