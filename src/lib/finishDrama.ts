import type { SeededRandom } from './draft'
import { FINISH_GAME_WINNER_CHANCE, OT_CHANCE_MULTIPLIER } from '../types/game'

export interface SimFinishDrama {
  overtime: boolean
  gameWinner: boolean
  winnerSide?: 'user' | 'champion'
}

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
  finishDrama: SimFinishDrama
}

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
    const winner = resolveOvertimeWinner(userScore, championScore, strengthEdge, rng)
    const winnerOt = randomInt(rng, 4, 9)
    const loserOt = randomInt(rng, 0, Math.min(6, winnerOt - 1))
    const tieScore = regulationScore.user

    const finalUser =
      winner === 'user' ? tieScore + winnerOt : tieScore + loserOt
    const finalChampion =
      winner === 'champion' ? tieScore + winnerOt : tieScore + loserOt

    const gameWinnerRoll = rng() < computeGameWinnerChance()

    return {
      userScore: finalUser,
      championScore: finalChampion,
      regulationRawScore,
      regulationScore,
      overtime: {
        user: finalUser - tieScore,
        champion: finalChampion - tieScore,
      },
      finishDrama: {
        overtime: true,
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
