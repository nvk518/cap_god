import type { Player } from '../schemas/player'
import type {
  ChampionTeam,
  Difficulty,
  EraId,
  GameOutcome,
  QuarterScore,
  SimRatingBreakdown,
  SimResult,
} from '../types/game'
import {
  DYNASTY_KILLER_RATING,
  HEARTBREAK_MARGIN,
} from '../types/game'
import { getEraBalance } from '../data/eras'
import { getGame7ScoreMidpoint, getScoringProfile } from '../data/scoringPace'
import { applyFinishDrama } from './finishDrama'
import { computeOverCapPenalty, isOverCap, type SeededRandom } from './draft'
import { buildRealisticQuarterScores } from './quarterScoring'

function randomInt(rng: SeededRandom, min: number, max: number): number {
  const span = max - min + 1
  return min + Math.floor(rng() * span)
}

function clampScore(score: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(score)))
}

const LEAD_LINES = [
  '{player} drills a corner three and the crowd erupts.',
  'Your squad pushes the pace — {player} finishes at the rim.',
  'Defense clamps down. {player} sparks a fast-break bucket.',
  'The arena is rocking. Your five are playing like champions.',
]

const DEFICIT_LINES = [
  '{champion} answers with a run. Momentum swings away.',
  'Turnover city. {champion} capitalizes in transition.',
  'Your bench looks nervous. {champion} smells blood.',
  'Timeout called. You need a stop and a bucket.',
]

const CLOSE_LINES = [
  'Tie game. Every possession feels like the Finals.',
  'Neither side blinks. This is pure Game 7 tension.',
  'One mistake decides it. The cap gods hold their breath.',
]

const PLAYER_FALLBACK = 'your star'

function pickLine(lines: readonly string[], rng: SeededRandom): string {
  const index = Math.floor(rng() * lines.length)
  return lines[index] ?? lines[0] ?? ''
}

function replaceToken(line: string, token: string, value: string): string {
  return line.split(token).join(value)
}

function fillPlayer(line: string, roster: readonly Player[], rng: SeededRandom): string {
  if (roster.length === 0) {
    return replaceToken(line, '{player}', PLAYER_FALLBACK)
  }

  const player = roster[Math.floor(rng() * roster.length)]
  const name = player?.player ?? PLAYER_FALLBACK
  return replaceToken(replaceToken(line, '{player}', name), '{champion}', 'the champs')
}

function fillChampion(line: string, champion: ChampionTeam): string {
  return replaceToken(replaceToken(line, '{champion}', champion.name), '{player}', PLAYER_FALLBACK)
}

export function sumPlayerRatings(roster: readonly Player[]): number {
  return roster.reduce((total, player) => total + player.rating, 0)
}

export function computeUserRating(
  roster: readonly Player[],
  eraId: EraId,
  capLimit: number,
  hitPenaltySpend = 0,
): number {
  const total = sumPlayerRatings(roster)
  return total - computeOverCapPenalty(roster, eraId, capLimit, hitPenaltySpend)
}

export function resolveOutcome(userScore: number, championScore: number): GameOutcome {
  if (userScore > championScore) {
    return 'win'
  }
  if (userScore < championScore) {
    return 'loss'
  }
  return 'push'
}

export function generateCommentary(
  roster: readonly Player[],
  champion: ChampionTeam,
  quarters: readonly QuarterScore[],
  rng: SeededRandom,
): string[] {
  const lines: string[] = []

  for (const quarter of quarters) {
    const margin = quarter.user - quarter.champion
    let template: string

    if (Math.abs(margin) <= 3) {
      template = pickLine(CLOSE_LINES, rng)
      lines.push(fillPlayer(template, roster, rng))
      continue
    }

    if (margin > 0) {
      template = pickLine(LEAD_LINES, rng)
      lines.push(fillPlayer(template, roster, rng))
      continue
    }

    template = pickLine(DEFICIT_LINES, rng)
    lines.push(fillChampion(template, champion))
  }

  return lines
}

export function assignBadges(
  result: SimResult,
  champion: ChampionTeam,
): import('../types/game').BadgeId[] {
  const badges: import('../types/game').BadgeId[] = []

  if (result.outcome === 'win' && !result.overCap) {
    badges.push('capGod')
  }

  if (result.overCap) {
    badges.push('luxuryTaxFraud')
  }

  if (result.outcome === 'loss' && result.margin <= HEARTBREAK_MARGIN) {
    badges.push('heartbreakLoss')
  }

  if (result.outcome === 'win' && champion.rating >= DYNASTY_KILLER_RATING) {
    badges.push('dynastyKiller')
  }

  return badges
}

export interface SimulateGame7Input {
  roster: readonly Player[]
  champion: ChampionTeam
  eraId: EraId
  difficulty: Difficulty
  capLimit: number
  hitPenaltySpend?: number
  rng: SeededRandom
}

export function simulateGame7({
  roster,
  champion,
  eraId,
  difficulty,
  capLimit,
  hitPenaltySpend = 0,
  rng,
}: SimulateGame7Input): SimResult {
  const balance = getEraBalance(eraId, difficulty)
  const overCap = isOverCap(roster, eraId, capLimit, hitPenaltySpend)
  const rawRating = sumPlayerRatings(roster)
  const overCapPenalty = computeOverCapPenalty(roster, eraId, capLimit, hitPenaltySpend)
  const userRating = rawRating - overCapPenalty
  const championNoise = randomInt(rng, -balance.championRatingNoise, balance.championRatingNoise)
  const championEffectiveRating = champion.rating + championNoise
  const championCombatRating = championEffectiveRating * balance.championCombatScale
  const expectedMargin = (userRating - championCombatRating) * balance.marginFactor
  const userScoreNoise = randomInt(rng, -3, 3)
  const championScoreNoise = randomInt(rng, -3, 3)
  const scoreProfile = getScoringProfile(champion.seasonYear, eraId)
  const midpoint = getGame7ScoreMidpoint(championEffectiveRating, champion.seasonYear, eraId)
  const rawUserScore = clampScore(
    midpoint + expectedMargin / 2 + userScoreNoise,
    scoreProfile.scoreMin,
    scoreProfile.scoreMax,
  )
  const rawChampionScore = clampScore(
    midpoint - expectedMargin / 2 + championScoreNoise,
    scoreProfile.scoreMin,
    scoreProfile.scoreMax,
  )
  const narrativeSeed = Math.floor(rng() * 1_000_000_000)
  const finish = applyFinishDrama({
    userScore: rawUserScore,
    championScore: rawChampionScore,
    userRating,
    championCombatRating,
    rng,
  })
  const userScore = finish.userScore
  const championScore = finish.championScore
  const regulationUser = finish.regulationScore?.user ?? userScore
  const regulationChampion = finish.regulationScore?.champion ?? championScore
  const quarterUser = finish.regulationRawScore?.user ?? regulationUser
  const quarterChampion = finish.regulationRawScore?.champion ?? regulationChampion
  const quarters = buildRealisticQuarterScores({
    finalUser: quarterUser,
    finalChampion: quarterChampion,
    userRating,
    championCombatRating,
    seasonYear: champion.seasonYear,
    eraId,
    rng,
    ...(finish.regulationScore
      ? { regulationTieTarget: finish.regulationScore }
      : {}),
  })
  const commentary = generateCommentary(roster, champion, quarters, rng)
  const outcome = resolveOutcome(userScore, championScore)
  const margin = Math.abs(userScore - championScore)

  const breakdown: SimRatingBreakdown = {
    rawRating,
    overCapPenalty,
    effectiveRating: userRating,
    championBaseRating: champion.rating,
    championNoise,
    championCombatRating,
    expectedMargin,
    userScoreNoise,
    championScoreNoise,
  }

  return {
    userScore,
    championScore,
    quarters,
    ...(finish.regulationScore ? { regulationScore: finish.regulationScore } : {}),
    ...(finish.overtime ? { overtime: finish.overtime } : {}),
    finishDrama: finish.finishDrama,
    narrativeSeed,
    userRating,
    championEffectiveRating,
    overCap,
    outcome,
    won: outcome === 'win',
    margin,
    commentary,
    breakdown,
  }
}
