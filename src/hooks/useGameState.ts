import { useCallback, useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { getNextChampion } from '../data/champions'
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
  isEraComplete,
  loadDefeatedChampions,
  markChampionDefeated,
  resetEraProgress,
} from '../lib/eraProgress'
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
  getChampionAttempts,
  loadPersistentProgress,
  resetPersistentSession,
  updatePersistentProgress,
  type PersistentProgress,
} from '../lib/sessionProgress'
import type {
  Difficulty,
  DraftState,
  EraId,
  GameState,
  SessionRecord,
} from '../types/game'

function createInitialSession(): SessionRecord {
  return loadPersistentProgress().session
}

function getResumableRun() {
  const saved = loadSavedRun()
  if (!saved) {
    return null
  }
  const defeatedChampionIds = loadDefeatedChampions(saved.era)
  if (isEraComplete(saved.era, defeatedChampionIds)) {
    return null
  }
  return saved
}

function createInitialState(): GameState {
  return {
    screen: 'start',
    era: null,
    difficulty: 'normal',
    champion: null,
    draft: null,
    simResult: null,
    badges: [],
    muted: false,
    seed: 0,
    session: createInitialSession(),
    defeatedChampionIds: [],
  }
}

export interface UseGameStateResult extends GameState {
  loading: boolean
  error: string | null
  lastEra: EraId
  lastDifficulty: Difficulty
  positionDecisions: PositionDecision[]
  persistentProgress: PersistentProgress
  championAttempts: number
  onSelectEra: (era: EraId) => void
  onSelectDifficulty: (difficulty: Difficulty) => void
  onStartDraft: () => void
  onSign: () => void
  onNextPosition: () => void
  onStartSim: () => void
  onHit: () => void
  onSimComplete: () => void
  onNextHand: () => void
  onPlayAgain: () => void
  onRunItBack: () => void
  onToggleMute: () => void
  onRetryLoad: () => void
  onExportLogsJson: () => string
  onExportLogsCsv: () => string
  onClearLogs: () => void
}

export function useGameState(): UseGameStateResult {
  const resumableRun = getResumableRun()
  const [state, setState] = useState<GameState>(createInitialState)
  const [loading, setLoading] = useState(Boolean(resumableRun))
  const [error, setError] = useState<string | null>(null)
  const [lastEra, setLastEra] = useState<EraId>(resumableRun?.era ?? loadSavedRun()?.era ?? '2000s')
  const [lastDifficulty, setLastDifficulty] = useState<Difficulty>(
    resumableRun?.difficulty ?? loadSavedRun()?.difficulty ?? 'normal',
  )
  const [pool, setPool] = useState<Player[] | null>(null)
  const [persistentProgress, setPersistentProgress] = useState<PersistentProgress>(
    loadPersistentProgress,
  )
  const [positionDecisions, setPositionDecisions] = useState<PositionDecision[]>(
    createEmptyPositionDecisions,
  )
  const decisionsRef = useRef<PositionDecision[]>(createEmptyPositionDecisions())
  const rngRef = useRef<SeededRandom | null>(null)
  const seedRef = useRef(0)
  const pendingEraRef = useRef<EraId | null>(null)
  const loadGenerationRef = useRef(0)
  const resumedRef = useRef(false)

  const beginEraLoad = useCallback(
    async (
      era: EraId,
      difficulty: Difficulty,
      options: {
        keepSession?: boolean
        resetProgress?: boolean
        skipToDraft?: boolean
      } = {},
    ) => {
      const { keepSession = false, resetProgress = false, skipToDraft = false } = options
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

        if (resetProgress) {
          resetEraProgress(era)
        }

        let defeatedChampionIds = loadDefeatedChampions(era)
        if (isEraComplete(era, defeatedChampionIds)) {
          resetEraProgress(era)
          defeatedChampionIds = []
        }

        const champion = getNextChampion(era, defeatedChampionIds)
        if (!champion) {
          throw new RangeError(`No champion available for era ${era}`)
        }

        const seed = Date.now() >>> 0
        const rng = createSeededRandom(seed)
        const eraConfig = getEraConfig(era)
        const filtered = filterPoolByEra(players, era)
        const draft = skipToDraft ? initDraft(filtered, rng, era, eraConfig.cap) : null

        rngRef.current = rng
        seedRef.current = seed
        setPool(players)
        setLastEra(era)
        setLastDifficulty(difficulty)
        saveSavedRun({ era, difficulty })
        setPositionDecisions(createEmptyPositionDecisions())
        decisionsRef.current = createEmptyPositionDecisions()
        setState((current) => ({
          ...current,
          screen: skipToDraft ? 'draft' : 'champion',
          era,
          difficulty,
          champion,
          draft,
          simResult: null,
          badges: [],
          seed,
          defeatedChampionIds,
          session: keepSession ? current.session : loadPersistentProgress().session,
        }))
        pendingEraRef.current = null
        trackEvent('game_start', {
          era,
          difficulty,
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

  const onSelectEra = useCallback(
    (era: EraId) => {
      const defeatedChampionIds = loadDefeatedChampions(era)
      const shouldReset = isEraComplete(era, defeatedChampionIds)
      void beginEraLoad(era, lastDifficulty, { resetProgress: shouldReset })
    },
    [beginEraLoad, lastDifficulty],
  )

  const onSelectDifficulty = useCallback((difficulty: Difficulty) => {
    setLastDifficulty(difficulty)
    const saved = loadSavedRun()
    if (saved) {
      saveSavedRun({ ...saved, difficulty })
    }
    setState((current) => ({ ...current, difficulty }))
  }, [])

  const onRetryLoad = useCallback(() => {
    const era = pendingEraRef.current ?? lastEra
    void beginEraLoad(era, lastDifficulty)
  }, [beginEraLoad, lastDifficulty, lastEra])

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
      if (!isDraftComplete(nextDraft)) {
        return {
          ...current,
          draft: nextDraft,
        }
      }

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
        difficulty: current.difficulty,
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
          difficulty: current.difficulty,
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

      let defeatedChampionIds = current.defeatedChampionIds
      if (current.simResult.outcome === 'win') {
        defeatedChampionIds = markChampionDefeated(current.era, current.champion.id)
      }

      const eraJustCompleted =
        current.simResult.outcome === 'win' && isEraComplete(current.era, defeatedChampionIds)

      trackEvent('game_result', {
        outcome: current.simResult.outcome,
        era: current.era,
        difficulty: current.difficulty,
        champion_id: current.champion.id,
        margin: current.simResult.margin,
        badge_count: badges.length,
        cap_spend: spend,
        cap_limit: eraConfig.cap,
      })
      if (eraJustCompleted) {
        trackEvent('era_complete', {
          era: current.era,
          difficulty: current.difficulty,
        })
      }

      return {
        ...current,
        screen: eraJustCompleted ? 'eraComplete' : 'result',
        badges,
        session: progress.session,
        defeatedChampionIds,
      }
    })
  }, [])

  const onNextHand = useCallback(() => {
    if (!state.era) {
      return
    }
    void beginEraLoad(state.era, state.difficulty, { keepSession: true, skipToDraft: true })
  }, [beginEraLoad, state.difficulty, state.era])

  const onRunItBack = useCallback(() => {
    if (!state.era) {
      return
    }
    resetEraProgress(state.era)
    const progress = resetPersistentSession()
    setPersistentProgress(progress)
    saveSavedRun({ era: state.era, difficulty: state.difficulty })
    void beginEraLoad(state.era, state.difficulty, { keepSession: false })
  }, [beginEraLoad, state.difficulty, state.era])

  const onPlayAgain = useCallback(() => {
    rngRef.current = null
    setPool(null)
    setPositionDecisions(createEmptyPositionDecisions())
    const defeatedChampionIds = state.era ? loadDefeatedChampions(state.era) : []
    setPersistentProgress(loadPersistentProgress())
    setState((current) => ({
      ...createInitialState(),
      muted: current.muted,
      difficulty: current.difficulty,
      session: loadPersistentProgress().session,
      defeatedChampionIds,
    }))
  }, [state.era])

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

  const storedAttempts = state.champion
    ? getChampionAttempts(persistentProgress, state.champion.id)
    : 0
  const championAttempts =
    state.screen === 'result' || state.screen === 'eraComplete'
      ? storedAttempts
      : storedAttempts + (state.champion ? 1 : 0)

  useEffect(() => {
    if (resumedRef.current) {
      return
    }
    const saved = getResumableRun()
    if (!saved) {
      return
    }
    resumedRef.current = true
    void beginEraLoad(saved.era, saved.difficulty, { keepSession: true })
  }, [beginEraLoad])

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
    lastDifficulty,
    positionDecisions,
    persistentProgress,
    championAttempts,
    onSelectEra,
    onSelectDifficulty,
    onStartDraft,
    onSign,
    onNextPosition,
    onStartSim,
    onHit,
    onSimComplete,
    onNextHand,
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
