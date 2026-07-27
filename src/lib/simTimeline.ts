import { getChampionRoster } from '../data/championRosters'
import type { Player } from '../schemas/player'
import type { ChampionTeam, QuarterScore, SimResult } from '../types/game'
import { createSeededRandom, type SeededRandom } from './draft'

export type SimEventKind = 'tipoff' | 'quarter' | 'overtime'
export type SimEventQuarter = 1 | 2 | 3 | 4 | 'OT'

export interface SimEvent {
  id: string
  kind: SimEventKind
  quarter: SimEventQuarter
  userScore: number
  championScore: number
  deltaUser: number
  deltaChampion: number
  headline: string
  highlights: string[]
  emphasis?: boolean
}

export interface SimTimeline {
  events: SimEvent[]
  durationMs: number
}

interface NarrativeState {
  userHot?: string
  championHot?: string
}

type QuoteFn = (player: string, team?: string) => string

const USER_QUOTES: QuoteFn[] = [
  (player) => `${player} drills a corner three.`,
  (player) => `${player} throws down a rim-rattling dunk.`,
  (player) => `${player} finds a cutter for an easy two.`,
  (player) => `${player} hits the and-one through contact.`,
  (player) => `${player} pulls up from the logo — swish.`,
  (player) => `${player} snakes through traffic for a layup.`,
  (player) => `${player} blocks out and cleans the glass.`,
  (player) => `${player} threads a needle pass for the assist.`,
  (player) => `${player} steps into a pull-up midrange.`,
  (player) => `${player} draws the foul and knocks down both free throws.`,
  (player) => `${player} swipes the ball and finishes on the break.`,
  (player) => `${player} posts up and spins baseline for two.`,
]

const USER_HEATING_QUOTES: QuoteFn[] = [
  (player) => `${player} is heating up from deep.`,
  (player) => `${player} can't miss right now.`,
  (player) => `${player} has that look in their eyes.`,
  (player) => `${player} strings together six straight points.`,
]

const USER_ON_FIRE_QUOTES: QuoteFn[] = [
  (player) => `${player} catches fire — the crowd is deafening.`,
  (player) => `${player} is unconscious. Nothing drops but net.`,
  (player) => `${player} takes over. Vintage Game 7.`,
  (player) => `${player} pours it on — every shot feels automatic.`,
]

const CHAMPION_QUOTES: QuoteFn[] = [
  (star) => `${star} answers with a deep three.`,
  (star, team) => `${star} takes over — vintage ${team ?? 'champion basketball'}.`,
  (star) => `${star} blocks everything at the rim.`,
  (star) => `${star} hits a clutch floater in traffic.`,
  (star, team) => `${star} wills ${team ?? 'the champs'} back into it.`,
  (star) => `${star} drills a step-back from the elbow.`,
  (star) => `${star} muscles through contact at the cup.`,
  (star) => `${star} picks your pocket and finishes in transition.`,
  (star) => `${star} buries a contested corner three.`,
  (star) => `${star} posts up and fades over the defense.`,
]

const CHAMPION_HEATING_QUOTES: QuoteFn[] = [
  (star) => `${star} is heating up from beyond the arc.`,
  (star) => `${star} finds a rhythm — the defense has no answer.`,
  (star) => `${star} scores on four straight possessions.`,
  (star) => `${star} starts feeling it from midrange.`,
]

const CHAMPION_ON_FIRE_QUOTES: QuoteFn[] = [
  (star) => `${star} catches fire and the arena erupts.`,
  (star) => `${star} is in the zone — every touch is danger.`,
  (star, team) => `${star} puts ${team ?? 'the champs'} on their back.`,
  (star) => `${star} can't be guarded right now.`,
]

const TIGHT_QUOTES: QuoteFn[] = [
  (a, b) => `${a} and ${b} trade buckets all quarter.`,
  () => `Neither side blinks — deadlock at the break.`,
  () => `Back and forth all quarter. Pure Game 7 tension.`,
  () => `Every possession feels like the Finals.`,
  (a, b) => `${a} answers. ${b} answers right back.`,
  () => `The lead changes hands three times this quarter.`,
]

const TIPOFF_QUOTES = [
  'The arena is deafening. Both teams look locked in.',
  'The crowd is on its feet before the opening tip.',
  'Coaches have drawn up the first play. Here we go.',
  'Tension you can cut with a knife. Game 7.',
]

function championShortName(champion: ChampionTeam): string {
  return champion.name.replace(/^'\d{2}\s+/, '')
}

function getChampionStars(champion: ChampionTeam): string[] {
  const roster = getChampionRoster(champion.id)
  if (roster.length > 0) {
    return [...roster]
  }

  return [`${championShortName(champion)} star`, `${championShortName(champion)} ace`]
}

function pickFrom<T>(items: readonly T[], rng: SeededRandom): T {
  const index = Math.floor(rng() * items.length)
  return items[index] ?? items[0]!
}

function pickPlayer(roster: readonly Player[], quarterIndex: number, offset: number): Player | null {
  if (roster.length === 0) {
    return null
  }
  return roster[(quarterIndex * 2 + offset) % roster.length] ?? null
}

function pickStar(champion: ChampionTeam, quarterIndex: number, offset: number): string {
  const stars = getChampionStars(champion)
  return stars[(quarterIndex * 3 + offset) % stars.length] ?? championShortName(champion)
}

function pickUserName(roster: readonly Player[], quarterIndex: number, offset: number): string {
  return pickPlayer(roster, quarterIndex, offset)?.player ?? 'Your star'
}

function addQuote(
  highlights: string[],
  quote: QuoteFn,
  player: string,
  team?: string,
): void {
  highlights.push(quote(player, team))
}

function applyHotCarryover(
  highlights: string[],
  state: NarrativeState,
  team: string,
  rng: SeededRandom,
): NarrativeState {
  const next: NarrativeState = { ...state }

  if (state.userHot) {
    addQuote(highlights, pickFrom(USER_ON_FIRE_QUOTES, rng), state.userHot)
    delete next.userHot
  }

  if (state.championHot) {
    addQuote(highlights, pickFrom(CHAMPION_ON_FIRE_QUOTES, rng), state.championHot, team)
    delete next.championHot
  }

  return next
}

function buildQuarterHighlights(
  roster: readonly Player[],
  champion: ChampionTeam,
  quarterIndex: number,
  userPoints: number,
  championPoints: number,
  state: NarrativeState,
  rng: SeededRandom,
): { highlights: string[]; state: NarrativeState } {
  const highlights: string[] = []
  const team = championShortName(champion)
  const userA = pickUserName(roster, quarterIndex, 0)
  const userB = pickUserName(roster, quarterIndex, 1)
  const starA = pickStar(champion, quarterIndex, 0)
  const starB = pickStar(champion, quarterIndex, 1)
  let nextState = applyHotCarryover(highlights, state, team, rng)

  const margin = userPoints - championPoints
  const userWinning = margin > 4
  const championWinning = margin < -4
  const tight = !userWinning && !championWinning

  if (userWinning) {
    addQuote(highlights, pickFrom(USER_QUOTES, rng), userA)
    addQuote(highlights, pickFrom(USER_QUOTES, rng), userB)
    if (rng() < 0.45) {
      addQuote(highlights, pickFrom(USER_HEATING_QUOTES, rng), userA)
      nextState = { ...nextState, userHot: userA }
    } else {
      addQuote(highlights, pickFrom(CHAMPION_QUOTES, rng), starA, team)
    }
  } else if (championWinning) {
    addQuote(highlights, pickFrom(CHAMPION_QUOTES, rng), starA, team)
    addQuote(highlights, pickFrom(CHAMPION_QUOTES, rng), starB, team)
    if (rng() < 0.45) {
      addQuote(highlights, pickFrom(CHAMPION_HEATING_QUOTES, rng), starB, team)
      nextState = { ...nextState, championHot: starB }
    } else {
      addQuote(highlights, pickFrom(USER_QUOTES, rng), userA)
    }
  } else if (tight) {
    addQuote(highlights, pickFrom(TIGHT_QUOTES, rng), userA, starA)
    if (margin > 0) {
      addQuote(highlights, pickFrom(USER_QUOTES, rng), userA)
      if (rng() < 0.35) {
        addQuote(highlights, pickFrom(USER_HEATING_QUOTES, rng), userB)
        nextState = { ...nextState, userHot: userB }
      }
    } else if (margin < 0) {
      addQuote(highlights, pickFrom(CHAMPION_QUOTES, rng), starA, team)
      if (rng() < 0.35) {
        addQuote(highlights, pickFrom(CHAMPION_HEATING_QUOTES, rng), starB, team)
        nextState = { ...nextState, championHot: starB }
      }
    } else {
      addQuote(highlights, pickFrom(TIGHT_QUOTES, rng), userB, starB)
    }
  }

  while (highlights.length < 3) {
    addQuote(highlights, pickFrom(USER_QUOTES, rng), userA)
  }

  return {
    highlights: highlights.slice(0, 4),
    state: nextState,
  }
}

function quarterHeadline(
  quarter: QuarterScore['quarter'],
  userPoints: number,
  championPoints: number,
  champion: ChampionTeam,
): string {
  if (quarter === 4) {
    return 'Fourth quarter — everything on the line.'
  }

  const margin = userPoints - championPoints
  if (margin >= 6) {
    return `End of Q${quarter} — your squad controls the tempo.`
  }
  if (margin <= -6) {
    return `End of Q${quarter} — ${champion.name} seizes momentum.`
  }
  return `End of Q${quarter} — a razor-thin battle.`
}

function buildFinalHighlights(
  result: SimResult,
  roster: readonly Player[],
  champion: ChampionTeam,
): string[] {
  const team = championShortName(champion)
  const highlights: string[] = []
  const { finishDrama } = result

  if (finishDrama.overtime) {
    highlights.push('Regulation expires tied — we are headed to overtime!')
    if (finishDrama.gameWinner && finishDrama.winnerSide) {
      const winner =
        finishDrama.winnerSide === 'user'
          ? pickUserName(roster, 4, 0)
          : pickStar(champion, 4, 0)
      highlights.push(`${winner} buries the overtime game-winner!`)
    } else if (finishDrama.winnerSide === 'user') {
      highlights.push(`${pickUserName(roster, 4, 0)} delivers in the extra period.`)
    } else if (finishDrama.winnerSide === 'champion') {
      highlights.push(`${pickStar(champion, 4, 0)} closes it out in overtime for ${team}.`)
    }
  } else if (finishDrama.gameWinner && finishDrama.winnerSide) {
    const winner =
      finishDrama.winnerSide === 'user'
        ? pickUserName(roster, 3, 0)
        : pickStar(champion, 3, 0)
    highlights.push(`${winner} buries the game-winner at the buzzer!`)
  } else if (result.outcome === 'win') {
    highlights.push(`${pickUserName(roster, 3, 0)} delivers in the clutch.`)
  } else if (result.outcome === 'loss') {
    highlights.push(`${pickStar(champion, 3, 0)} closes it out for ${team}.`)
  } else {
    highlights.push('Both sides leave everything on the floor — a true Game 7 stalemate.')
  }

  highlights.push(
    result.margin <= 5
      ? 'Heart-stopping finish — every possession mattered.'
      : 'The cap gods have spoken.',
  )

  return highlights
}

export function buildSimTimeline(
  result: SimResult,
  roster: readonly Player[],
  champion: ChampionTeam,
): SimTimeline {
  const rng = createSeededRandom(result.narrativeSeed)
  const events: SimEvent[] = []
  let previousUser = 0
  let previousChampion = 0
  let narrativeState: NarrativeState = {}

  events.push({
    id: 'evt-0',
    kind: 'tipoff',
    quarter: 1,
    userScore: 0,
    championScore: 0,
    deltaUser: 0,
    deltaChampion: 0,
    headline: 'Tip-off. Game 7 — winner takes all.',
    highlights: [pickFrom(TIPOFF_QUOTES, rng)],
  })

  for (const [quarterIndex, quarter] of result.quarters.entries()) {
    const prior = quarterIndex === 0 ? { user: 0, champion: 0 } : result.quarters[quarterIndex - 1]!
    const userPoints = quarter.user - prior.user
    const championPoints = quarter.champion - prior.champion
    const deltaUser = quarter.user - previousUser
    const deltaChampion = quarter.champion - previousChampion
    const isRegulationFinal = quarter.quarter === 4
    const regulationTied =
      isRegulationFinal &&
      result.finishDrama.overtime &&
      result.regulationScore !== undefined

    const quarterResult = buildQuarterHighlights(
      roster,
      champion,
      quarterIndex,
      userPoints,
      championPoints,
      narrativeState,
      rng,
    )
    narrativeState = quarterResult.state

    events.push({
      id: `evt-${events.length}`,
      kind: 'quarter',
      quarter: quarter.quarter,
      userScore: quarter.user,
      championScore: quarter.champion,
      deltaUser,
      deltaChampion,
      headline: regulationTied
        ? `End of regulation — tied ${quarter.user}-${quarter.champion}.`
        : isRegulationFinal && !result.finishDrama.overtime
          ? result.outcome === 'win'
            ? `Final — you win ${result.userScore}-${result.championScore}.`
            : result.outcome === 'loss'
              ? `Final — ${champion.name} wins ${result.championScore}-${result.userScore}.`
              : `Final — push ${result.userScore}-${result.championScore}.`
          : quarterHeadline(quarter.quarter, userPoints, championPoints, champion),
      highlights:
        isRegulationFinal && !result.finishDrama.overtime
          ? buildFinalHighlights(result, roster, champion)
          : quarterResult.highlights,
      emphasis: isRegulationFinal && !result.finishDrama.overtime,
    })

    previousUser = quarter.user
    previousChampion = quarter.champion
  }

  if (result.finishDrama.overtime && result.overtime) {
    const deltaUser = result.userScore - previousUser
    const deltaChampion = result.championScore - previousChampion

    events.push({
      id: `evt-${events.length}`,
      kind: 'overtime',
      quarter: 'OT',
      userScore: result.userScore,
      championScore: result.championScore,
      deltaUser,
      deltaChampion,
      headline:
        result.outcome === 'win'
          ? `Final — you win ${result.userScore}-${result.championScore} in overtime.`
          : result.outcome === 'loss'
            ? `Final — ${champion.name} wins ${result.championScore}-${result.userScore} in OT.`
            : `Final — push ${result.userScore}-${result.championScore} after overtime.`,
      highlights: buildFinalHighlights(result, roster, champion),
      emphasis: true,
    })
  }

  const last = events[events.length - 1]
  if (last) {
    last.userScore = result.userScore
    last.championScore = result.championScore
  }

  return {
    events,
    durationMs: events.length * 1200,
  }
}

export function reconcileTimelineScores(timeline: SimTimeline, result: SimResult): boolean {
  const last = timeline.events[timeline.events.length - 1]
  if (!last) {
    return false
  }
  return last.userScore === result.userScore && last.championScore === result.championScore
}
