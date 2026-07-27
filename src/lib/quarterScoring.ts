import { getScoringProfile } from '../data/scoringPace'
import type { EraId, QuarterScore } from '../types/game'
import type { SeededRandom } from './draft'

function randomInt(rng: SeededRandom, min: number, max: number): number {
  const span = max - min + 1
  return min + Math.floor(rng() * span)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function boundsForRemaining(
  remaining: number,
  quartersLeft: number,
  minQ: number,
  maxQ: number,
): { min: number; max: number } {
  return {
    min: Math.max(minQ, remaining - quartersLeft * maxQ),
    max: Math.min(maxQ, remaining - quartersLeft * minQ),
  }
}

function fixRoundedSum(values: number[], target: number): number[] {
  const rounded = [...values]
  let delta = target - rounded.reduce((sum, value) => sum + value, 0)

  for (let index = 0; delta !== 0 && index < 16; index += 1) {
    const targetIndex = index % rounded.length
    const step = delta > 0 ? 1 : -1
    const current = rounded[targetIndex]
    if (current !== undefined) {
      rounded[targetIndex] = current + step
      delta -= step
    }
  }

  return rounded
}

/** Quarter margins that sum to totalMargin with realistic lead swings. */
export function distributeMarginWeights(
  totalMargin: number,
  rng: SeededRandom,
): number[] {
  if (totalMargin === 0) {
    const margins: number[] = []
    let cumulative = 0

    for (let quarterIndex = 0; quarterIndex < 3; quarterIndex += 1) {
      let swing = randomInt(rng, -6, 6)
      if (swing === 0) {
        swing = rng() < 0.5 ? -2 : 2
      }
      margins.push(swing)
      cumulative += swing
    }

    margins.push(-cumulative)
    return margins
  }

  const sticks = Array.from({ length: 3 }, () => 0.2 + rng() * 0.9)
  const stickSum = sticks.reduce((sum, stick) => sum + stick, 0) + 0.2
  const shares = [...sticks.map((stick) => stick / stickSum), 0.2 / stickSum]
  const rawMargins = shares.map((share) => share * totalMargin)
  return fixRoundedSum(rawMargins, totalMargin)
}

export interface BuildQuarterScoresInput {
  finalUser: number
  finalChampion: number
  userRating: number
  championCombatRating: number
  seasonYear: number
  eraId: EraId
  rng: SeededRandom
  /** When set, Q1–Q3 follow the raw path and Q4 snaps to this tied regulation total. */
  regulationTieTarget?: { user: number; champion: number }
}

function allocateQuarterPoints(
  remainingUser: number,
  remainingChampion: number,
  quartersLeft: number,
  margin: number,
  profile: ReturnType<typeof getScoringProfile>,
  rng: SeededRandom,
): { userPoints: number; championPoints: number } {
  const paceNoise = randomInt(rng, -4, 4)
  const paceThisQuarter = profile.pointsPerQuarter + paceNoise
  const userTarget = Math.round(remainingUser / quartersLeft)
  const championTarget = Math.round(remainingChampion / quartersLeft)

  let userPoints = Math.round((paceThisQuarter * 2 + margin) / 2)
  let championPoints = Math.round((paceThisQuarter * 2 - margin) / 2)

  userPoints = Math.round((userPoints * 9 + userTarget * 11) / 20)
  championPoints = Math.round((championPoints * 9 + championTarget * 11) / 20)

  const swingNoise = randomInt(rng, -2, 2)
  userPoints += swingNoise
  championPoints -= swingNoise

  const maxSwing = Math.min(
    profile.maxQuarterMargin,
    Math.max(8, Math.ceil(Math.abs(margin)) + 5),
  )
  const currentMargin = userPoints - championPoints
  if (Math.abs(currentMargin) > maxSwing) {
    const adjust = (Math.abs(currentMargin) - maxSwing) / 2
    if (currentMargin > 0) {
      userPoints -= Math.ceil(adjust)
      championPoints += Math.floor(adjust)
    } else {
      userPoints += Math.floor(adjust)
      championPoints -= Math.ceil(adjust)
    }
  }

  const userBounds = boundsForRemaining(
    remainingUser,
    quartersLeft,
    profile.quarterMin,
    profile.quarterMax,
  )
  const championBounds = boundsForRemaining(
    remainingChampion,
    quartersLeft,
    profile.quarterMin,
    profile.quarterMax,
  )

  userPoints = clamp(userPoints, userBounds.min, userBounds.max)
  championPoints = clamp(championPoints, championBounds.min, championBounds.max)

  return { userPoints, championPoints }
}

export function buildRealisticQuarterScores({
  finalUser,
  finalChampion,
  userRating: _userRating,
  championCombatRating: _championCombatRating,
  seasonYear,
  eraId,
  rng,
  regulationTieTarget,
}: BuildQuarterScoresInput): QuarterScore[] {
  const profile = getScoringProfile(seasonYear, eraId)
  const totalMargin = finalUser - finalChampion
  const marginByQuarter = distributeMarginWeights(totalMargin, rng)

  const userQuarterPoints: number[] = []
  const championQuarterPoints: number[] = []

  let remainingUser = finalUser
  let remainingChampion = finalChampion

  for (let quarterIndex = 0; quarterIndex < 4; quarterIndex += 1) {
    const quartersLeft = 4 - quarterIndex
    const margin = marginByQuarter[quarterIndex] ?? 0

    if (quartersLeft === 1 && regulationTieTarget) {
      const priorUser = userQuarterPoints.reduce((sum, value) => sum + value, 0)
      const priorChampion = championQuarterPoints.reduce((sum, value) => sum + value, 0)
      userQuarterPoints.push(regulationTieTarget.user - priorUser)
      championQuarterPoints.push(regulationTieTarget.champion - priorChampion)
      break
    }

    if (quartersLeft === 1) {
      userQuarterPoints.push(remainingUser)
      championQuarterPoints.push(remainingChampion)
      break
    }

    const { userPoints, championPoints } = allocateQuarterPoints(
      remainingUser,
      remainingChampion,
      quartersLeft,
      margin,
      profile,
      rng,
    )

    userQuarterPoints.push(userPoints)
    championQuarterPoints.push(championPoints)
    remainingUser -= userPoints
    remainingChampion -= championPoints
  }

  let userRunning = 0
  let championRunning = 0

  return ([1, 2, 3, 4] as const).map((quarter, index) => {
    userRunning += userQuarterPoints[index] ?? 0
    championRunning += championQuarterPoints[index] ?? 0
    return {
      quarter,
      user: Math.round(userRunning),
      champion: Math.round(championRunning),
    }
  })
}
