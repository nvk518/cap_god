import type { Difficulty, EraBalanceConfig, EraConfig, EraId } from '../types/game'
import {
  CHAMPION_COMBAT_SCALE,
  PLAYER_ERA_CAPS,
  SIM_MARGIN_FACTOR,
  SIM_RATING_NOISE,
  TIME_MACHINE_CAP_POINTS,
} from '../types/game'

const NORMAL_BALANCE: EraBalanceConfig = {
  cap: 0,
  championCombatScale: CHAMPION_COMBAT_SCALE,
  championRatingNoise: SIM_RATING_NOISE,
  marginFactor: SIM_MARGIN_FACTOR,
}

const HARD_BALANCE: EraBalanceConfig = {
  cap: 0,
  championCombatScale: CHAMPION_COMBAT_SCALE * 1.08,
  championRatingNoise: SIM_RATING_NOISE,
  marginFactor: SIM_MARGIN_FACTOR * 0.92,
}

const ERA_BALANCE_OVERRIDES: Record<
  EraId,
  { normal: Partial<EraBalanceConfig>; hard: Partial<EraBalanceConfig> }
> = {
  '2000s': {
    normal: { championCombatScale: 3.84, marginFactor: 0.34 },
    hard: { championCombatScale: 3.96, marginFactor: 0.33 },
  },
  '2010s': {
    normal: { championCombatScale: 3.74, marginFactor: 0.35 },
    hard: { championCombatScale: 3.92, marginFactor: 0.34 },
  },
  '2020s': {
    normal: { championCombatScale: 3.79, marginFactor: 0.36 },
    hard: { championCombatScale: 3.91, marginFactor: 0.35 },
  },
  timeMachine: {
    normal: { championCombatScale: 3.80, marginFactor: 0.34 },
    hard: { championCombatScale: 3.94, marginFactor: 0.33 },
  },
}

const ERA_CONFIGS: Record<EraId, EraConfig> = {
  '2000s': {
    id: '2000s',
    label: '2000s',
    cap: PLAYER_ERA_CAPS['2000s'],
    description: 'Shaq, Kobe, and the hand-check era. Draft under a $50M cap.',
    balance: { ...NORMAL_BALANCE, cap: PLAYER_ERA_CAPS['2000s'] },
  },
  '2010s': {
    id: '2010s',
    label: '2010s',
    cap: PLAYER_ERA_CAPS['2010s'],
    description: 'The superteam decade. Stretch the floor with a $65M cap.',
    balance: { ...NORMAL_BALANCE, cap: PLAYER_ERA_CAPS['2010s'] },
  },
  '2020s': {
    id: '2020s',
    label: '2020s',
    cap: PLAYER_ERA_CAPS['2020s'],
    description: 'Positionless hoops and max contracts. Build on a $100M cap.',
    balance: { ...NORMAL_BALANCE, cap: PLAYER_ERA_CAPS['2020s'] },
  },
  timeMachine: {
    id: 'timeMachine',
    label: 'Time Machine',
    cap: TIME_MACHINE_CAP_POINTS,
    description:
      'All eras, one roster. Salaries convert to Cap Points for cross-era value.',
    balance: { ...NORMAL_BALANCE, cap: TIME_MACHINE_CAP_POINTS },
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

export function getEraBalance(eraId: EraId, difficulty: Difficulty): EraBalanceConfig {
  const base = difficulty === 'hard' ? HARD_BALANCE : NORMAL_BALANCE
  const overrides = ERA_BALANCE_OVERRIDES[eraId][difficulty]
  const cap = ERA_CONFIGS[eraId].cap
  return {
    cap,
    championCombatScale: overrides.championCombatScale ?? base.championCombatScale,
    championRatingNoise: overrides.championRatingNoise ?? base.championRatingNoise,
    marginFactor: overrides.marginFactor ?? base.marginFactor,
  }
}
