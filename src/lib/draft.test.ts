import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parsePlayers, type Player, type Position } from '../schemas/player'
import {
  canHit,
  canSign,
  createPositionPackets,
  createSeededRandom,
  getDraftCapSpend,
  getFinalStarters,
  getHitPenalty,
  getDraftOfferWeight,
  getOverCapPenalty,
  getPlayerCapCost,
  getRosterSpend,
  getSalaryTag,
  hitOffer,
  initDraft,
  isDraftComplete,
  isOverCap,
  revealSalary,
  signOffer,
  salaryToCapPoints,
} from './draft'

function makePlayer(
  overrides: Partial<Player> & Pick<Player, 'id'>,
  positions: Position[] = ['SF'],
): Player {
  return {
    player: overrides.player ?? 'Test Player',
    year: overrides.year ?? '2015-16',
    yearEnd: overrides.yearEnd ?? 2016,
    pts: overrides.pts ?? 20,
    ast: overrides.ast ?? 5,
    trb: overrides.trb ?? 5,
    mp: overrides.mp ?? 30,
    salary: overrides.salary ?? 10_000_000,
    rating: overrides.rating ?? 85,
    era: overrides.era ?? '2010s',
    positions: overrides.positions ?? positions,
    id: overrides.id,
  }
}

function makePool(): Player[] {
  const slots: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
  const pool: Player[] = []

  for (let index = 0; index < 30; index += 1) {
    const slot = slots[index % slots.length]!
    pool.push(
      makePlayer(
        {
          id: `p${index}`,
          player: `Player ${index}`,
          salary: 4_000_000 + index * 500_000,
          rating: 70 + (index % 15),
        },
        index % 3 === 0 ? [slot] : [slot, slots[(index + 1) % 5]!],
      ),
    )
  }

  return pool
}

describe('cap points', () => {
  it('converts salary relative to era cap with a minimum', () => {
    expect(salaryToCapPoints(35_000_000, 70_000_000)).toBe(50)
    expect(salaryToCapPoints(70_000_000, 70_000_000)).toBe(100)
    expect(salaryToCapPoints(100_000, 70_000_000)).toBe(3)
  })

  it('uses era-native caps for Time Machine spend', () => {
    const roster = [
      makePlayer({ id: 'a', era: '2000s', salary: 17_500_000 }),
      makePlayer({ id: 'b', era: '2020s', salary: 27_500_000 }),
    ]
    expect(getPlayerCapCost(roster[0]!, 'timeMachine')).toBe(35)
    expect(getPlayerCapCost(roster[1]!, 'timeMachine')).toBe(28)
    expect(getRosterSpend(roster, 'timeMachine')).toBe(63)
    expect(isOverCap(roster, 'timeMachine', 100)).toBe(false)
  })
})

describe('position rounds', () => {
  it('drafts five unique starters across position rounds', () => {
    const pool = makePool()
    let state = initDraft(pool, createSeededRandom(42), '2010s', 70_000_000)

    while (!isDraftComplete(state)) {
      if (canHit(state) && state.offerIndex === 1 && state.currentOffer!.rating < 75) {
        state = hitOffer(state, '2010s')
        continue
      }
      state = signOffer(revealSalary(state))
    }

    const starters = getFinalStarters(state)
    expect(starters).toHaveLength(5)
    expect(new Set(starters.map((player) => player.player)).size).toBe(5)
    expect(state.starters.PG).toBeDefined()
    expect(state.starters.C).toBeDefined()
  })

  it('allows extra hits beyond the third offer when the pool has depth', () => {
    const pool = makePool()
    let state = initDraft(pool, createSeededRandom(7), '2010s', 70_000_000)

    state = hitOffer(state, '2010s')
    state = hitOffer(state, '2010s')

    expect(state.offerIndex).toBe(3)
    expect(state.forcedSign).toBe(false)
    expect(canHit(state)).toBe(true)

    state = hitOffer(state, '2010s')

    expect(state.offerIndex).toBe(4)
    expect(state.hitsThisSlot).toBe(3)
    expect(state.hitPenaltySpend).toBe(0)

    state = hitOffer(state, '2010s')

    expect(state.offerIndex).toBe(5)
    expect(state.hitsThisSlot).toBe(4)
    expect(state.hitPenaltySpend).toBe(getHitPenalty('2010s'))
  })

  it('forces sign only when no more offers remain', () => {
    const pool = makePool()
    let state = initDraft(pool, createSeededRandom(7), '2010s', 70_000_000)

    while (canHit(state)) {
      state = hitOffer(state, '2010s')
    }

    expect(state.forcedSign).toBe(true)
    expect(canHit(state)).toBe(false)
    expect(canSign(revealSalary(state))).toBe(true)
  })

  it('builds packets without duplicate names across the hand', () => {
    const pool = makePool()
    const packets = createPositionPackets(pool, '2010s', 70_000_000, createSeededRandom(99))
    const names = Object.values(packets).flatMap((packet) => packet.map((player) => player.player))
    expect(names).toHaveLength(15)
    expect(new Set(names).size).toBe(15)
  })

  it('weights stronger ratings higher when building offers', () => {
    expect(getDraftOfferWeight(92)).toBeGreaterThan(getDraftOfferWeight(80))
    expect(getDraftOfferWeight(80)).toBeGreaterThan(getDraftOfferWeight(74))
  })

  it('surfaces stronger offers than the raw pool average', () => {
    const raw = readFileSync(join(process.cwd(), 'public/data/players/2010s.json'), 'utf8')
    const pool = parsePlayers(JSON.parse(raw))
    const poolAverage = pool.reduce((sum, player) => sum + player.rating, 0) / pool.length
    let offerAverage = 0
    const runs = 200

    for (let seed = 0; seed < runs; seed += 1) {
      const packets = createPositionPackets(pool, '2010s', 70_000_000, createSeededRandom(seed))
      const ratings = Object.values(packets).flat().map((player) => player.rating)
      offerAverage += ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    }

    expect(offerAverage / runs).toBeGreaterThan(poolAverage)
  })

  it('never re-offers the same player name when hitting through overflow', () => {
    const raw = readFileSync(join(process.cwd(), 'public/data/players/2010s.json'), 'utf8')
    const pool = parsePlayers(JSON.parse(raw))

    for (let seed = 0; seed < 200; seed += 1) {
      let state = initDraft(pool, createSeededRandom(seed), '2010s', 70_000_000)

      while (!isDraftComplete(state)) {
        const seenThisSlot = new Set(state.seenNamesThisSlot)
        if (state.currentOffer) {
          seenThisSlot.add(state.currentOffer.player)
        }

        while (canHit(state)) {
          const before = state.currentOffer!.player
          state = hitOffer(state, '2010s')
          const after = state.currentOffer!.player
          expect(seenThisSlot.has(after)).toBe(false)
          seenThisSlot.add(after)
          expect(after).not.toBe(before)
        }

        state = signOffer(revealSalary(state))
      }
    }
  })

  it('gives center a third free hit via overflow on the real 2010s pool', () => {
    const raw = readFileSync(join(process.cwd(), 'public/data/players/2010s.json'), 'utf8')
    const pool = parsePlayers(JSON.parse(raw))
    let state = initDraft(pool, createSeededRandom(4242), '2010s', 70_000_000)

    while (state.activeSlot !== 'C') {
      state = signOffer(revealSalary(state))
    }

    state = hitOffer(state, '2010s')
    state = hitOffer(state, '2010s')
    state = hitOffer(state, '2010s')

    expect(state.hitsThisSlot).toBe(3)
    expect(state.hitPenaltySpend).toBe(0)
    expect(state.offerIndex).toBe(4)
    expect(canHit(state)).toBe(true)
  })
})

describe('over-cap penalties', () => {
  it('scales penalty with how far over the cap you are', () => {
    expect(getOverCapPenalty(50_000_000, 50_000_000)).toBe(0)
    expect(getOverCapPenalty(50_000_001, 50_000_000)).toBe(20)
    expect(getOverCapPenalty(55_000_000, 50_000_000)).toBe(25)
    expect(getOverCapPenalty(60_000_000, 50_000_000)).toBe(30)
  })
})

describe('hit penalties', () => {
  it('charges era-specific penalties after three free hits', () => {
    expect(getHitPenalty('2000s')).toBe(2_000_000)
    expect(getHitPenalty('2010s')).toBe(3_000_000)
    expect(getHitPenalty('2020s')).toBe(5_000_000)
    expect(getHitPenalty('timeMachine')).toBe(5)
  })

  it('includes hit penalties in cap spend checks', () => {
    const roster = [makePlayer({ id: 'a', salary: 48_000_000, rating: 90 }, ['PG'])]
    expect(isOverCap(roster, '2000s', 50_000_000, 0)).toBe(false)
    expect(isOverCap(roster, '2000s', 50_000_000, 2_000_000)).toBe(false)
    expect(isOverCap(roster, '2000s', 50_000_000, 2_000_001)).toBe(true)
    expect(getDraftCapSpend(roster, '2000s', 2_000_000)).toBe(50_000_000)
  })
})

describe('salary tags', () => {
  it('labels cheap and bloat contracts', () => {
    expect(getSalaryTag(5_000_000, 70_000_000)).toBe('cheap')
    expect(getSalaryTag(49_000_000, 70_000_000)).toBe('bloat')
  })
})
