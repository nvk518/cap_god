import type { Player } from '../schemas/player'
import type {
  ChampionTeam,
  Difficulty,
  DraftState,
  EraId,
  GameOutcome,
  LineupSlot,
  SimResult,
} from '../types/game'
import { DATA_SCHEMA_VERSION, GAME_LOG_MAX_ENTRIES, GAME_LOG_STORAGE_KEY, RULES_VERSION } from '../types/game'

export interface PositionDecision {
  slot: LineupSlot
  offerIndex: number
  playerId: string
  playerName: string
  action: 'hit' | 'sign'
  salaryRevealed: boolean
  forced: boolean
}

export interface GameLogEntry {
  version: string
  rulesVersion: string
  dataVersion: string
  loggedAt: string
  seed: number
  era: EraId
  difficulty: Difficulty
  champion: ChampionTeam
  positionPackets: Record<LineupSlot, readonly Player[]>
  decisions: PositionDecision[]
  starters: Player[]
  spend: number
  capLimit: number
  sim: SimResult
  outcome: GameOutcome
}

function isStorageAvailable(): boolean {
  try {
    const key = '__cap_god_test__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function buildGameLogEntry(input: {
  seed: number
  era: EraId
  difficulty: Difficulty
  champion: ChampionTeam
  draft: DraftState
  decisions: PositionDecision[]
  starters: Player[]
  spend: number
  capLimit: number
  sim: SimResult
}): GameLogEntry {
  return {
    version: '2',
    rulesVersion: RULES_VERSION,
    dataVersion: DATA_SCHEMA_VERSION,
    loggedAt: new Date().toISOString(),
    seed: input.seed,
    era: input.era,
    difficulty: input.difficulty,
    champion: input.champion,
    positionPackets: input.draft.positionPackets,
    decisions: input.decisions,
    starters: input.starters,
    spend: input.spend,
    capLimit: input.capLimit,
    sim: input.sim,
    outcome: input.sim.outcome,
  }
}

export function loadGameLogs(): GameLogEntry[] {
  if (!isStorageAvailable()) {
    return []
  }
  try {
    const raw = localStorage.getItem(GAME_LOG_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as GameLogEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGameLog(entry: GameLogEntry): void {
  if (!isStorageAvailable()) {
    return
  }
  try {
    const existing = loadGameLogs()
    const next = [entry, ...existing].slice(0, GAME_LOG_MAX_ENTRIES)
    localStorage.setItem(GAME_LOG_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Never block gameplay on logging failures.
  }
}

export function clearGameLogs(): void {
  if (!isStorageAvailable()) {
    return
  }
  try {
    localStorage.removeItem(GAME_LOG_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function exportGameLogsJson(logs: readonly GameLogEntry[]): string {
  return JSON.stringify(logs, null, 2)
}

export function exportGameLogsCsv(logs: readonly GameLogEntry[]): string {
  const headers = [
    'loggedAt',
    'seed',
    'era',
    'difficulty',
    'championId',
    'outcome',
    'userScore',
    'championScore',
    'userRating',
    'spend',
    'capLimit',
    'overCap',
  ]
  const rows = logs.map((log) =>
    [
      log.loggedAt,
      log.seed,
      log.era,
      log.difficulty,
      log.champion.id,
      log.outcome,
      log.sim.userScore,
      log.sim.championScore,
      log.sim.userRating,
      log.spend,
      log.capLimit,
      log.sim.overCap,
    ].join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

export function createEmptyPositionDecisions(): PositionDecision[] {
  return []
}

export function trackPositionDecision(
  decisions: PositionDecision[],
  slot: LineupSlot,
  offerIndex: number,
  player: Player,
  action: 'hit' | 'sign',
  salaryRevealed: boolean,
  forced: boolean,
): PositionDecision[] {
  return [
    ...decisions,
    {
      slot,
      offerIndex,
      playerId: player.id,
      playerName: player.player,
      action,
      salaryRevealed,
      forced,
    },
  ]
}

/** @deprecated Use PositionDecision */
export type OfferDecision = PositionDecision

/** @deprecated Use createEmptyPositionDecisions */
export function createEmptyOfferDecisions(): PositionDecision[] {
  return createEmptyPositionDecisions()
}

/** @deprecated Use trackPositionDecision */
export function trackOfferDecision(
  decisions: PositionDecision[],
  offerIndex: number,
  player: Player,
  action: 'pass' | 'sign',
  salaryRevealed: boolean,
  forced: boolean,
): PositionDecision[] {
  return trackPositionDecision(
    decisions,
    'PG',
    offerIndex,
    player,
    action === 'pass' ? 'hit' : 'sign',
    salaryRevealed,
    forced,
  )
}

export type { DraftState }
