import { getChampionsByEraOrdered, isEraComplete } from '../data/champions'
import type { EraId } from '../types/game'

const STORAGE_KEY = 'cap-god-era-progress-v1'

export type EraProgressMap = Partial<Record<EraId, string[]>>

function readStorage(): EraProgressMap {
  if (typeof localStorage === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    return JSON.parse(raw) as EraProgressMap
  } catch {
    return {}
  }
}

function writeStorage(map: EraProgressMap): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function loadDefeatedChampions(eraId: EraId): string[] {
  return [...(readStorage()[eraId] ?? [])]
}

export function markChampionDefeated(eraId: EraId, championId: string): string[] {
  const map = readStorage()
  const defeated = new Set(map[eraId] ?? [])
  defeated.add(championId)
  const next = [...defeated]
  map[eraId] = next
  writeStorage(map)
  return next
}

export function resetEraProgress(eraId: EraId): void {
  const map = readStorage()
  delete map[eraId]
  writeStorage(map)
}

export function loadAllEraProgress(): EraProgressMap {
  return readStorage()
}

export function getEraProgressStats(eraId: EraId): {
  defeated: number
  total: number
  complete: boolean
} {
  const defeatedIds = loadDefeatedChampions(eraId)
  const total = getChampionsByEraOrdered(eraId).length
  return {
    defeated: defeatedIds.length,
    total,
    complete: isEraComplete(eraId, defeatedIds),
  }
}

export function getRemainingChampions(eraId: EraId, defeatedIds: readonly string[]) {
  return getChampionsByEraOrdered(eraId).filter(
    (champion) => !defeatedIds.includes(champion.id),
  )
}

export function getDefeatedChampions(eraId: EraId, defeatedIds: readonly string[]) {
  return getChampionsByEraOrdered(eraId).filter((champion) =>
    defeatedIds.includes(champion.id),
  )
}

export { isEraComplete }
