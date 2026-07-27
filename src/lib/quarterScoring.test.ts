import { describe, expect, it } from 'vitest'
import type { Player } from '../schemas/player'
import type { ChampionTeam } from '../types/game'
import { createSeededRandom } from './draft'
import { buildRealisticQuarterScores, distributeMarginWeights } from './quarterScoring'
import { simulateGame7 } from './rating'

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'rating' | 'salary'>): Player {
  return {
    player: overrides.player ?? 'Test Player',
    year: overrides.year ?? '2015-16',
    yearEnd: overrides.yearEnd ?? 2016,
    pts: overrides.pts ?? 20,
    ast: overrides.ast ?? 5,
    trb: overrides.trb ?? 5,
    mp: overrides.mp ?? 30,
    salary: overrides.salary,
    rating: overrides.rating,
    era: overrides.era ?? '2010s',
    positions: overrides.positions ?? ['SF'],
    id: overrides.id,
  }
}

const champion: ChampionTeam = {
  id: '2017-warriors',
  name: "'17 Warriors",
  rating: 118,
  era: '2010s',
  seasonYear: 2017,
}

function quarterPoints(
  quarters: { user: number; champion: number }[],
): Array<{ user: number; champion: number }> {
  const points: Array<{ user: number; champion: number }> = []
  let priorUser = 0
  let priorChampion = 0

  for (const quarter of quarters) {
    points.push({
      user: quarter.user - priorUser,
      champion: quarter.champion - priorChampion,
    })
    priorUser = quarter.user
    priorChampion = quarter.champion
  }

  return points
}

describe('buildRealisticQuarterScores', () => {
  it('matches final totals and keeps quarter scoring in realistic ranges', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const rng = createSeededRandom(seed)
      const finalUser = 96 + (seed % 18)
      const finalChampion = 94 + (seed % 16)
      const quarters = buildRealisticQuarterScores({
        finalUser,
        finalChampion,
        userRating: 410,
        championCombatRating: 420,
        seasonYear: 2017,
        eraId: '2010s',
        rng,
      })

      expect(quarters).toHaveLength(4)
      expect(quarters[3]?.user).toBe(finalUser)
      expect(quarters[3]?.champion).toBe(finalChampion)

      for (const quarter of quarterPoints(quarters)) {
        expect(Number.isInteger(quarter.user)).toBe(true)
        expect(Number.isInteger(quarter.champion)).toBe(true)
        expect(quarter.user).toBeGreaterThanOrEqual(18)
        expect(quarter.champion).toBeGreaterThanOrEqual(18)
        expect(quarter.user).toBeLessThanOrEqual(40)
        expect(quarter.champion).toBeLessThanOrEqual(40)
        expect(Math.abs(quarter.user - quarter.champion)).toBeLessThanOrEqual(18)
      }
    }
  })

  it('uses slower historical pace in the 2004 dead-ball era', () => {
    const quarters = buildRealisticQuarterScores({
      finalUser: 92,
      finalChampion: 89,
      userRating: 380,
      championCombatRating: 400,
      seasonYear: 2004,
      eraId: '2000s',
      rng: createSeededRandom(21),
    })

    const perQuarter = quarterPoints(quarters)
    const avgQuarter = perQuarter.reduce((sum, quarter) => sum + quarter.user + quarter.champion, 0) / 8
    expect(avgQuarter).toBeLessThan(28)
  })

  it('avoids identical one-point leads in every quarter', () => {
    let repetitiveRuns = 0

    for (let seed = 0; seed < 200; seed += 1) {
      const quarters = buildRealisticQuarterScores({
        finalUser: 108,
        finalChampion: 104,
        userRating: 430,
        championCombatRating: 380,
        seasonYear: 2017,
        eraId: '2010s',
        rng: createSeededRandom(seed),
      })

      const margins = quarterPoints(quarters).map((quarter) => quarter.user - quarter.champion)
      const runningMargins = quarters.map((quarter) => quarter.user - quarter.champion)
      const allOnePointLeads = runningMargins.every((margin) => margin === 1)
      const allIdenticalQuarterTotals =
        margins.length === 4 && margins.every((margin) => margin === margins[0])

      if (allOnePointLeads || allIdenticalQuarterTotals) {
        repetitiveRuns += 1
      }
    }

    expect(repetitiveRuns).toBeLessThan(20)
  })

  it('can show lead changes before snapping to an overtime tie in the fourth', () => {
    const quarters = buildRealisticQuarterScores({
      finalUser: 104,
      finalChampion: 101,
      userRating: 410,
      championCombatRating: 410,
      seasonYear: 2017,
      eraId: '2010s',
      rng: createSeededRandom(77),
      regulationTieTarget: { user: 103, champion: 103 },
    })

    const runningMargins = quarters.map((quarter) => quarter.user - quarter.champion)

    expect(quarters[3]?.user).toBe(103)
    expect(quarters[3]?.champion).toBe(103)
    expect(runningMargins.slice(0, 3).some((margin) => margin !== 0)).toBe(true)
    expect(new Set(runningMargins.slice(0, 3)).size).toBeGreaterThan(1)
  })

  it('creates alternating swings when the final margin is tied', () => {
    const margins = distributeMarginWeights(0, createSeededRandom(12))
    expect(margins).toHaveLength(4)
    expect(margins.reduce((sum, margin) => sum + margin, 0)).toBe(0)
    expect(new Set(margins).size).toBeGreaterThan(1)
  })
})

describe('simulateGame7 quarter realism', () => {
  it('never produces absurd single-quarter score lines in a full sim', () => {
    const roster = [
      makePlayer({ id: 'a', rating: 90, salary: 8_000_000 }),
      makePlayer({ id: 'b', rating: 88, salary: 7_000_000 }),
      makePlayer({ id: 'c', rating: 85, salary: 6_000_000 }),
      makePlayer({ id: 'd', rating: 80, salary: 5_000_000 }),
      makePlayer({ id: 'e', rating: 78, salary: 4_000_000 }),
    ]

    for (let seed = 0; seed < 100; seed += 1) {
      const result = simulateGame7({
        roster,
        champion,
        eraId: '2010s',
        difficulty: 'normal',
        capLimit: 45_000_000,
        rng: createSeededRandom(seed),
      })

      for (const quarter of quarterPoints(result.quarters)) {
        expect(Number.isInteger(quarter.user)).toBe(true)
        expect(Number.isInteger(quarter.champion)).toBe(true)
        expect(Number.isInteger(result.userScore)).toBe(true)
        expect(Number.isInteger(result.championScore)).toBe(true)
        expect(quarter.user).toBeGreaterThanOrEqual(16)
        expect(quarter.champion).toBeGreaterThanOrEqual(16)
        expect(Math.abs(quarter.user - quarter.champion)).toBeLessThanOrEqual(20)
      }
    }
  })
})
