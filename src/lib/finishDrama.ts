import type { SeededRandom } from './draft'
import type { SimFinishDrama } from '../types/game'
import { FINISH_GAME_WINNER_CHANCE, OT_CHANCE_MULTIPLIER } from '../types/game'

export type { SimFinishDrama }

export interface FinishDramaInput {
  userScore: number
  championScore: number
  userRating: number
  /** Scaled opponent strength (combat rating), comparable to the five-player user sum. */
  championCombatRating: number
  rng: SeededRandom
}

export interface FinishDramaResult {
  userScore: number
  championScore: number
  /** Raw regulation totals before an OT snap to a tie. */
  regulationRawScore?: { user: number; champion: number }
  regulationScore?: { user: number; champion: number }
  overtime?: { user: number; champion: number }
  overtimePeriods?: Array<{ user: number; champion: number }>
  finishDrama: SimFinishDrama
}

const MAX_OVERTIME_PERIODS = 3
const DOUBLE_OT_CHANCE = 0.5
const TRIPLE_OT_CHANCE = 0.5

function randomInt(rng: SeededRandom, min: number, max: number): number {
  const span = max - min + 1
  return min + Math.floor(rng() * span)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function computeStrengthEdge(userRating: number, championCombatRating: number): number {
  return clamp((userRating - championCombatRating) / 40, -1, 1)
}

/** Close games and evenly matched teams see more overtime — roughly 3% to 21%. */
export function computeOvertimeChance(strengthEdge: number, scoreMargin: number): number {
  const closenessBonus = clamp(1 - scoreMargin / 10, 0, 1) * 0.08
  const evenMatchupBonus = (1 - Math.abs(strengthEdge)) * clamp(1 - scoreMargin / 8, 0, 1) * 0.05
  return (0.02 + closenessBonus + evenMatchupBonus) * OT_CHANCE_MULTIPLIER
}

export function computeGameWinnerChance(): number {
  return FINISH_GAME_WINNER_CHANCE
}

function resolveOvertimeWinner(
  userScore: number,
  championScore: number,
  strengthEdge: number,
  rng: SeededRandom,
): 'user' | 'champion' {
  if (userScore > championScore) {
    return 'user'
  }
  if (championScore > userScore) {
    return 'champion'
  }

  const roll = rng() + strengthEdge * 0.075
  return roll >= 0.5 ? 'user' : 'champion'
}

function snapRegulationToTie(
  userScore: number,
  championScore: number,
): { user: number; champion: number } {
  const leader = Math.max(userScore, championScore)
  const trailer = Math.min(userScore, championScore)
  const gap = leader - trailer
  const shift = Math.ceil(gap / 2)
  const tied = trailer + shift
  return { user: tied, champion: tied }
}

function scoreTiedOvertimePeriod(
  tieScore: number,
  rng: SeededRandom,
): { user: number; champion: number } {
  const periodPoints = randomInt(rng, 2, 6)
  return { user: tieScore + periodPoints, champion: tieScore + periodPoints }
}

function scoreDecisiveOvertimePeriod(
  tieScore: number,
  strengthEdge: number,
  regulationUser: number,
  regulationChampion: number,
  rng: SeededRandom,
): { user: number; champion: number; winner: 'user' | 'champion' } {
  const winner = resolveOvertimeWinner(regulationUser, regulationChampion, strengthEdge, rng)
  const winnerOt = randomInt(rng, 4, 9)
  const loserOt = randomInt(rng, 0, Math.min(6, winnerOt - 1))

  if (winner === 'user') {
    return {
      user: tieScore + winnerOt,
      champion: tieScore + loserOt,
      winner,
    }
  }

  return {
    user: tieScore + loserOt,
    champion: tieScore + winnerOt,
    winner,
  }
}

function playOvertimePeriods(
  regulationScore: { user: number; champion: number },
  regulationUser: number,
  regulationChampion: number,
  strengthEdge: number,
  rng: SeededRandom,
): {
  overtimePeriods: Array<{ user: number; champion: number }>
  winner: 'user' | 'champion'
} {
  const overtimePeriods: Array<{ user: number; champion: number }> = []
  let currentUser = regulationScore.user
  let currentChampion = regulationScore.champion
  let winner: 'user' | 'champion' = 'user'

  for (let period = 1; period <= MAX_OVERTIME_PERIODS; period += 1) {
    const tieScore = currentUser
    const continueToNext =
      period < MAX_OVERTIME_PERIODS &&
      (period === 1 ? rng() < DOUBLE_OT_CHANCE : rng() < TRIPLE_OT_CHANCE)

    if (continueToNext) {
      const tiedPeriod = scoreTiedOvertimePeriod(tieScore, rng)
      currentUser = tiedPeriod.user
      currentChampion = tiedPeriod.champion
      overtimePeriods.push({ user: currentUser, champion: currentChampion })
      continue
    }

    const decisive = scoreDecisiveOvertimePeriod(
      tieScore,
      strengthEdge,
      regulationUser,
      regulationChampion,
      rng,
    )
    currentUser = decisive.user
    currentChampion = decisive.champion
    winner = decisive.winner
    overtimePeriods.push({ user: currentUser, champion: currentChampion })
    break
  }

  return { overtimePeriods, winner }
}

export function applyFinishDrama({
  userScore,
  championScore,
  userRating,
  championCombatRating,
  rng,
}: FinishDramaInput): FinishDramaResult {
  const strengthEdge = computeStrengthEdge(userRating, championCombatRating)
  const scoreMargin = Math.abs(userScore - championScore)
  const otChance = computeOvertimeChance(strengthEdge, scoreMargin)

  if (rng() < otChance) {
    const regulationRawScore = { user: userScore, champion: championScore }
    const regulationScore = snapRegulationToTie(userScore, championScore)
    const { overtimePeriods, winner } = playOvertimePeriods(
      regulationScore,
      userScore,
      championScore,
      strengthEdge,
      rng,
    )
    const lastPeriod = overtimePeriods[overtimePeriods.length - 1]!
    const tieScore = regulationScore.user
    const gameWinnerRoll = rng() < computeGameWinnerChance()

    return {
      userScore: lastPeriod.user,
      championScore: lastPeriod.champion,
      regulationRawScore,
      regulationScore,
      overtime: {
        user: lastPeriod.user - tieScore,
        champion: lastPeriod.champion - tieScore,
      },
      overtimePeriods,
      finishDrama: {
        overtime: true,
        overtimePeriodCount: overtimePeriods.length,
        gameWinner: gameWinnerRoll,
        winnerSide: winner,
      },
    }
  }

  const outcomeSide: 'user' | 'champion' | null =
    userScore > championScore ? 'user' : championScore > userScore ? 'champion' : null

  if (outcomeSide && rng() < computeGameWinnerChance()) {
    const margin = Math.abs(userScore - championScore)
    const targetMargin = margin <= 3 ? margin : randomInt(rng, 1, 3)

    if (outcomeSide === 'user') {
      return {
        userScore,
        championScore: userScore - targetMargin,
        finishDrama: {
          overtime: false,
          gameWinner: true,
          winnerSide: 'user',
        },
      }
    }

    return {
      userScore: championScore - targetMargin,
      championScore,
      finishDrama: {
        overtime: false,
        gameWinner: true,
        winnerSide: 'champion',
      },
    }
  }

  return {
    userScore,
    championScore,
    finishDrama: {
      overtime: false,
      gameWinner: false,
    },
  }
}
