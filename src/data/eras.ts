import type { Difficulty, EraBalanceConfig, EraConfig, EraId } from '../types/game'
import {
  CHAMPION_COMBAT_SCALE,
  CHALLENGE_DIFFICULTY,
  PLAYER_ERA_CAPS,
  SIM_MARGIN_FACTOR,
  SIM_RATING_NOISE,
  TIME_MACHINE_CAP_POINTS,
} from '../types/game'

const CHALLENGE_BALANCE: EraBalanceConfig = {
  cap: 0,
  championCombatScale: CHAMPION_COMBAT_SCALE * 1.08,
  championRatingNoise: SIM_RATING_NOISE,
  marginFactor: SIM_MARGIN_FACTOR * 0.92,
}

const ERA_BALANCE_OVERRIDES: Record<EraId, Partial<EraBalanceConfig>> = {
  '2000s': { championCombatScale: 3.94, marginFactor: 0.33 },
  '2010s': { championCombatScale: 3.9, marginFactor: 0.34 },
  '2020s': { championCombatScale: 3.89, marginFactor: 0.35 },
  timeMachine: { championCombatScale: 3.95, marginFactor: 0.33 },
}

const ERA_CONFIGS: Record<EraId, EraConfig> = {
  '2000s': {
    id: '2000s',
    label: '2000s',
    cap: PLAYER_ERA_CAPS['2000s'],
    description: 'Shaq, Kobe, and the hand-check era. Draft under a $45M cap.',
    balance: { ...CHALLENGE_BALANCE, cap: PLAYER_ERA_CAPS['2000s'] },
  },
  '2010s': {
    id: '2010s',
    label: '2010s',
    cap: PLAYER_ERA_CAPS['2010s'],
    description: 'The superteam decade. Stretch the floor with a $65M cap.',
    balance: { ...CHALLENGE_BALANCE, cap: PLAYER_ERA_CAPS['2010s'] },
  },
  '2020s': {
    id: '2020s',
    label: '2020s',
    cap: PLAYER_ERA_CAPS['2020s'],
    description: 'Positionless hoops and max contracts. Build on a $100M cap.',
    balance: { ...CHALLENGE_BALANCE, cap: PLAYER_ERA_CAPS['2020s'] },
  },
  timeMachine: {
    id: 'timeMachine',
    label: 'Time Machine',
    cap: TIME_MACHINE_CAP_POINTS,
    description:
      'All eras, one roster. Salaries convert to Cap Points for cross-era value.',
    balance: { ...CHALLENGE_BALANCE, cap: TIME_MACHINE_CAP_POINTS },
  },
}

export const SELECTABLE_ERAS: readonly EraConfig[] = [
  ERA_CONFIGS['2000s'],
  ERA_CONFIGS['2010s'],
  ERA_CONFIGS['2020s'],
  ERA_CONFIGS.timeMachine,
]

export function getEraConfig(eraId: EraId): EraConfig {
  return ERA_CONFIGS[eraId]
}

export function getEraCap(eraId: EraId): number {
  return ERA_CONFIGS[eraId].cap
}

export function getEraBalance(eraId: EraId, _difficulty: Difficulty = CHALLENGE_DIFFICULTY): EraBalanceConfig {
  const overrides = ERA_BALANCE_OVERRIDES[eraId]
  const cap = ERA_CONFIGS[eraId].cap
  return {
    cap,
    championCombatScale: overrides.championCombatScale ?? CHALLENGE_BALANCE.championCombatScale,
    championRatingNoise: overrides.championRatingNoise ?? CHALLENGE_BALANCE.championRatingNoise,
    marginFactor: overrides.marginFactor ?? CHALLENGE_BALANCE.marginFactor,
  }
}
