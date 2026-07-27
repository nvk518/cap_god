import { describe, expect, it } from 'vitest'
import type { Player } from '../schemas/player'
import type { ChampionTeam } from '../types/game'
import { getScoringProfile } from '../data/scoringPace'
import { createSeededRandom } from './draft'
import { assignBadges, computeUserRating, resolveOutcome, simulateGame7, sumPlayerRatings } from './rating'
import { buildSimTimeline, reconcileTimelineScores } from './simTimeline'

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

describe('simulateGame7', () => {
  it('applies over-cap penalty and stays in score bounds', () => {
    const roster = [
      makePlayer({ id: 'a', rating: 90, salary: 20_000_000 }),
      makePlayer({ id: 'b', rating: 88, salary: 18_000_000 }),
      makePlayer({ id: 'c', rating: 85, salary: 12_000_000 }),
      makePlayer({ id: 'd', rating: 80, salary: 10_000_000 }),
      makePlayer({ id: 'e', rating: 78, salary: 8_000_000 }),
    ]

    const underCap = simulateGame7({
      roster,
      champion,
      eraId: '2010s',
      difficulty: 'normal',
      capLimit: 45_000_000,
      rng: createSeededRandom(99),
    })
    expect(underCap.overCap).toBe(true)
    expect(underCap.userRating).toBe(sumPlayerRatings(roster) - underCap.breakdown.overCapPenalty)
    expect(underCap.breakdown.overCapPenalty).toBeGreaterThanOrEqual(20)
    const profile = getScoringProfile(champion.seasonYear, '2010s')
    expect(underCap.userScore).toBeGreaterThanOrEqual(profile.scoreMin)
    expect(underCap.userScore).toBeLessThanOrEqual(profile.scoreMax)
    expect(Number.isInteger(underCap.userScore)).toBe(true)
    expect(Number.isInteger(underCap.championScore)).toBe(true)
    expect(underCap.breakdown.championCombatRating).toBeGreaterThan(0)
  })

  it('can produce pushes on exact ties', () => {
    expect(resolveOutcome(102, 102)).toBe('push')
  })

  it('assigns badges from outcome rules', () => {
    const winUnderCap = {
      userScore: 108,
      championScore: 104,
      quarters: [],
      finishDrama: { overtime: false, gameWinner: false },
      narrativeSeed: 42,
      userRating: 420,
      championEffectiveRating: 116,
      overCap: false,
      outcome: 'win' as const,
      won: true,
      margin: 4,
      commentary: [],
      breakdown: {
        rawRating: 420,
        overCapPenalty: 0,
        effectiveRating: 420,
        championBaseRating: 118,
        championNoise: 0,
        championCombatRating: 400,
        expectedMargin: 5,
        userScoreNoise: 0,
        championScoreNoise: 0,
      },
    }
    expect(assignBadges(winUnderCap, champion)).toEqual(['capGod', 'dynastyKiller'])
  })
})

describe('sim timeline', () => {
  it('reconciles final score totals', () => {
    const roster = [
      makePlayer({ id: 'a', rating: 90, salary: 8_000_000 }),
      makePlayer({ id: 'b', rating: 88, salary: 7_000_000 }),
      makePlayer({ id: 'c', rating: 85, salary: 6_000_000 }),
      makePlayer({ id: 'd', rating: 80, salary: 5_000_000 }),
      makePlayer({ id: 'e', rating: 78, salary: 4_000_000 }),
    ]
    const result = simulateGame7({
      roster,
      champion,
      eraId: '2010s',
      difficulty: 'normal',
      capLimit: 45_000_000,
      rng: createSeededRandom(12),
    })
    const timeline = buildSimTimeline(result, roster, champion)
    expect(reconcileTimelineScores(timeline, result)).toBe(true)
    expect(timeline.events).toHaveLength(5)
    expect(timeline.events[4]?.highlights.length).toBeGreaterThan(0)
    expect(result.finishDrama).toBeDefined()
  })

  it('uses actual top-rated champion players instead of generic team labels', () => {
    const lakers2000: ChampionTeam = {
      id: '2000-lakers',
      name: "'00 Lakers",
      rating: 112,
      era: '2000s',
      seasonYear: 2000,
    }
    const roster = [
      makePlayer({ id: 'andre', player: 'Andre Miller', rating: 82, salary: 1_682_000 }),
      makePlayer({ id: 'shaq', player: "Shaquille O'Neal", rating: 96, salary: 17_000_000 }),
      makePlayer({ id: 'kobe', player: 'Kobe Bryant', rating: 88, salary: 9_000_000 }),
      makePlayer({ id: 'fox', player: 'Rick Fox', rating: 72, salary: 3_000_000 }),
      makePlayer({ id: 'fish', player: 'Derek Fisher', rating: 72, salary: 1_500_000 }),
    ]
    const result = simulateGame7({
      roster,
      champion: lakers2000,
      eraId: '2000s',
      difficulty: 'normal',
      capLimit: 35_000_000,
      rng: createSeededRandom(7),
    })
    const timeline = buildSimTimeline(result, roster, lakers2000)
    const highlightText = timeline.events.flatMap((event) => event.highlights).join(' ')

    expect(highlightText).not.toMatch(/Lakers star|Lakers ace/)
    expect(highlightText).toMatch(/Shaquille O'Neal|Kobe Bryant/)
  })
})

describe('era-based final scores', () => {
  it('scores lower in the 2004 dead-ball era than in 2017', () => {
    const roster = [
      makePlayer({ id: 'a', rating: 85, salary: 8_000_000 }),
      makePlayer({ id: 'b', rating: 84, salary: 7_000_000 }),
      makePlayer({ id: 'c', rating: 83, salary: 6_000_000 }),
      makePlayer({ id: 'd', rating: 82, salary: 5_000_000 }),
      makePlayer({ id: 'e', rating: 81, salary: 4_000_000 }),
    ]

    const pistons: ChampionTeam = {
      id: '2004-pistons',
      name: "'04 Pistons",
      rating: 109,
      era: '2000s',
      seasonYear: 2004,
    }

    let lowEraTotal = 0
    let highEraTotal = 0

    for (let seed = 0; seed < 40; seed += 1) {
      const low = simulateGame7({
        roster,
        champion: pistons,
        eraId: '2000s',
        difficulty: 'normal',
        capLimit: 35_000_000,
        rng: createSeededRandom(seed),
      })
      const high = simulateGame7({
        roster,
        champion,
        eraId: '2010s',
        difficulty: 'normal',
        capLimit: 45_000_000,
        rng: createSeededRandom(seed),
      })
      lowEraTotal += low.championScore
      highEraTotal += high.championScore
    }

    expect(lowEraTotal / 40).toBeLessThan(highEraTotal / 40 - 10)
  })
})

describe('2006 heat champion regression', () => {
  it('does not let a weak roster routinely beat the heat champion', () => {
    const heatChampion: ChampionTeam = {
      id: '2006-heat',
      name: "'06 Heat",
      rating: 110,
      era: '2000s',
      seasonYear: 2006,
    }
    const weak = [
      makePlayer({ id: 'a', rating: 72, salary: 4_000_000 }),
      makePlayer({ id: 'b', rating: 71, salary: 4_000_000 }),
      makePlayer({ id: 'c', rating: 70, salary: 4_000_000 }),
      makePlayer({ id: 'd', rating: 69, salary: 4_000_000 }),
      makePlayer({ id: 'e', rating: 68, salary: 4_000_000 }),
    ]

    let wins = 0
    for (let seed = 0; seed < 30; seed += 1) {
      const result = simulateGame7({
        roster: weak,
        champion: heatChampion,
        eraId: '2000s',
        difficulty: 'normal',
        capLimit: 35_000_000,
        rng: createSeededRandom(seed),
      })
      if (result.outcome === 'win') {
        wins += 1
      }
    }
    expect(wins).toBeLessThan(10)
    expect(computeUserRating(weak, '2000s', 35_000_000)).toBeLessThan(110 * 3.42)
  })
})
