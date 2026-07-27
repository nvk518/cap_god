import type { BadgeId, GameOutcome, SessionRecord } from '../types/game'

const STORAGE_KEY = 'cap-god-session-progress-v1'

export interface ChampionRecord {
  attempts: number
  wins: number
}

export interface PersistentProgress {
  session: SessionRecord
  badgeCounts: Record<BadgeId, number>
  championRecords: Record<string, ChampionRecord>
  bestWinStreak: number
}

function createEmptyBadgeCounts(): Record<BadgeId, number> {
  return {
    capGod: 0,
    luxuryTaxFraud: 0,
    heartbreakLoss: 0,
    dynastyKiller: 0,
  }
}

export function createInitialPersistentProgress(): PersistentProgress {
  return {
    session: {
      wins: 0,
      losses: 0,
      pushes: 0,
      streak: 0,
      streakType: null,
    },
    badgeCounts: createEmptyBadgeCounts(),
    championRecords: {},
    bestWinStreak: 0,
  }
}

function readStorage(): PersistentProgress {
  if (typeof localStorage === 'undefined') {
    return createInitialPersistentProgress()
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createInitialPersistentProgress()
    }
    const parsed = JSON.parse(raw) as Partial<PersistentProgress>
    return {
      session: {
        wins: parsed.session?.wins ?? 0,
        losses: parsed.session?.losses ?? 0,
        pushes: parsed.session?.pushes ?? 0,
        streak: parsed.session?.streak ?? 0,
        streakType: parsed.session?.streakType ?? null,
      },
      badgeCounts: {
        ...createEmptyBadgeCounts(),
        ...parsed.badgeCounts,
      },
      championRecords: parsed.championRecords ?? {},
      bestWinStreak: parsed.bestWinStreak ?? 0,
    }
  } catch {
    return createInitialPersistentProgress()
  }
}

function writeStorage(progress: PersistentProgress): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function loadPersistentProgress(): PersistentProgress {
  return readStorage()
}

export function savePersistentProgress(progress: PersistentProgress): void {
  writeStorage(progress)
}

export function resetPersistentSession(): PersistentProgress {
  const current = readStorage()
  const next: PersistentProgress = {
    ...current,
    session: createInitialPersistentProgress().session,
  }
  writeStorage(next)
  return next
}

export function updatePersistentProgress(input: {
  outcome: GameOutcome
  championId: string
  badges: readonly BadgeId[]
}): PersistentProgress {
  const current = readStorage()
  const session = updateSession(current.session, input.outcome)
  const badgeCounts = { ...current.badgeCounts }
  for (const badge of input.badges) {
    badgeCounts[badge] += 1
  }

  const championRecord = current.championRecords[input.championId] ?? { attempts: 0, wins: 0 }
  const championRecords = {
    ...current.championRecords,
    [input.championId]: {
      attempts: championRecord.attempts + 1,
      wins: championRecord.wins + (input.outcome === 'win' ? 1 : 0),
    },
  }

  const bestWinStreak =
    session.streakType === 'win'
      ? Math.max(current.bestWinStreak, session.streak)
      : current.bestWinStreak

  const next: PersistentProgress = {
    session,
    badgeCounts,
    championRecords,
    bestWinStreak,
  }
  writeStorage(next)
  return next
}

function updateSession(session: SessionRecord, outcome: GameOutcome): SessionRecord {
  const next = { ...session }
  if (outcome === 'win') {
    next.wins += 1
  } else if (outcome === 'loss') {
    next.losses += 1
  } else {
    next.pushes += 1
  }

  if (session.streakType === outcome) {
    next.streak += 1
  } else {
    next.streak = 1
    next.streakType = outcome
  }
  return next
}

export function getChampionAttempts(
  progress: PersistentProgress,
  championId: string,
): number {
  return progress.championRecords[championId]?.attempts ?? 0
}
