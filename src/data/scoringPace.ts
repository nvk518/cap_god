import type { EraId } from '../types/game'

/** League-average team points per game (Basketball-Reference / StatMuse). */
const SEASON_TEAM_PPG: Readonly<Record<number, number>> = {
  2000: 97.5,
  2001: 94.8,
  2002: 95.5,
  2003: 95.1,
  2004: 93.4,
  2005: 94.8,
  2006: 97.5,
  2007: 99.4,
  2008: 99.5,
  2009: 100.0,
  2010: 100.4,
  2011: 99.6,
  2012: 96.3,
  2013: 98.1,
  2014: 101.0,
  2015: 100.0,
  2016: 102.7,
  2017: 109.9,
  2018: 108.6,
  2019: 111.2,
  2020: 111.8,
  2021: 112.1,
  2022: 113.7,
  2023: 114.5,
  2024: 115.6,
  2025: 114.5,
}

const ERA_DEFAULT_PPG: Record<Exclude<EraId, 'timeMachine'>, number> = {
  '2000s': 96.9,
  '2010s': 102.2,
  '2020s': 112.7,
}

/** Finals Game 7s tend to score ~3–5% below regular-season pace. */
export const GAME7_PACE_FACTOR = 0.96

export interface ScoringProfile {
  seasonYear: number
  teamPpg: number
  game7TeamPpg: number
  pointsPerQuarter: number
  quarterMin: number
  quarterMax: number
  maxQuarterMargin: number
  scoreMin: number
  scoreMax: number
}

function resolveTeamPpg(seasonYear: number, eraId: EraId): number {
  const exact = SEASON_TEAM_PPG[seasonYear]
  if (exact !== undefined) {
    return exact
  }

  if (eraId !== 'timeMachine') {
    return ERA_DEFAULT_PPG[eraId]
  }

  if (seasonYear < 2010) {
    return ERA_DEFAULT_PPG['2000s']
  }
  if (seasonYear < 2020) {
    return ERA_DEFAULT_PPG['2010s']
  }
  return ERA_DEFAULT_PPG['2020s']
}

export function getScoringProfile(seasonYear: number, eraId: EraId): ScoringProfile {
  const teamPpg = resolveTeamPpg(seasonYear, eraId)
  const game7TeamPpg = Math.round(teamPpg * GAME7_PACE_FACTOR)
  const pointsPerQuarter = Math.round(game7TeamPpg / 4)

  return {
    seasonYear,
    teamPpg,
    game7TeamPpg,
    pointsPerQuarter,
    quarterMin: Math.max(16, Math.floor(pointsPerQuarter * 0.72)),
    quarterMax: Math.min(40, Math.ceil(pointsPerQuarter * 1.32)),
    maxQuarterMargin: 14,
    scoreMin: Math.max(75, game7TeamPpg - 18),
    scoreMax: Math.min(138, game7TeamPpg + 22),
  }
}

/** Expected Game 7 total for a champion team given era pace and strength. */
export function getGame7ScoreMidpoint(
  championEffectiveRating: number,
  seasonYear: number,
  eraId: EraId,
): number {
  const profile = getScoringProfile(seasonYear, eraId)
  const championBoost = Math.round((championEffectiveRating - 100) * 0.15)
  return profile.game7TeamPpg + championBoost
}
