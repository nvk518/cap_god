import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePlayers, type Player } from '../schemas/player'
import { pickRandomChampion } from '../data/champions'
import { getEraCap } from '../data/eras'
import type { DraftState, EraId } from '../types/game'
import { CHALLENGE_DIFFICULTY, LINEUP_SLOTS } from '../types/game'
import {
  createPositionPackets,
  createSeededRandom,
  filterPoolByEra,
  getFinalStarters,
  getRosterSpend,
  hitOffer,
  initDraft,
  isOverCap,
  revealSalary,
  signOffer,
  type SeededRandom,
} from './draft'
import { simulateGame7 } from './rating'

export interface BalanceMetrics {
  era: EraId
  hands: number
  legalCapRate: number
  informedWinRate: number
  randomWinRate: number
  bustRate: number
  nearLossRate: number
  duplicateOfferRate: number
  firstOfferSignRate: number
  secondOfferSignRate: number
  forcedOfferSignRate: number
  perChampionWinRates: Record<string, number>
  perChampionHands: Record<string, number>
}

function loadEraPool(dataDir: string, era: EraId): Player[] {
  if (era === 'timeMachine') {
    const eras = ['2000s', '2010s', '2020s'] as const
    return eras.flatMap((entry) => {
      const raw = readFileSync(join(dataDir, `${entry}.json`), 'utf8')
      return parsePlayers(JSON.parse(raw))
    })
  }
  const raw = readFileSync(join(dataDir, `${era}.json`), 'utf8')
  return parsePlayers(JSON.parse(raw))
}

function scoreOffer(
  player: Player,
  eraId: EraId,
  capLimit: number,
  starters: readonly Player[],
): number {
  const spend = getRosterSpend([...starters, player], eraId)
  const capPressure = spend / capLimit
  return player.rating - capPressure * 18 - player.salary / capLimit / 1_000_000
}

function playPositionRound(
  state: DraftState,
  eraId: EraId,
  capLimit: number,
  rng: SeededRandom,
  strategy: 'informed' | 'random',
): DraftState {
  let current = state
  const slot = state.activeSlot

  while (current.currentOffer !== null && current.activeSlot === slot) {
    if (current.forcedSign) {
      return signOffer(revealSalary(current))
    }

    const starters = getFinalStarters(current)
    const candidates = [current.currentOffer, ...current.remainingPacket]
    const best = candidates.reduce((leading, player) =>
      scoreOffer(player, eraId, capLimit, starters) >
      scoreOffer(leading, eraId, capLimit, starters)
        ? player
        : leading,
    )

    const shouldHit =
      strategy === 'random'
        ? rng() < 0.45
        : current.currentOffer.id !== best.id

    if (shouldHit && current.remainingPacket.length > 0) {
      current = hitOffer(current, eraId)
      continue
    }

    if (shouldHit && (current.overflowQueues[current.activeSlot]?.length ?? 0) > 0) {
      current = hitOffer(current, eraId)
      continue
    }

    return signOffer(revealSalary(current))
  }

  return current
}

function informedPlay(draft: DraftState, eraId: EraId, capLimit: number, rng: SeededRandom): DraftState {
  let state = draft
  while (!LINEUP_SLOTS.every((slot) => state.starters[slot] !== undefined)) {
    state = playPositionRound(state, eraId, capLimit, rng, 'informed')
    if (state.currentOffer === null && getFinalStarters(state).length < LINEUP_SLOTS.length) {
      break
    }
  }
  return state
}

function randomPlay(draft: DraftState, eraId: EraId, capLimit: number, rng: SeededRandom): DraftState {
  let state = draft
  while (!LINEUP_SLOTS.every((slot) => state.starters[slot] !== undefined)) {
    state = playPositionRound(state, eraId, capLimit, rng, 'random')
    if (state.currentOffer === null && getFinalStarters(state).length < LINEUP_SLOTS.length) {
      break
    }
  }
  return state
}

function countDuplicateNames(packets: Record<string, readonly Player[]>): number {
  const names = LINEUP_SLOTS.flatMap((slot) => packets[slot]?.map((player) => player.player) ?? [])
  return names.length - new Set(names).size
}

export function runBalanceSimulation(
  dataDir: string,
  hands = 200,
  seed = 42,
): BalanceMetrics[] {
  const eras: EraId[] = ['2000s', '2010s', '2020s', 'timeMachine']
  const metrics: BalanceMetrics[] = []

  for (const era of eras) {
    const pool = loadEraPool(dataDir, era)
    const capLimit = getEraCap(era)

    let legalCaps = 0
    let informedWins = 0
    let randomWins = 0
    let busts = 0
    let nearLosses = 0
    let duplicateOffers = 0
    let firstSigns = 0
    let secondSigns = 0
    let forcedSigns = 0
    const championWins: Record<string, number> = {}
    const championHands: Record<string, number> = {}

    for (let hand = 0; hand < hands; hand += 1) {
      const rng = createSeededRandom(seed + hand * 17 + era.length * 100)
      const champion = pickRandomChampion(era, rng)
      championHands[champion.id] = (championHands[champion.id] ?? 0) + 1
      const filtered = filterPoolByEra(pool, era)
      const packets = createPositionPackets(filtered, era, capLimit, rng)
      if (countDuplicateNames(packets) > 0) {
        duplicateOffers += 1
      }

      const informedDraft = informedPlay(initDraft(filtered, rng, era, capLimit), era, capLimit, rng)
      const starters = getFinalStarters(informedDraft)
      const overCap = isOverCap(starters, era, capLimit, informedDraft.hitPenaltySpend)
      if (!overCap) {
        legalCaps += 1
      } else {
        busts += 1
      }

      for (const slot of LINEUP_SLOTS) {
        const signed = informedDraft.starters[slot]
        if (!signed) {
          continue
        }
        const packet = informedDraft.positionPackets[slot]
        const index = packet.findIndex((player) => player.id === signed.id)
        if (index === 0) {
          firstSigns += 1
        } else if (index === 1) {
          secondSigns += 1
        } else if (index === 2) {
          forcedSigns += 1
        }
      }

      const informedSim = simulateGame7({
        roster: starters,
        champion,
        eraId: era,
        difficulty: CHALLENGE_DIFFICULTY,
        capLimit,
        hitPenaltySpend: informedDraft.hitPenaltySpend,
        rng,
      })
      if (informedSim.outcome === 'win') {
        informedWins += 1
        championWins[champion.id] = (championWins[champion.id] ?? 0) + 1
      }
      if (informedSim.outcome === 'loss' && informedSim.margin <= 5) {
        nearLosses += 1
      }

      const randomDraft = randomPlay(
        initDraft(filtered, createSeededRandom(seed + hand * 3), era, capLimit),
        era,
        capLimit,
        createSeededRandom(seed + hand + 99),
      )
      const randomStarters = getFinalStarters(randomDraft)
      const randomSim = simulateGame7({
        roster: randomStarters,
        champion,
        eraId: era,
        difficulty: CHALLENGE_DIFFICULTY,
        capLimit,
        hitPenaltySpend: randomDraft.hitPenaltySpend,
        rng: createSeededRandom(seed + hand + 199),
      })
      if (randomSim.outcome === 'win') {
        randomWins += 1
      }
    }

    const perChampionWinRates: Record<string, number> = {}
    for (const [championId, count] of Object.entries(championHands)) {
      perChampionWinRates[championId] = (championWins[championId] ?? 0) / count
    }

    metrics.push({
      era,
      hands,
      legalCapRate: legalCaps / hands,
      informedWinRate: informedWins / hands,
      randomWinRate: randomWins / hands,
      bustRate: busts / hands,
      nearLossRate: nearLosses / hands,
      duplicateOfferRate: duplicateOffers / hands,
      firstOfferSignRate: firstSigns / (hands * LINEUP_SLOTS.length),
      secondOfferSignRate: secondSigns / (hands * LINEUP_SLOTS.length),
      forcedOfferSignRate: forcedSigns / (hands * LINEUP_SLOTS.length),
      perChampionWinRates,
      perChampionHands: championHands,
    })
  }

  return metrics
}
