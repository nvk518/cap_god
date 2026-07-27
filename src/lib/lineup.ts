import type { Player, Position } from '../schemas/player'
import { playerEligibleAt } from '../schemas/player'
import { LINEUP_SLOTS, type LineupSlot } from '../types/game'

export function getBenchPlayers(signed: readonly Player[], starterIds: readonly string[]): Player[] {
  const starterSet = new Set(starterIds)
  return signed.filter((player) => !starterSet.has(player.id))
}

export function getStartersFromAssignments(
  signed: readonly Player[],
  assignments: Partial<Record<LineupSlot, string>>,
): Player[] {
  return LINEUP_SLOTS.map((slot) => {
    const id = assignments[slot]
    return signed.find((player) => player.id === id) ?? null
  }).filter((player): player is Player => player !== null)
}

export function isLineupComplete(assignments: Partial<Record<LineupSlot, string>>): boolean {
  return LINEUP_SLOTS.every((slot) => {
    const id = assignments[slot]
    return typeof id === 'string' && id.length > 0
  })
}

export function canAssignPlayerToSlot(
  signed: readonly Player[],
  assignments: Partial<Record<LineupSlot, string>>,
  playerId: string,
  slot: LineupSlot,
): boolean {
  const player = signed.find((entry) => entry.id === playerId)
  if (!player || !playerEligibleAt(player, slot)) {
    return false
  }

  const occupiedBy = assignments[slot]
  if (occupiedBy && occupiedBy !== playerId) {
    return false
  }

  const usedElsewhere = LINEUP_SLOTS.some(
    (otherSlot) => otherSlot !== slot && assignments[otherSlot] === playerId,
  )
  return !usedElsewhere
}

export function assignPlayerToSlot(
  signed: readonly Player[],
  assignments: Partial<Record<LineupSlot, string>>,
  playerId: string,
  slot: LineupSlot,
): Partial<Record<LineupSlot, string>> | null {
  if (!canAssignPlayerToSlot(signed, assignments, playerId, slot)) {
    return null
  }

  const next = { ...assignments, [slot]: playerId }
  const cleared = { ...next }
  for (const otherSlot of LINEUP_SLOTS) {
    if (otherSlot !== slot && cleared[otherSlot] === playerId) {
      delete cleared[otherSlot]
    }
  }
  return cleared
}

export function clearSlot(
  assignments: Partial<Record<LineupSlot, string>>,
  slot: LineupSlot,
): Partial<Record<LineupSlot, string>> {
  const next = { ...assignments }
  delete next[slot]
  return next
}

function lineupKey(assignment: Map<LineupSlot, string>): string {
  return LINEUP_SLOTS.map((slot) => assignment.get(slot) ?? '').join('|')
}

export function findValidLineups(signed: readonly Player[]): Array<Map<LineupSlot, string>> {
  const results: Array<Map<LineupSlot, string>> = []
  const seen = new Set<string>()

  function search(
    slotIndex: number,
    used: Set<string>,
    assignment: Map<LineupSlot, string>,
  ): void {
    if (slotIndex >= LINEUP_SLOTS.length) {
      const key = lineupKey(assignment)
      if (!seen.has(key)) {
        seen.add(key)
        results.push(new Map(assignment))
      }
      return
    }

    const slot = LINEUP_SLOTS[slotIndex]
    if (!slot) {
      return
    }

    for (const player of signed) {
      if (used.has(player.id) || !playerEligibleAt(player, slot)) {
        continue
      }
      used.add(player.id)
      assignment.set(slot, player.id)
      search(slotIndex + 1, used, assignment)
      assignment.delete(slot)
      used.delete(player.id)
    }
  }

  search(0, new Set(), new Map())
  return results
}

export function hasValidLineup(signed: readonly Player[]): boolean {
  if (signed.length < LINEUP_SLOTS.length) {
    return false
  }
  return findValidLineups(signed).length > 0
}

export function autoSuggestLineup(signed: readonly Player[]): Partial<Record<LineupSlot, string>> {
  const lineups = findValidLineups(signed)
  if (lineups.length === 0) {
    return {}
  }

  const best = lineups.reduce((currentBest, candidate) => {
    const currentRating = sumAssignmentRating(signed, currentBest)
    const candidateRating = sumAssignmentRating(signed, candidate)
    return candidateRating > currentRating ? candidate : currentBest
  })

  const result: Partial<Record<LineupSlot, string>> = {}
  for (const slot of LINEUP_SLOTS) {
    const id = best.get(slot)
    if (id) {
      result[slot] = id
    }
  }
  return result
}

function sumAssignmentRating(
  signed: readonly Player[],
  assignment: Map<LineupSlot, string> | Partial<Record<LineupSlot, string>>,
): number {
  return LINEUP_SLOTS.reduce((total, slot) => {
    const id =
      assignment instanceof Map ? assignment.get(slot) : assignment[slot as Position]
    const player = signed.find((entry) => entry.id === id)
    return total + (player?.rating ?? 0)
  }, 0)
}
