import type { Difficulty, EraId } from '../types/game'

const STORAGE_KEY = 'cap-god-saved-run-v1'

export interface SavedRun {
  era: EraId
  difficulty: Difficulty
}

function readStorage(): SavedRun | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<SavedRun>
    if (!parsed.era || !parsed.difficulty) {
      return null
    }
    return {
      era: parsed.era,
      difficulty: parsed.difficulty,
    }
  } catch {
    return null
  }
}

export function loadSavedRun(): SavedRun | null {
  return readStorage()
}

export function saveSavedRun(run: SavedRun): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(run))
}

export function clearSavedRun(): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.removeItem(STORAGE_KEY)
}
