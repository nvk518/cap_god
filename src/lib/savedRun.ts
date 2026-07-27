import type { EraId } from '../types/game'

const STORAGE_KEY = 'cap-god-saved-run-v2'

export interface SavedRun {
  era: EraId
}

function readStorage(): SavedRun | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return readLegacyStorage()
    }
    const parsed = JSON.parse(raw) as Partial<SavedRun>
    if (!parsed.era) {
      return null
    }
    return { era: parsed.era }
  } catch {
    return null
  }
}

function readLegacyStorage(): SavedRun | null {
  try {
    const raw = localStorage.getItem('cap-god-saved-run-v1')
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<{ era: EraId }>
    if (!parsed.era) {
      return null
    }
    return { era: parsed.era }
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
