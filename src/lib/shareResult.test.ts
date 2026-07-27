import { describe, expect, it } from 'vitest'
import type { Player } from '../schemas/player'
import type { ChampionTeam, SimResult } from '../types/game'
import {
  formatShareCapLine,
  formatShareOutcomeLetter,
  formatShareResult,
  formatShortSeason,
  getShareOrigin,
} from './shareResult'

const champion: ChampionTeam = {
  id: '2017-warriors',
  name: "'17 Warriors",
  rating: 118,
  era: '2010s',
  seasonYear: 2017,
}

function makePlayer(
  overrides: Partial<Player> & Pick<Player, 'player' | 'year' | 'positions'>,
): Player {
  return {
    id: overrides.id ?? overrides.player.toLowerCase().replace(/\s+/g, '-'),
    player: overrides.player,
    year: overrides.year,
    yearEnd: overrides.yearEnd ?? Number.parseInt(overrides.year.slice(0, 4), 10) + 1,
    pts: overrides.pts ?? 20,
    ast: overrides.ast ?? 5,
    trb: overrides.trb ?? 5,
    mp: overrides.mp ?? 30,
    salary: overrides.salary ?? 20_000_000,
    rating: overrides.rating ?? 90,
    era: overrides.era ?? '2010s',
    positions: overrides.positions,
  }
}

const roster: Player[] = [
  makePlayer({ player: 'Stephen Curry', year: '2015-16', positions: ['PG'] }),
  makePlayer({ player: 'Dwyane Wade', year: '2008-09', positions: ['SG'] }),
  makePlayer({ player: 'LeBron James', year: '2012-13', positions: ['SF'] }),
  makePlayer({ player: 'Kevin Garnett', year: '2003-04', positions: ['PF'] }),
  makePlayer({ player: "Shaquille O'Neal", year: '1999-00', positions: ['C'] }),
]

const winResult: SimResult = {
  userScore: 112,
  championScore: 108,
  quarters: [],
  finishDrama: { overtime: false, gameWinner: false },
  narrativeSeed: 1,
  userRating: 400,
  championEffectiveRating: 390,
  overCap: false,
  outcome: 'win',
  won: true,
  margin: 4,
  commentary: [],
  breakdown: {
    rawRating: 400,
    overCapPenalty: 0,
    effectiveRating: 400,
    championBaseRating: 390,
    championNoise: 0,
    championCombatRating: 390,
    expectedMargin: 4,
    userScoreNoise: 0,
    championScoreNoise: 0,
  },
}

describe('formatShortSeason', () => {
  it('shortens draft years to two-digit seasons', () => {
    expect(formatShortSeason('2015-16')).toBe("'16")
    expect(formatShortSeason('1999-00')).toBe("'00")
  })
})

describe('formatShareOutcomeLetter', () => {
  it('maps outcomes to compact letters', () => {
    expect(formatShareOutcomeLetter('win')).toBe('W')
    expect(formatShareOutcomeLetter('loss')).toBe('L')
    expect(formatShareOutcomeLetter('push')).toBe('T')
  })
})

describe('formatShareCapLine', () => {
  it('formats regular-era dollars', () => {
    expect(formatShareCapLine(68_400_000, 70_000_000, '2010s')).toBe('CAP $68.4M/$70M')
  })

  it('formats time machine cap points', () => {
    expect(formatShareCapLine(84, 100, 'timeMachine')).toBe('CAP 84CP/100CP')
  })

  it('includes paid-hit penalty spend in the cap line', () => {
    expect(formatShareCapLine(71_500_000, 70_000_000, '2010s')).toBe('CAP $71.5M/$70M')
  })
})

describe('getShareOrigin', () => {
  it('omits the origin on local hosts', () => {
    expect(getShareOrigin('localhost')).toBeNull()
    expect(getShareOrigin('127.0.0.1')).toBeNull()
    expect(getShareOrigin('capgod.test')).toBeNull()
  })

  it('returns the production origin elsewhere', () => {
    expect(getShareOrigin('capgod.app')).toBe('capgod.app')
    expect(getShareOrigin()).toBe('capgod.app')
  })
})

describe('formatShareResult', () => {
  it('formats a winning share card with roster order and shortened seasons', () => {
    const text = formatShareResult({
      result: winResult,
      champion,
      roster,
      era: '2010s',
      capSpend: 68_400_000,
      capLimit: 70_000_000,
      host: 'capgod.app',
    })

    expect(text).toBe(
      [
        'CAP GOD 🏆',
        "W 112–108 vs '17 Warriors",
        'CAP $68.4M/$70M',
        "PG Stephen Curry '16",
        "SG Dwyane Wade '09",
        "SF LeBron James '13",
        "PF Kevin Garnett '04",
        "C Shaquille O'Neal '00",
        'capgod.app',
      ].join('\n'),
    )
  })

  it('formats losses without the trophy and with a tie marker', () => {
    const lossText = formatShareResult({
      result: { ...winResult, outcome: 'loss', won: false, userScore: 100, championScore: 105 },
      champion,
      roster,
      era: '2010s',
      capSpend: 68_400_000,
      capLimit: 70_000_000,
      host: 'capgod.app',
    })

    expect(lossText.startsWith('CAP GOD\nL 100–105')).toBe(true)
    expect(lossText.includes('🏆')).toBe(false)

    const tieText = formatShareResult({
      result: {
        ...winResult,
        outcome: 'push',
        won: false,
        userScore: 105,
        championScore: 105,
      },
      champion,
      roster,
      era: '2010s',
      capSpend: 68_400_000,
      capLimit: 70_000_000,
      host: 'capgod.app',
    })

    expect(tieText.includes('T 105–105')).toBe(true)
  })

  it('omits the origin line on localhost', () => {
    const text = formatShareResult({
      result: winResult,
      champion,
      roster,
      era: '2010s',
      capSpend: 68_400_000,
      capLimit: 70_000_000,
      host: 'localhost',
    })

    expect(text.endsWith('capgod.app')).toBe(false)
    expect(text.split('\n').at(-1)).toBe("C Shaquille O'Neal '00")
  })
})
