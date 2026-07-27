import { describe, expect, it } from 'vitest'
import { buildGameLogEntry, exportGameLogsCsv, exportGameLogsJson } from './gameLog'
import type { ChampionTeam, DraftState } from '../types/game'

const champion: ChampionTeam = {
  id: '2017-warriors',
  name: "'17 Warriors",
  rating: 118,
  era: '2010s',
  seasonYear: 2017,
}

const emptyDraft: DraftState = {
  activeSlot: 'PG',
  slotIndex: 0,
  starters: {},
  currentOffer: null,
  remainingPacket: [],
  offerIndex: 1,
  salaryRevealed: false,
  forcedSign: false,
  usedNames: [],
  positionPackets: {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: [],
  },
  overflowQueues: {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: [],
  },
  hitsThisSlot: 0,
  hitPenaltySpend: 0,
  seenNamesThisSlot: [],
}

describe('game logs', () => {
  it('exports json and csv formats', () => {
    const entry = buildGameLogEntry({
      seed: 1,
      era: '2010s',
      difficulty: 'normal',
      champion,
      draft: emptyDraft,
      decisions: [],
      starters: [],
      spend: 0,
      capLimit: 45_000_000,
      sim: {
        userScore: 100,
        championScore: 98,
        quarters: [],
        finishDrama: { overtime: false, gameWinner: true, winnerSide: 'user' },
        narrativeSeed: 99,
        userRating: 400,
        championEffectiveRating: 116,
        overCap: false,
        outcome: 'win',
        won: true,
        margin: 2,
        commentary: [],
        breakdown: {
          rawRating: 400,
          overCapPenalty: 0,
          effectiveRating: 400,
          championBaseRating: 118,
          championNoise: 0,
          championCombatRating: 398,
          expectedMargin: 2,
          userScoreNoise: 0,
          championScoreNoise: 0,
        },
      },
    })

    expect(exportGameLogsJson([entry])).toContain('"seed": 1')
    expect(exportGameLogsCsv([entry])).toContain('2010s,normal')
  })
})
