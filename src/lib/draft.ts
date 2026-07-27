import { playerEligibleAt, type Player } from '../schemas/player'
import type { DraftState, EraId, LineupSlot, SalaryTag } from '../types/game'
import {
  DRAFT_OFFERS_PER_SLOT,
  DRAFT_SIGN_COUNT,
  DRAFT_STARTER_COUNT,
  FREE_HITS_PER_SLOT,
  LINEUP_SLOTS,
  OVER_CAP_PENALTY,
  OVER_CAP_PENALTY_SCALE,
  PLAYER_ERA_CAPS,
  SALARY_BLOAT_THRESHOLD,
  SALARY_CHEAP_THRESHOLD,
  TIME_MACHINE_CAP_POINTS,
  TIME_MACHINE_MIN_CAP_POINTS,
  DRAFT_OFFER_WEIGHT_77,
  DRAFT_OFFER_WEIGHT_80,
  DRAFT_OFFER_WEIGHT_85,
  DRAFT_OFFER_WEIGHT_90,
  DRAFT_OFFER_WEIGHT_FLOOR,
} from '../types/game'

export type SeededRandom = () => number

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleWithSeed<T>(items: readonly T[], rng: SeededRandom): T[] {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = result[index]
    const swap = result[swapIndex]
    if (current !== undefined && swap !== undefined) {
      result[index] = swap
      result[swapIndex] = current
    }
  }

  return result
}

export function getDraftOfferWeight(rating: number): number {
  if (rating >= 90) {
    return DRAFT_OFFER_WEIGHT_90
  }
  if (rating >= 85) {
    return DRAFT_OFFER_WEIGHT_85
  }
  if (rating >= 80) {
    return DRAFT_OFFER_WEIGHT_80
  }
  if (rating >= 77) {
    return DRAFT_OFFER_WEIGHT_77
  }
  return DRAFT_OFFER_WEIGHT_FLOOR
}

/** Weighted ordering so stronger player-seasons surface earlier in draft offers. */
export function orderByDraftOfferWeight(players: readonly Player[], rng: SeededRandom): Player[] {
  return [...players].sort((left, right) => {
    const leftKey = Math.pow(rng(), 1 / getDraftOfferWeight(left.rating))
    const rightKey = Math.pow(rng(), 1 / getDraftOfferWeight(right.rating))
    return rightKey - leftKey
  })
}

function getBlockedOfferNames(state: DraftState): Set<string> {
  return new Set([...state.usedNames, ...state.seenNamesThisSlot])
}

function takeNextUnblockedOffer(
  remainingPacket: readonly Player[],
  overflow: readonly Player[],
  blockedNames: ReadonlySet<string>,
): {
  offer: Player | undefined
  remainingPacket: Player[]
  overflow: Player[]
} {
  for (let index = 0; index < remainingPacket.length; index += 1) {
    const candidate = remainingPacket[index]
    if (candidate && !blockedNames.has(candidate.player)) {
      return {
        offer: candidate,
        remainingPacket: [...remainingPacket.slice(0, index), ...remainingPacket.slice(index + 1)],
        overflow: [...overflow],
      }
    }
  }

  for (let index = 0; index < overflow.length; index += 1) {
    const candidate = overflow[index]
    if (candidate && !blockedNames.has(candidate.player)) {
      return {
        offer: candidate,
        remainingPacket: [],
        overflow: [...overflow.slice(0, index), ...overflow.slice(index + 1)],
      }
    }
  }

  return { offer: undefined, remainingPacket: [...remainingPacket], overflow: [...overflow] }
}

function hasUnblockedOffer(
  remainingPacket: readonly Player[],
  overflow: readonly Player[],
  blockedNames: ReadonlySet<string>,
): boolean {
  return takeNextUnblockedOffer(remainingPacket, overflow, blockedNames).offer !== undefined
}

export function filterPoolByEra(pool: readonly Player[], eraId: EraId): Player[] {
  if (eraId === 'timeMachine') {
    return [...pool]
  }
  return pool.filter((player) => player.era === eraId)
}

export function getEraSalaryCap(era: import('../schemas/player').PlayerEra): number {
  return PLAYER_ERA_CAPS[era]
}

export function salaryToCapPoints(salary: number, eraSalaryCap: number): number {
  if (eraSalaryCap <= 0) {
    return 0
  }
  const raw = Math.round((salary / eraSalaryCap) * TIME_MACHINE_CAP_POINTS)
  return Math.max(TIME_MACHINE_MIN_CAP_POINTS, raw)
}

export function getPlayerCapCost(player: Player, eraId: EraId): number {
  if (eraId === 'timeMachine') {
    return salaryToCapPoints(player.salary, getEraSalaryCap(player.era))
  }
  return player.salary
}

export function getHitPenalty(eraId: EraId): number {
  switch (eraId) {
    case '2000s':
      return 2_000_000
    case '2010s':
      return 3_000_000
    case '2020s':
      return Math.floor(PLAYER_ERA_CAPS['2020s'] * 0.05)
    case 'timeMachine':
      return Math.floor(TIME_MACHINE_CAP_POINTS * 0.05)
  }
}

export function getRosterSpend(roster: readonly Player[], eraId: EraId): number {
  return roster.reduce((total, player) => total + getPlayerCapCost(player, eraId), 0)
}

export function getDraftCapSpend(
  roster: readonly Player[],
  eraId: EraId,
  hitPenaltySpend = 0,
): number {
  return getRosterSpend(roster, eraId) + hitPenaltySpend
}

export function isOverCap(
  roster: readonly Player[],
  eraId: EraId,
  capLimit: number,
  hitPenaltySpend = 0,
): boolean {
  return getDraftCapSpend(roster, eraId, hitPenaltySpend) > capLimit
}

export function getOverCapAmount(spend: number, capLimit: number): number {
  return Math.max(0, spend - capLimit)
}

export function getOverCapPenalty(spend: number, capLimit: number): number {
  if (spend <= capLimit) {
    return 0
  }

  const overRatio = getOverCapAmount(spend, capLimit) / capLimit
  return OVER_CAP_PENALTY + Math.floor(overRatio * OVER_CAP_PENALTY_SCALE)
}

export function computeOverCapPenalty(
  roster: readonly Player[],
  eraId: EraId,
  capLimit: number,
  hitPenaltySpend = 0,
): number {
  return getOverCapPenalty(getDraftCapSpend(roster, eraId, hitPenaltySpend), capLimit)
}

export function getNextHitPenalty(state: DraftState, eraId: EraId): number {
  if (state.hitsThisSlot >= FREE_HITS_PER_SLOT) {
    return getHitPenalty(eraId)
  }
  return 0
}

export function getSalaryTag(salary: number, capLimit: number): SalaryTag {
  if (capLimit <= 0) {
    return 'neutral'
  }

  const ratio = salary / capLimit

  if (ratio <= SALARY_CHEAP_THRESHOLD) {
    return 'cheap'
  }

  if (ratio >= SALARY_BLOAT_THRESHOLD) {
    return 'bloat'
  }

  return 'neutral'
}

export function getSalaryTagLabel(tag: SalaryTag): string {
  switch (tag) {
    case 'cheap':
      return 'CHEAP ROOKIE CONTRACT!'
    case 'bloat':
      return 'SUPERMAX BLOAT!'
    case 'neutral':
      return ''
  }
}

export function getCapTone(
  spend: number,
  capLimit: number,
): 'safe' | 'warn' | 'danger' {
  if (capLimit <= 0) {
    return 'safe'
  }

  const ratio = spend / capLimit

  if (ratio > 1) {
    return 'danger'
  }

  if (ratio >= 0.85) {
    return 'warn'
  }

  return 'safe'
}

function buildOverflowQueues(
  pool: readonly Player[],
  packets: Record<LineupSlot, readonly Player[]>,
  rng: SeededRandom,
): Record<LineupSlot, Player[]> {
  const usedNames = new Set<string>()
  for (const slot of LINEUP_SLOTS) {
    for (const player of packets[slot] ?? []) {
      usedNames.add(player.player)
    }
  }

  const queues = {} as Record<LineupSlot, Player[]>
  for (const slot of LINEUP_SLOTS) {
    const eligible = pool.filter(
      (player) => !usedNames.has(player.player) && playerEligibleAt(player, slot),
    )
    queues[slot] = orderByDraftOfferWeight(eligible, rng)
  }

  return queues
}

function hasMoreOffers(state: DraftState): boolean {
  const blockedNames = getBlockedOfferNames(state)
  return hasUnblockedOffer(
    state.remainingPacket,
    state.overflowQueues[state.activeSlot] ?? [],
    blockedNames,
  )
}

function buildSlotPacket(
  pool: readonly Player[],
  slot: LineupSlot,
  usedNames: Set<string>,
  rng: SeededRandom,
): Player[] {
  const eligible = pool.filter(
    (player) => !usedNames.has(player.player) && playerEligibleAt(player, slot),
  )
  const ordered = orderByDraftOfferWeight(eligible, rng)
  const packet: Player[] = []
  const seenInPacket = new Set<string>()

  for (const player of ordered) {
    if (seenInPacket.has(player.player)) {
      continue
    }
    seenInPacket.add(player.player)
    packet.push(player)
    if (packet.length >= DRAFT_OFFERS_PER_SLOT) {
      break
    }
  }

  if (packet.length < DRAFT_OFFERS_PER_SLOT) {
    throw new RangeError(`Pool too small for ${DRAFT_OFFERS_PER_SLOT} offers at ${slot}`)
  }

  return packet
}

function hasCapLegalPath(
  packets: Record<LineupSlot, readonly Player[]>,
  eraId: EraId,
  capLimit: number,
): boolean {
  function search(slotIndex: number, roster: Player[]): boolean {
    if (slotIndex >= LINEUP_SLOTS.length) {
      return !isOverCap(roster, eraId, capLimit)
    }

    const slot = LINEUP_SLOTS[slotIndex]
    if (!slot) {
      return false
    }

    for (const player of packets[slot]) {
      if (search(slotIndex + 1, [...roster, player])) {
        return true
      }
    }

    return false
  }

  return search(0, [])
}

export function createPositionPackets(
  pool: readonly Player[],
  eraId: EraId,
  capLimit: number,
  rng: SeededRandom,
  maxAttempts = 40,
): Record<LineupSlot, readonly Player[]> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptRng = createSeededRandom(Math.floor(rng() * 0xffffffff))
    const usedNames = new Set<string>()
    const packets = {} as Record<LineupSlot, Player[]>

    try {
      for (const slot of LINEUP_SLOTS) {
        const packet = buildSlotPacket(pool, slot, usedNames, attemptRng)
        packets[slot] = packet
        for (const player of packet) {
          usedNames.add(player.player)
        }
      }
    } catch {
      continue
    }

    if (hasCapLegalPath(packets, eraId, capLimit)) {
      return packets
    }
  }

  const usedNames = new Set<string>()
  const packets = {} as Record<LineupSlot, Player[]>
  for (const slot of LINEUP_SLOTS) {
    const packet = buildSlotPacket(pool, slot, usedNames, rng)
    packets[slot] = packet
    for (const player of packet) {
      usedNames.add(player.player)
    }
  }
  return packets
}

function startSlotRound(
  state: Omit<
    DraftState,
    'currentOffer' | 'remainingPacket' | 'offerIndex' | 'salaryRevealed' | 'forcedSign' | 'hitsThisSlot' | 'seenNamesThisSlot'
  >,
): DraftState {
  const packet = state.positionPackets[state.activeSlot]
  const [currentOffer, ...remainingPacket] = packet

  const nextState: DraftState = {
    ...state,
    currentOffer: currentOffer ?? null,
    remainingPacket,
    offerIndex: currentOffer ? 1 : DRAFT_OFFERS_PER_SLOT,
    salaryRevealed: false,
    hitsThisSlot: 0,
    seenNamesThisSlot: currentOffer ? [currentOffer.player] : [],
    forcedSign: false,
  }

  return {
    ...nextState,
    forcedSign: nextState.currentOffer !== null && !hasMoreOffers(nextState),
  }
}

export function initDraft(
  pool: readonly Player[],
  rng: SeededRandom,
  eraId: EraId,
  capLimit: number,
): DraftState {
  const positionPackets = createPositionPackets(pool, eraId, capLimit, rng)
  const overflowQueues = buildOverflowQueues(pool, positionPackets, rng)

  return startSlotRound({
    activeSlot: 'PG',
    slotIndex: 0,
    starters: {},
    usedNames: [],
    positionPackets,
    overflowQueues,
    hitPenaltySpend: 0,
  })
}

export function revealSalary(state: DraftState): DraftState {
  if (!state.currentOffer || state.salaryRevealed) {
    return state
  }

  return {
    ...state,
    salaryRevealed: true,
  }
}

export function hitOffer(state: DraftState, eraId: EraId): DraftState {
  if (!state.currentOffer || state.salaryRevealed || state.forcedSign) {
    return state
  }

  const nextHitsThisSlot = state.hitsThisSlot + 1
  const penalty = nextHitsThisSlot > FREE_HITS_PER_SLOT ? getHitPenalty(eraId) : 0
  const hitPenaltySpend = state.hitPenaltySpend + penalty

  const blockedNames = getBlockedOfferNames(state)
  const overflow = state.overflowQueues[state.activeSlot] ?? []
  const { offer: nextOffer, remainingPacket, overflow: nextOverflow } = takeNextUnblockedOffer(
    state.remainingPacket,
    overflow,
    blockedNames,
  )

  if (!nextOffer) {
    return state
  }

  const nextState: DraftState = {
    ...state,
    currentOffer: nextOffer,
    remainingPacket,
    overflowQueues: {
      ...state.overflowQueues,
      [state.activeSlot]: nextOverflow,
    },
    offerIndex: state.offerIndex + 1,
    hitsThisSlot: nextHitsThisSlot,
    hitPenaltySpend,
    seenNamesThisSlot: [...state.seenNamesThisSlot, nextOffer.player],
    salaryRevealed: false,
    forcedSign: false,
  }

  return {
    ...nextState,
    forcedSign: !hasMoreOffers(nextState),
  }
}

function advanceToNextSlot(state: DraftState): DraftState {
  const nextIndex = state.slotIndex + 1
  if (nextIndex >= DRAFT_SIGN_COUNT) {
    return {
      ...state,
      currentOffer: null,
      remainingPacket: [],
      salaryRevealed: false,
      forcedSign: false,
    }
  }

  const activeSlot = LINEUP_SLOTS[nextIndex]
  if (!activeSlot) {
    return state
  }

  return startSlotRound({
    ...state,
    activeSlot,
    slotIndex: nextIndex,
  })
}

export function signOffer(state: DraftState): DraftState {
  if (!state.currentOffer) {
    return state
  }

  if (!state.salaryRevealed && !state.forcedSign) {
    return state
  }

  const starters = {
    ...state.starters,
    [state.activeSlot]: state.currentOffer,
  }
  const usedNames = [...state.usedNames, state.currentOffer.player]

  return advanceToNextSlot({
    ...state,
    starters,
    usedNames,
  })
}

export function isDraftComplete(state: DraftState): boolean {
  return LINEUP_SLOTS.every((slot) => state.starters[slot] !== undefined)
}

export function getFinalStarters(state: DraftState): Player[] {
  return LINEUP_SLOTS.map((slot) => state.starters[slot]).filter(
    (player): player is Player => player !== undefined,
  )
}

export function canHit(state: DraftState): boolean {
  return (
    state.currentOffer !== null &&
    !state.salaryRevealed &&
    !state.forcedSign &&
    hasMoreOffers(state) &&
    !isDraftComplete(state)
  )
}

export function canSign(state: DraftState): boolean {
  return (
    state.currentOffer !== null &&
    !isDraftComplete(state) &&
    (state.salaryRevealed || state.forcedSign)
  )
}

export function canFlip(state: DraftState): boolean {
  return canReveal(state)
}

export function canAdvance(state: DraftState): boolean {
  return canSign(state)
}

export function canReveal(state: DraftState): boolean {
  return state.currentOffer !== null && !state.salaryRevealed && !isDraftComplete(state)
}

/** @deprecated Use hitOffer */
export function passOffer(state: DraftState, eraId: EraId): DraftState {
  return hitOffer(state, eraId)
}

/** @deprecated Use canHit */
export function canPass(state: DraftState): boolean {
  return canHit(state)
}

/** @deprecated Use signOffer */
export function keepCard(state: DraftState): DraftState {
  return signOffer(state)
}

/** @deprecated Use hitOffer */
export function trashCard(state: DraftState, eraId: EraId): DraftState {
  return hitOffer(state, eraId)
}

/** @deprecated Use canHit */
export function canTrash(state: DraftState): boolean {
  return canHit(state)
}

/** @deprecated Use canSign or canReveal */
export function canKeep(state: DraftState): boolean {
  return canReveal(state) || canSign(state)
}

export const DRAFT_MAX_CARDS = DRAFT_OFFERS_PER_SLOT
export const DRAFT_ROSTER_SIZE_EXPORT = DRAFT_STARTER_COUNT
