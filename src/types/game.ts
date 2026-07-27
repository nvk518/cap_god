import type { Player, PlayerEra, Position } from '../schemas/player'

export type { Player, PlayerEra, Position }

export type EraId = '2000s' | '2010s' | '2020s' | 'timeMachine'

export type Difficulty = 'normal' | 'hard'

/** Canonical blind-contract difficulty for the single-opponent challenge. */
export const CHALLENGE_DIFFICULTY: Difficulty = 'hard'

export type Screen = 'start' | 'champion' | 'draft' | 'sim' | 'result' | 'challengeClear'

export type BadgeId =
  | 'capGod'
  | 'luxuryTaxFraud'
  | 'heartbreakLoss'
  | 'dynastyKiller'

export type SalaryTag = 'cheap' | 'neutral' | 'bloat'

export type GameOutcome = 'win' | 'loss' | 'push'

export type LineupSlot = Position

export const LINEUP_SLOTS: readonly LineupSlot[] = ['PG', 'SG', 'SF', 'PF', 'C']

export interface ChampionTeam {
  id: string
  name: string
  rating: number
  era: PlayerEra
  seasonYear: number
}

export interface EraBalanceConfig {
  cap: number
  championCombatScale: number
  championRatingNoise: number
  marginFactor: number
}

export interface EraConfig {
  id: EraId
  label: string
  cap: number
  description: string
  balance: EraBalanceConfig
}

export interface DraftState {
  activeSlot: LineupSlot
  slotIndex: number
  starters: Partial<Record<LineupSlot, Player>>
  currentOffer: Player | null
  remainingPacket: Player[]
  offerIndex: number
  salaryRevealed: boolean
  forcedSign: boolean
  usedNames: string[]
  positionPackets: Record<LineupSlot, readonly Player[]>
  overflowQueues: Record<LineupSlot, readonly Player[]>
  hitsThisSlot: number
  hitPenaltySpend: number
  /** Player names already offered at the active slot (blocks multi-season duplicates on hit). */
  seenNamesThisSlot: string[]
}

export interface QuarterScore {
  quarter: 1 | 2 | 3 | 4
  user: number
  champion: number
}

export interface SimRatingBreakdown {
  rawRating: number
  overCapPenalty: number
  effectiveRating: number
  championBaseRating: number
  championNoise: number
  championCombatRating: number
  expectedMargin: number
  userScoreNoise: number
  championScoreNoise: number
}

export interface SimFinishDrama {
  overtime: boolean
  gameWinner: boolean
  winnerSide?: 'user' | 'champion'
}

export interface SimResult {
  userScore: number
  championScore: number
  quarters: QuarterScore[]
  regulationScore?: { user: number; champion: number }
  overtime?: { user: number; champion: number }
  finishDrama: SimFinishDrama
  narrativeSeed: number
  userRating: number
  championEffectiveRating: number
  overCap: boolean
  outcome: GameOutcome
  won: boolean
  margin: number
  commentary: string[]
  breakdown: SimRatingBreakdown
}

export interface SessionRecord {
  wins: number
  losses: number
  pushes: number
  streak: number
  streakType: GameOutcome | null
}

export interface GameState {
  screen: Screen
  era: EraId | null
  champion: ChampionTeam | null
  draft: DraftState | null
  simResult: SimResult | null
  badges: BadgeId[]
  muted: boolean
  seed: number
  session: SessionRecord
  /** 1-based attempt number for the current era challenge since last clear. */
  attemptNumber: number
}

export const RULES_VERSION = '3.0.0'
export const DATA_SCHEMA_VERSION = '1.1.0'

export const DRAFT_OFFERS_PER_SLOT = 3
export const FREE_HITS_PER_SLOT = 3
export const DRAFT_STARTER_COUNT = 5
export const DRAFT_SIGN_COUNT = DRAFT_STARTER_COUNT
export const DRAFT_OFFER_COUNT = DRAFT_SIGN_COUNT * DRAFT_OFFERS_PER_SLOT
export const DRAFT_ROSTER_SIZE = DRAFT_STARTER_COUNT

export const OVER_CAP_PENALTY = 20
/** Extra rating penalty per 1% of cap exceeded (applied on top of OVER_CAP_PENALTY). */
export const OVER_CAP_PENALTY_SCALE = 50
export const TIME_MACHINE_CAP_POINTS = 100
export const TIME_MACHINE_MIN_CAP_POINTS = 3

export const PLAYER_ERA_CAPS: Record<PlayerEra, number> = {
  '2000s': 45_000_000,
  '2010s': 65_000_000,
  '2020s': 100_000_000,
}

export const SALARY_CHEAP_THRESHOLD = 0.2
export const SALARY_BLOAT_THRESHOLD = 0.7

export const SIM_RATING_NOISE = 5
export const SIM_SCORE_NOISE = 3
/** Scales all sim score/rating noise — lower means fewer upsets. */
export const SIM_NOISE_SCALE = 0.5
export const SIM_MARGIN_FACTOR = 0.35
export const OT_CHANCE_MULTIPLIER = 1.5
export const SIM_SCORE_MIN = 85
export const SIM_SCORE_MAX = 130

export const CHAMPION_COMBAT_SCALE = 3.35

/** Relative weight when building draft offers; higher tiers surface more often. */
export const DRAFT_OFFER_WEIGHT_90 = 1.5
export const DRAFT_OFFER_WEIGHT_85 = 1.28
export const DRAFT_OFFER_WEIGHT_80 = 1.1
export const DRAFT_OFFER_WEIGHT_77 = 1.02
export const DRAFT_OFFER_WEIGHT_FLOOR = 0.92

export const DYNASTY_KILLER_RATING = 115
export const HEARTBREAK_MARGIN = 3
export const FINISH_GAME_WINNER_CHANCE = 0.05

export const GAME_LOG_STORAGE_KEY = 'cap-god-game-logs-v2'
export const GAME_LOG_MAX_ENTRIES = 50
