import type { EraId } from '../types/game'

const STORAGE_KEY = 'cap-god-challenge-progress-v1'

export interface EraChallengeRecord {
  attemptsSinceClear: number
  totalClears: number
  bestClearAttempts: number | null
}

export interface ChallengeProgress {
  eras: Partial<Record<EraId, EraChallengeRecord>>
}

function createEmptyEraRecord(): EraChallengeRecord {
  return {
    attemptsSinceClear: 0,
    totalClears: 0,
    bestClearAttempts: null,
  }
}

function readStorage(): ChallengeProgress {
  if (typeof localStorage === 'undefined') {
    return { eras: {} }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { eras: {} }
    }
    return JSON.parse(raw) as ChallengeProgress
  } catch {
    return { eras: {} }
  }
}

function writeStorage(progress: ChallengeProgress): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function loadChallengeProgress(): ChallengeProgress {
  return readStorage()
}

export function getEraChallengeRecord(eraId: EraId): EraChallengeRecord {
  return readStorage().eras[eraId] ?? createEmptyEraRecord()
}

export function beginAttempt(eraId: EraId): number {
  const progress = readStorage()
  const record = progress.eras[eraId] ?? createEmptyEraRecord()
  record.attemptsSinceClear += 1
  progress.eras[eraId] = record
  writeStorage(progress)
  return record.attemptsSinceClear
}

export function recordChallengeClear(eraId: EraId): {
  attempts: number
  isBest: boolean
  totalClears: number
} {
  const progress = readStorage()
  const record = progress.eras[eraId] ?? createEmptyEraRecord()
  const attempts = record.attemptsSinceClear
  const isBest = record.bestClearAttempts === null || attempts < record.bestClearAttempts
  record.totalClears += 1
  if (isBest) {
    record.bestClearAttempts = attempts
  }
  record.attemptsSinceClear = 0
  progress.eras[eraId] = record
  writeStorage(progress)
  return { attempts, isBest, totalClears: record.totalClears }
}

export function resetEraChallenge(eraId: EraId): void {
  const progress = readStorage()
  delete progress.eras[eraId]
  writeStorage(progress)
}
