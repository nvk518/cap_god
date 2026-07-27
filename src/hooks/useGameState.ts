import { useCallback, useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { pickRandomChampion } from '../data/champions'
import { getEraConfig } from '../data/eras'
import { loadPlayerPool } from '../data/playerRepository'
import type { Player } from '../schemas/player'
import {
  buildGameLogEntry,
  clearGameLogs,
  createEmptyPositionDecisions,
  exportGameLogsCsv,
  exportGameLogsJson,
  loadGameLogs,
  saveGameLog,
  type PositionDecision,
} from '../lib/gameLog'
import {
  beginAttempt,
  getEraChallengeRecord,
  loadChallengeProgress,
  recordChallengeClear,
  resetEraChallenge,
  type ChallengeProgress,
} from '../lib/challengeProgress'
import { loadSavedRun, saveSavedRun } from '../lib/savedRun'
import {
  canAdvance,
  canFlip,
  canHit,
  createSeededRandom,
  filterPoolByEra,
  getFinalStarters,
  getDraftCapSpend,
  hitOffer,
  initDraft,
  isDraftComplete,
  revealSalary,
  signOffer,
  type SeededRandom,
} from '../lib/draft'
import { assignBadges, simulateGame7 } from '../lib/rating'
import {
  loadPersistentProgress,
  resetPersistentSession,
  updatePersistentProgress,
  type PersistentProgress,
} from '../lib/sessionProgress'
import type { DraftState, EraId, GameState, SessionRecord } from '../types/game'
import { CHALLENGE_DIFFICULTY } from '../types/game'

function createInitialSession(): SessionRecord {
  return loadPersistentProgress().session
}

function createInitialState(): GameState {
  return {
    screen: 'start',
    era: null,
    champion: null,
    draft: null,
    simResult: null,
    badges: [],
    muted: false,
    seed: 0,
    session: createInitialSession(),
    attemptNumber: 0,
  }
}

export interface UseGameStateResult extends GameState {
  loading: boolean
  error: string | null
  lastEra: EraId
  challengeProgress: ChallengeProgress
  clearAttempts: number | null
  clearIsBest: boolean
  positionDecisions: PositionDecision[]
  persistentProgress: PersistentProgress
  onStartChallenge: (era: EraId) => void
  onStartDraft: () => void
  onSign: () => void
  onNextPosition: () => void
  onStartSim: () => void
  onHit: () => void
  onSimComplete: () => void
  onTryAgain: () => void
  onPlayAgain: () => void
  onRunItBack: () => void
  onToggleMute: () => void
  onRetryLoad: () => void
  onExportLogsJson: () => string
  onExportLogsCsv: () => string
  onClearLogs: () => void
}

export function useGameState(): UseGameStateResult {
  const [state, setState] = useState<GameState>(createInitialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEra, setLastEra] = useState<EraId>(loadSavedRun()?.era ?? '2000s')
  const [pool, setPool] = useState<Player[] | null>(null)
  const [persistentProgress, setPersistentProgress] = useState<PersistentProgress>(
    loadPersistentProgress,
  )
  const [challengeProgress, setChallengeProgress] = useState<ChallengeProgress>(
    loadChallengeProgress,
  )
  const [clearAttempts, setClearAttempts] = useState<number | null>(null)
  const [clearIsBest, setClearIsBest] = useState(false)
  const [positionDecisions, setPositionDecisions] = useState<PositionDecision[]>(
    createEmptyPositionDecisions,
  )
  const decisionsRef = useRef<PositionDecision[]>(createEmptyPositionDecisions())
  const rngRef = useRef<SeededRandom | null>(null)
  const seedRef = useRef(0)
  const pendingEraRef = useRef<EraId | null>(null)
  const previousChampionIdRef = useRef<string | null>(null)
  const loadGenerationRef = useRef(0)

  const beginChallenge = useCallback(
    async (
      era: EraId,
      options: {
        keepSession?: boolean
        skipToDraft?: boolean
        newAttempt?: boolean
        excludeChampionId?: string | null
      } = {},
    ) => {
      const {
        keepSession = false,
        skipToDraft = false,
        newAttempt = true,
        excludeChampionId = previousChampionIdRef.current,
      } = options
      const loadGeneration = loadGenerationRef.current + 1
      loadGenerationRef.current = loadGeneration
      setLoading(true)
      setError(null)
      pendingEraRef.current = era

      try {
        const players = await loadPlayerPool(era)
        if (loadGenerationRef.current !== loadGeneration) {
          return
        }

        const attemptNumber = newAttempt ? beginAttempt(era) : getEraChallengeRecord(era).attemptsSinceClear
        const seed = Date.now() >>> 0
        const rng = createSeededRandom(seed)
        const champion = pickRandomChampion(era, rng, excludeChampionId ?? undefined)
        const eraConfig = getEraConfig(era)
        const filtered = filterPoolByEra(players, era)
        const draft = skipToDraft ? initDraft(filtered, rng, era, eraConfig.cap) : null

        rngRef.current = rng
        seedRef.current = seed
        previousChampionIdRef.current = champion.id
        setPool(players)
        setLastEra(era)
        saveSavedRun({ era })
        setChallengeProgress(loadChallengeProgress())
        setPositionDecisions(createEmptyPositionDecisions())
        decisionsRef.current = createEmptyPositionDecisions()
        setState((current) => ({
          ...current,
          screen: skipToDraft ? 'draft' : 'champion',
          era,
          champion,
          draft,
          simResult: null,
          badges: [],
          seed,
          attemptNumber,
          session: keepSession ? current.session : loadPersistentProgress().session,
        }))
        pendingEraRef.current = null
        trackEvent('challenge_start', {
          era,
          attempt: attemptNumber,
          skip_to_draft: skipToDraft,
        })
      } catch (loadError) {
        if (loadGenerationRef.current !== loadGeneration) {
          return
        }

        const message =
          loadError instanceof Error ? loadError.message : 'Failed to load player data'
        trackEvent('load_error', { era, message })
        setError(message)
      } finally {
        if (loadGenerationRef.current === loadGeneration) {
          setLoading(false)
        }
      }
    },
    [],
  )

  const onStartChallenge = useCallback(
    (era: EraId) => {
      void beginChallenge(era)
    },
    [beginChallenge],
  )

  const onRetryLoad = useCallback(() => {
    const era = pendingEraRef.current ?? lastEra
    void beginChallenge(era, { newAttempt: false })
  }, [beginChallenge, lastEra])

  const onStartDraft = useCallback(() => {
    const rng = rngRef.current
    if (!rng || !pool || !state.era) {
      return
    }

    const eraConfig = getEraConfig(state.era)
    const filtered = filterPoolByEra(pool, state.era)
    const draft = initDraft(filtered, rng, state.era, eraConfig.cap)

    setPositionDecisions(createEmptyPositionDecisions())
    decisionsRef.current = createEmptyPositionDecisions()
    setState((current) => ({
      ...current,
      screen: 'draft',
      draft,
    }))
  }, [pool, state.era])

  const onSign = useCallback(() => {
    setState((current) => {
      if (!current.draft || !canFlip(current.draft)) {
        return current
      }
      return {
        ...current,
        draft: revealSalary(current.draft),
      }
    })
  }, [])

  const onNextPosition = useCallback(() => {
    setState((current) => {
      if (!current.draft || !current.draft.currentOffer || !current.era || !current.champion) {
        return current
      }

      let draft: DraftState = current.draft
      if (!canAdvance(draft)) {
        return current
      }

      const trackDecision = (decision: PositionDecision) => {
        decisionsRef.current = [...decisionsRef.current, decision]
        setPositionDecisions(decisionsRef.current)
      }

      const offer = draft.currentOffer!
      trackDecision({
        slot: draft.activeSlot,
        offerIndex: draft.offerIndex,
        playerId: offer.id,
        playerName: offer.player,
        action: 'sign',
        salaryRevealed: draft.salaryRevealed,
        forced: draft.forcedSign,
      })

      const nextDraft = signOffer(draft)
      return {
        ...current,
        draft: nextDraft,
      }
    })
  }, [])

  const onStartSim = useCallback(() => {
    setState((current) => {
      if (!current.draft || !isDraftComplete(current.draft) || !current.era || !current.champion) {
        return current
      }

      const starters = getFinalStarters(current.draft)
      const eraConfig = getEraConfig(current.era)
      const rng = rngRef.current
      if (!rng) {
        return current
      }

      const simResult = simulateGame7({
        roster: starters,
        champion: current.champion,
        eraId: current.era,
        difficulty: CHALLENGE_DIFFICULTY,
        capLimit: eraConfig.cap,
        hitPenaltySpend: current.draft.hitPenaltySpend,
        rng,
      })

      return {
        ...current,
        screen: 'sim',
        simResult,
        badges: [],
      }
    })
  }, [])

  const onHit = useCallback(() => {
    setState((current) => {
      if (!current.draft || !current.draft.currentOffer) {
        return current
      }
      if (!canHit(current.draft) || !current.era) {
        return current
      }

      const offer = current.draft.currentOffer
      decisionsRef.current = [
        ...decisionsRef.current,
        {
          slot: current.draft.activeSlot,
          offerIndex: current.draft.offerIndex,
          playerId: offer.id,
          playerName: offer.player,
          action: 'hit',
          salaryRevealed: false,
          forced: false,
        },
      ]
      setPositionDecisions(decisionsRef.current)

      return {
        ...current,
        draft: hitOffer(current.draft, current.era),
      }
    })
  }, [])

  const onSimComplete = useCallback(() => {
    setState((current) => {
      if (!current.simResult || !current.champion || !current.era || !current.draft) {
        return current
      }

      const starters = getFinalStarters(current.draft)
      const eraConfig = getEraConfig(current.era)
      const spend = getDraftCapSpend(starters, current.era, current.draft.hitPenaltySpend)

      saveGameLog(
        buildGameLogEntry({
          seed: current.seed,
          era: current.era,
          difficulty: CHALLENGE_DIFFICULTY,
          champion: current.champion,
          draft: current.draft,
          decisions: decisionsRef.current,
          starters,
          spend,
          capLimit: eraConfig.cap,
          sim: current.simResult,
        }),
      )

      const badges = assignBadges(current.simResult, current.champion)
      const progress = updatePersistentProgress({
        outcome: current.simResult.outcome,
        championId: current.champion.id,
        badges,
      })
      setPersistentProgress(progress)

      const won = current.simResult.outcome === 'win'
      let screen: GameState['screen'] = 'result'
      if (won) {
        const clearResult = recordChallengeClear(current.era)
        setClearAttempts(clearResult.attempts)
        setClearIsBest(clearResult.isBest)
        setChallengeProgress(loadChallengeProgress())
        screen = 'challengeClear'
        trackEvent('challenge_clear', {
          era: current.era,
          attempts: clearResult.attempts,
          is_best: clearResult.isBest,
          total_clears: clearResult.totalClears,
        })
      } else {
        trackEvent('challenge_retry', {
          era: current.era,
          outcome: current.simResult.outcome,
          attempt: current.attemptNumber,
        })
      }

      trackEvent('game_result', {
        outcome: current.simResult.outcome,
        era: current.era,
        champion_id: current.champion.id,
        margin: current.simResult.margin,
        badge_count: badges.length,
        cap_spend: spend,
        cap_limit: eraConfig.cap,
        attempt: current.attemptNumber,
      })

      return {
        ...current,
        screen,
        badges,
        session: progress.session,
      }
    })
  }, [])

  const onTryAgain = useCallback(() => {
    if (!state.era) {
      return
    }
    void beginChallenge(state.era, { keepSession: true })
  }, [beginChallenge, state.era])

  const onRunItBack = useCallback(() => {
    if (!state.era) {
      return
    }
    resetEraChallenge(state.era)
    const progress = resetPersistentSession()
    setPersistentProgress(progress)
    setChallengeProgress(loadChallengeProgress())
    setClearAttempts(null)
    setClearIsBest(false)
    void beginChallenge(state.era, { keepSession: false })
  }, [beginChallenge, state.era])

  const onPlayAgain = useCallback(() => {
    rngRef.current = null
    previousChampionIdRef.current = null
    setPool(null)
    setPositionDecisions(createEmptyPositionDecisions())
    setClearAttempts(null)
    setClearIsBest(false)
    setChallengeProgress(loadChallengeProgress())
    setPersistentProgress(loadPersistentProgress())
    setState((current) => ({
      ...createInitialState(),
      muted: current.muted,
      session: loadPersistentProgress().session,
    }))
  }, [])

  const onToggleMute = useCallback(() => {
    setState((current) => ({
      ...current,
      muted: !current.muted,
    }))
  }, [])

  const onExportLogsJson = useCallback(() => exportGameLogsJson(loadGameLogs()), [])

  const onExportLogsCsv = useCallback(() => exportGameLogsCsv(loadGameLogs()), [])

  const onClearLogs = useCallback(() => {
    clearGameLogs()
  }, [])

  useEffect(() => {
    if (loading || error) {
      return
    }
    trackEvent('screen_view', { screen: state.screen, era: state.era ?? undefined })
  }, [error, loading, state.era, state.screen])

  return {
    ...state,
    loading,
    error,
    lastEra,
    challengeProgress,
    clearAttempts,
    clearIsBest,
    positionDecisions,
    persistentProgress,
    onStartChallenge,
    onStartDraft,
    onSign,
    onNextPosition,
    onStartSim,
    onHit,
    onSimComplete,
    onTryAgain,
    onPlayAgain,
    onRunItBack,
    onToggleMute,
    onRetryLoad,
    onExportLogsJson,
    onExportLogsCsv,
    onClearLogs,
  }
}

export type { DraftState }
