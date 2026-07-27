import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './draft'
import {
  applyFinishDrama,
  computeGameWinnerChance,
  computeOvertimeChance,
  computeStrengthEdge,
} from './finishDrama'

describe('finishDrama', () => {
  it('raises overtime chance for close, evenly matched games', () => {
    const closeEven = computeOvertimeChance(computeStrengthEdge(410, 410), 2)
    const blowout = computeOvertimeChance(computeStrengthEdge(410, 410), 14)
    const mismatch = computeOvertimeChance(computeStrengthEdge(450, 360), 2)
    expect(closeEven).toBeGreaterThan(blowout)
    expect(closeEven).toBeGreaterThan(mismatch)
    expect(closeEven).toBeGreaterThanOrEqual(0.08)
    expect(blowout).toBeLessThanOrEqual(0.05)
  })

  it('uses a flat buzzer-beater chance', () => {
    expect(computeGameWinnerChance()).toBe(0.05)
  })

  it('can force overtime without requiring tied quarters beforehand', () => {
    let overtimeHits = 0

    for (let seed = 0; seed < 500; seed += 1) {
      const result = applyFinishDrama({
        userScore: 104,
        championScore: 101,
        userRating: 410,
        championCombatRating: 410,
        rng: createSeededRandom(seed),
      })

      if (result.finishDrama.overtime) {
        overtimeHits += 1
        expect(result.regulationRawScore).toEqual({ user: 104, champion: 101 })
        expect(result.regulationScore?.user).toBe(result.regulationScore?.champion)
        expect(result.userScore).not.toBe(result.championScore)
      }
    }

    expect(overtimeHits).toBeGreaterThan(20)
    expect(overtimeHits).toBeLessThan(180)
  })

  it('creates buzzer-beaters at roughly a 5% rate in regulation', () => {
    let buzzerHits = 0

    for (let seed = 0; seed < 2_000; seed += 1) {
      const result = applyFinishDrama({
        userScore: 110,
        championScore: 102,
        userRating: 430,
        championCombatRating: 380,
        rng: createSeededRandom(seed + 1000),
      })

      if (result.finishDrama.gameWinner && !result.finishDrama.overtime) {
        buzzerHits += 1
        expect(Math.abs(result.userScore - result.championScore)).toBeLessThanOrEqual(3)
      }
    }

    expect(buzzerHits).toBeGreaterThan(60)
    expect(buzzerHits).toBeLessThan(160)
  })
})
