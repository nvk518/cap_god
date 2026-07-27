import { getChampionRoster } from '../data/championRosters'
import type { Player } from '../schemas/player'
import type { ChampionTeam, QuarterScore, SimResult } from '../types/game'
import { createSeededRandom, type SeededRandom } from './draft'

export type SimEventKind = 'tipoff' | 'quarter' | 'overtime'
export type SimEventQuarter = 1 | 2 | 3 | 4 | 'OT' | '2OT' | '3OT'

export function overtimePeriodLabel(periodIndex: number): SimEventQuarter {
  if (periodIndex === 0) {
    return 'OT'
  }
  if (periodIndex === 1) {
    return '2OT'
  }
  return '3OT'
}

export type ResultPeriodKey = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OT' | '2OT' | '3OT'

export interface ResultPeriodOption {
  key: ResultPeriodKey
  label: string
  user: number
  champion: number
}

export function buildResultPeriodOptions(result: SimResult): ResultPeriodOption[] {
  const options: ResultPeriodOption[] = result.quarters.map((quarter) => ({
    key: `Q${quarter.quarter}` as ResultPeriodKey,
    label: `Q${quarter.quarter}`,
    user: quarter.user,
    champion: quarter.champion,
  }))

  if (result.overtimePeriods) {
    result.overtimePeriods.forEach((scores, index) => {
      const quarter = overtimePeriodLabel(index)
      const label = quarter === 1 || quarter === 2 || quarter === 3 || quarter === 4
        ? `Q${quarter}`
        : quarter
      options.push({
        key: label as ResultPeriodKey,
        label,
        user: scores.user,
        champion: scores.champion,
      })
    })
  } else if (result.finishDrama.overtime) {
    options.push({
      key: 'OT',
      label: 'OT',
      user: result.userScore,
      champion: result.championScore,
    })
  }

  return options
}

export function findPeriodEvent(timeline: SimTimeline, key: ResultPeriodKey): SimEvent | undefined {
  if (key.startsWith('Q')) {
    const quarter = Number.parseInt(key.slice(1), 10) as 1 | 2 | 3 | 4
    return timeline.events.find((event) => event.kind === 'quarter' && event.quarter === quarter)
  }

  return timeline.events.find((event) => event.kind === 'overtime' && event.quarter === key)
}

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
  (player) => `${player} euro-steps through the lane for a crafty finish.`,
  (player) => `${player} catches it on the wing and rises for three.`,
  (player) => `${player} pump-fakes, sidesteps, and buries the jumper.`,
  (player) => `${player} throws an alley-oop to the rim — hammer finish.`,
  (player) => `${player} hits a one-legged fadeaway with a hand in the face.`,
  (player) => `${player} splits a double team and scores at the cup.`,
  (player) => `${player} banks it in off the glass from the elbow.`,
  (player) => `${player} whips a cross-court pass for an open dunk.`,
  (player) => `${player} tips in the miss — second-chance points.`,
  (player) => `${player} shakes the defender and nails the step-back three.`,
]

const USER_DEFENSE_QUOTES: QuoteFn[] = [
  (player) => `${player} swats it at the rim — emphatic block.`,
  (player) => `${player} digs in and forces a tough turnover.`,
  (player) => `${player} strips the ball on the perimeter.`,
  (player) => `${player} boxes out and rips down the rebound.`,
  (player) => `${player} slides over and takes the charge.`,
  (player) => `${player} deflects the pass — live-ball turnover.`,
  (player) => `${player} contests everything — no easy looks.`,
  (player) => `${player} reads the play and intercepts at the nail.`,
]

const USER_HEATING_QUOTES: QuoteFn[] = [
  (player) => `${player} is heating up from deep.`,
  (player) => `${player} can't miss right now.`,
  (player) => `${player} has that look in their eyes.`,
  (player) => `${player} strings together six straight points.`,
  (player) => `${player} is in rhythm — the defense is scrambling.`,
  (player) => `${player} scores on three straight possessions.`,
  (player) => `${player} waves the crowd into a frenzy.`,
  (player) => `${player} is cooking — every touch is a threat.`,
]

const USER_ON_FIRE_QUOTES: QuoteFn[] = [
  (player) => `${player} catches fire — the crowd is deafening.`,
  (player) => `${player} is unconscious. Nothing drops but net.`,
  (player) => `${player} takes over. Vintage Game 7.`,
  (player) => `${player} pours it on — every shot feels automatic.`,
  (player) => `${player} is in the zone — the arena can't contain it.`,
  (player) => `${player} wills the team forward — pure takeover mode.`,
  (player) => `${player} has the hot hand and nobody can cool them down.`,
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
  (star) => `${star} Euro-steps past two defenders for the layup.`,
  (star) => `${star} pulls up from deep — nothing but net.`,
  (star) => `${star} throws down a putback dunk off the miss.`,
  (star) => `${star} hits a tough turnaround in the post.`,
  (star) => `${star} snakes through the lane and finishes with a finger roll.`,
  (star) => `${star} catches, pump-fakes, and drills the three.`,
  (star) => `${star} lobs it up for an alley-oop finish.`,
  (star) => `${star} banks in the runner off one foot.`,
  (star) => `${star} draws the foul and calmly sinks both free throws.`,
  (star) => `${star} hits a one-dribble pull-up from the midrange.`,
]

const CHAMPION_DEFENSE_QUOTES: QuoteFn[] = [
  (star) => `${star} erases the shot at the rim.`,
  (star) => `${star} pokes the ball away — fast break coming.`,
  (star) => `${star} walls up and forces a bad pass.`,
  (star) => `${star} rotates perfectly for the help-side block.`,
  (star) => `${star} pins it on the backboard — chasedown block.`,
  (star) => `${star} digs out the loose ball and outlets it.`,
  (star) => `${star} takes a charge — crowd roars.`,
  (star) => `${star} deflects the entry pass out of bounds.`,
]

const CHAMPION_HEATING_QUOTES: QuoteFn[] = [
  (star) => `${star} is heating up from beyond the arc.`,
  (star) => `${star} finds a rhythm — the defense has no answer.`,
  (star) => `${star} scores on four straight possessions.`,
  (star) => `${star} starts feeling it from midrange.`,
  (star) => `${star} is locked in — every shot looks good.`,
  (star) => `${star} owns the quarter so far.`,
  (star) => `${star} can't be stopped on the drive.`,
]

const CHAMPION_ON_FIRE_QUOTES: QuoteFn[] = [
  (star) => `${star} catches fire and the arena erupts.`,
  (star) => `${star} is in the zone — every touch is danger.`,
  (star, team) => `${star} puts ${team ?? 'the champs'} on their back.`,
  (star) => `${star} can't be guarded right now.`,
  (star) => `${star} is torching the defense — vintage superstar night.`,
  (star) => `${star} has that championship swagger tonight.`,
]

const TIGHT_QUOTES: QuoteFn[] = [
  (a, b) => `${a} and ${b} trade buckets all quarter.`,
  () => `Neither side blinks — deadlock at the break.`,
  () => `Back and forth all quarter. Pure Game 7 tension.`,
  () => `Every possession feels like the Finals.`,
  (a, b) => `${a} answers. ${b} answers right back.`,
  () => `The lead changes hands three times this quarter.`,
  () => `Coaches are pacing — neither team can separate.`,
  () => `Timeout on the floor. Both benches on edge.`,
  () => `The crowd is standing for every possession.`,
  (a, b) => `${a} hits. ${b} counters. Repeat.`,
  () => `Defensive battle — every point is earned.`,
  () => `Neither team can string together a run.`,
  () => `The scoreboard stays tight — nerves everywhere.`,
  () => `Both teams trading haymakers like a heavyweight fight.`,
]

const MISC_EVENT_QUOTES: QuoteFn[] = [
  () => 'Official timeout — coaches huddle, crowd buzzing.',
  () => 'The refs review the call at the scorer’s table.',
  () => 'A technical foul — emotions boiling over.',
  () => 'The bench unit sparks a mini-run.',
  () => 'Crowd chanting defense on every possession.',
  () => 'Momentum swings on a single turnover.',
  () => 'Both teams in the bonus — free throws loom.',
  () => 'A wild sequence — three misses, two offensive boards.',
  () => 'The arena erupts after a momentum-shifting play.',
  () => 'Substitution chaos — fresh legs on both sides.',
  () => 'A loose-ball scrum — players diving everywhere.',
  () => 'The shot clock is dying on every possession.',
]

const RUN_QUOTES: QuoteFn[] = [
  (player) => `${player} caps an 8-0 run with a three.`,
  (player) => `${player} finishes the fast break — crowd erupts.`,
  (player, team) => `${player} sparks a run — ${team ?? 'your squad'} rolling.`,
  (star, team) => `${star} answers the run — ${team ?? 'the champs'} punch back.`,
  () => 'Back-to-back threes — the lead is swinging.',
  () => 'A 10-2 burst changes the entire feel of the quarter.',
  () => 'Three stops in a row — transition game opens up.',
]

const TIPOFF_QUOTES = [
  'The arena is deafening. Both teams look locked in.',
  'The crowd is on its feet before the opening tip.',
  'Coaches have drawn up the first play. Here we go.',
  'Tension you can cut with a knife. Game 7.',
  'The lights are bright and the stakes couldn’t be higher.',
  'Both captains meet at midcourt — pure Finals energy.',
  'Every fan knows this one decides everything.',
  'The ball goes up — Game 7 is underway.',
]

const QUARTER_HEADLINE_WINNING: QuoteFn[] = [
  (player) => `End of the quarter — ${player} and your squad control the tempo.`,
  () => 'Your five are dictating pace and the champs are chasing.',
  () => 'The lead is yours — momentum firmly on your side.',
  () => 'Your squad finishes the quarter on a strong note.',
]

const QUARTER_HEADLINE_LOSING: QuoteFn[] = [
  (star, team) => `End of the quarter — ${star} and ${team ?? 'the champs'} seize momentum.`,
  (star) => `${star} has the champs rolling.`,
  () => 'The champions finish the quarter in control.',
  () => 'Your squad trails — need a response next quarter.',
]

const QUARTER_HEADLINE_TIGHT: QuoteFn[] = [
  () => 'End of the quarter — a razor-thin battle.',
  () => 'Neither side can pull away — deadlock continues.',
  () => 'The quarter ends with the tension still building.',
  () => 'Every point matters — this quarter was a war.',
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

function pickUniqueQuote(
  highlights: string[],
  pool: readonly QuoteFn[],
  player: string,
  team: string | undefined,
  rng: SeededRandom,
): void {
  for (let attempt = 0; attempt < pool.length * 2; attempt += 1) {
    const quote = pickFrom(pool, rng)
    const text = quote(player, team)
    if (!highlights.includes(text)) {
      highlights.push(text)
      return
    }
  }
  addQuote(highlights, pickFrom(pool, rng), player, team)
}

function pickRosterPlayer(
  roster: readonly Player[],
  rng: SeededRandom,
  exclude?: string,
): Player | null {
  if (roster.length === 0) {
    return null
  }

  for (let attempt = 0; attempt < roster.length; attempt += 1) {
    const player = roster[Math.floor(rng() * roster.length)]
    if (player && player.player !== exclude) {
      return player
    }
  }

  return roster[0] ?? null
}

function pickRosterName(roster: readonly Player[], rng: SeededRandom, exclude?: string): string {
  return pickRosterPlayer(roster, rng, exclude)?.player ?? 'Your star'
}

function pickStarName(
  champion: ChampionTeam,
  rng: SeededRandom,
  exclude?: string,
): string {
  const stars = getChampionStars(champion)
  for (let attempt = 0; attempt < stars.length; attempt += 1) {
    const star = stars[Math.floor(rng() * stars.length)]
    if (star && star !== exclude) {
      return star
    }
  }
  return stars[0] ?? championShortName(champion)
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

function pickPlayPool(
  pools: readonly (readonly QuoteFn[])[],
  rng: SeededRandom,
): readonly QuoteFn[] {
  return pickFrom(pools, rng)
}

function buildQuarterHighlights(
  roster: readonly Player[],
  champion: ChampionTeam,
  userPoints: number,
  championPoints: number,
  state: NarrativeState,
  rng: SeededRandom,
): { highlights: string[]; state: NarrativeState } {
  const highlights: string[] = []
  const team = championShortName(champion)
  const userA = pickRosterName(roster, rng)
  const userB = pickRosterName(roster, rng, userA)
  const starA = pickStarName(champion, rng)
  const starB = pickStarName(champion, rng, starA)
  let nextState = applyHotCarryover(highlights, state, team, rng)

  const margin = userPoints - championPoints
  const userWinning = margin > 4
  const championWinning = margin < -4
  const tight = !userWinning && !championWinning

  const userScorePools = [USER_QUOTES, USER_QUOTES, USER_DEFENSE_QUOTES, RUN_QUOTES]
  const champScorePools = [CHAMPION_QUOTES, CHAMPION_QUOTES, CHAMPION_DEFENSE_QUOTES, RUN_QUOTES]
  const mixedPools = [USER_QUOTES, CHAMPION_QUOTES, TIGHT_QUOTES, MISC_EVENT_QUOTES, RUN_QUOTES]

  const targetCount = 3 + Math.floor(rng() * 2)

  if (userWinning) {
    pickUniqueQuote(highlights, pickPlayPool(userScorePools, rng), userA, undefined, rng)
    pickUniqueQuote(highlights, pickPlayPool(userScorePools, rng), userB, undefined, rng)
    if (rng() < 0.4) {
      pickUniqueQuote(highlights, USER_DEFENSE_QUOTES, userA, undefined, rng)
    } else if (rng() < 0.45) {
      pickUniqueQuote(highlights, USER_HEATING_QUOTES, userA, undefined, rng)
      nextState = { ...nextState, userHot: userA }
    } else {
      pickUniqueQuote(highlights, pickPlayPool(champScorePools, rng), starA, team, rng)
    }
  } else if (championWinning) {
    pickUniqueQuote(highlights, pickPlayPool(champScorePools, rng), starA, team, rng)
    pickUniqueQuote(highlights, pickPlayPool(champScorePools, rng), starB, team, rng)
    if (rng() < 0.4) {
      pickUniqueQuote(highlights, CHAMPION_DEFENSE_QUOTES, starA, team, rng)
    } else if (rng() < 0.45) {
      pickUniqueQuote(highlights, CHAMPION_HEATING_QUOTES, starB, team, rng)
      nextState = { ...nextState, championHot: starB }
    } else {
      pickUniqueQuote(highlights, pickPlayPool(userScorePools, rng), userA, undefined, rng)
    }
  } else if (tight) {
    pickUniqueQuote(highlights, TIGHT_QUOTES, userA, starA, rng)
    if (rng() < 0.35) {
      pickUniqueQuote(highlights, MISC_EVENT_QUOTES, userA, starA, rng)
    }
    if (margin > 0) {
      pickUniqueQuote(highlights, pickPlayPool(userScorePools, rng), userA, undefined, rng)
      if (rng() < 0.35) {
        pickUniqueQuote(highlights, USER_HEATING_QUOTES, userB, undefined, rng)
        nextState = { ...nextState, userHot: userB }
      }
    } else if (margin < 0) {
      pickUniqueQuote(highlights, pickPlayPool(champScorePools, rng), starA, team, rng)
      if (rng() < 0.35) {
        pickUniqueQuote(highlights, CHAMPION_HEATING_QUOTES, starB, team, rng)
        nextState = { ...nextState, championHot: starB }
      }
    } else {
      pickUniqueQuote(highlights, TIGHT_QUOTES, userB, starB, rng)
      if (rng() < 0.4) {
        pickUniqueQuote(highlights, pickPlayPool(mixedPools, rng), userA, starA, rng)
      }
    }
  }

  while (highlights.length < targetCount) {
    const fillerPlayer = pickRosterName(roster, rng)
    const fillerStar = pickStarName(champion, rng)
    if (rng() < 0.5) {
      pickUniqueQuote(highlights, pickPlayPool(mixedPools, rng), fillerPlayer, fillerStar, rng)
    } else if (rng() < 0.5) {
      pickUniqueQuote(highlights, pickPlayPool(userScorePools, rng), fillerPlayer, undefined, rng)
    } else {
      pickUniqueQuote(highlights, pickPlayPool(champScorePools, rng), fillerStar, team, rng)
    }
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
  roster: readonly Player[],
  rng: SeededRandom,
): string {
  if (quarter === 4) {
    const fourthLines = [
      'Fourth quarter — everything on the line.',
      'Final quarter — championship moments ahead.',
      'Q4 — win or go home time.',
      'The fourth quarter — legends are made here.',
    ]
    return pickFrom(fourthLines, rng)
  }

  const margin = userPoints - championPoints
  const team = championShortName(champion)
  if (margin >= 6) {
    const player = pickRosterName(roster, rng)
    return pickFrom(QUARTER_HEADLINE_WINNING, rng)(player, team)
  }
  if (margin <= -6) {
    const star = pickStarName(champion, rng)
    return pickFrom(QUARTER_HEADLINE_LOSING, rng)(star, team)
  }
  return pickFrom(QUARTER_HEADLINE_TIGHT, rng)('', team)
}

function buildOvertimeHighlights(
  periodIndex: number,
  periodCount: number,
  roster: readonly Player[],
  champion: ChampionTeam,
  rng: SeededRandom,
): string[] {
  const team = championShortName(champion)
  const highlights: string[] = []

  const otOpeners = [
    'Regulation expires tied — we are headed to overtime!',
    'Tied at the buzzer — overtime it is!',
    'Regulation ends deadlocked — extra basketball coming.',
    'We’re going to OT — nobody blinked.',
  ]
  const doubleOtOpeners = [
    'Still tied after OT — double overtime!',
    'OT ends tied — we need another period!',
    'Deadlocked after overtime — double OT!',
  ]
  const tripleOtOpeners = [
    'Still tied after 2OT — triple overtime!',
    'Unbelievable — we’re headed to a third overtime!',
    '2OT ends tied — triple overtime basketball!',
  ]

  if (periodIndex === 0) {
    highlights.push(pickFrom(otOpeners, rng))
  } else if (periodIndex === 1) {
    highlights.push(pickFrom(doubleOtOpeners, rng))
  } else {
    highlights.push(pickFrom(tripleOtOpeners, rng))
  }

  const userName = pickRosterName(roster, rng)
  const starName = pickStarName(champion, rng)

  if (periodIndex < periodCount - 1) {
    const tiedLines = [
      `${userName} and ${starName} trade buckets — still deadlocked.`,
      `Neither side can separate — tied after ${periodIndex === 0 ? 'OT' : '2OT'}.`,
      `${userName} answers. ${starName} answers. Still tied.`,
      'The tension is unbearable — another OT period coming.',
    ]
    highlights.push(pickFrom(tiedLines, rng))
    pickUniqueQuote(highlights, pickPlayPool([TIGHT_QUOTES, MISC_EVENT_QUOTES], rng), userName, starName, rng)
  } else {
    pickUniqueQuote(highlights, pickPlayPool([USER_QUOTES, USER_DEFENSE_QUOTES], rng), userName, undefined, rng)
    pickUniqueQuote(highlights, pickPlayPool([CHAMPION_QUOTES, CHAMPION_DEFENSE_QUOTES], rng), starName, team, rng)
  }

  while (highlights.length < 3) {
    pickUniqueQuote(
      highlights,
      pickPlayPool([TIGHT_QUOTES, RUN_QUOTES, MISC_EVENT_QUOTES, USER_QUOTES, CHAMPION_QUOTES], rng),
      pickRosterName(roster, rng),
      pickStarName(champion, rng),
      rng,
    )
  }

  return highlights.slice(0, 4)
}

const FINAL_WIN_LINES: QuoteFn[] = [
  (player) => `${player} delivers in the clutch.`,
  (player) => `${player} seals it — your squad survives.`,
  (player) => `${player} wills this team to victory.`,
  (player) => `${player} finishes what they started.`,
]

const FINAL_LOSS_LINES: QuoteFn[] = [
  (star, team) => `${star} closes it out for ${team ?? 'the champs'}.`,
  (star) => `${star} ends it — champions advance.`,
  (star, team) => `${star} delivers the dagger for ${team ?? 'the champs'}.`,
  (star) => `${star} finishes the job.`,
]

const FINAL_GAME_WINNER_LINES: QuoteFn[] = [
  (player) => `${player} buries the game-winner at the buzzer!`,
  (player) => `${player} hits the dagger — crowd erupts!`,
  (player) => `${player} drills the buzzer-beater!`,
  (player) => `${player} banks it in at the horn — game over!`,
]

const FINAL_OT_GAME_WINNER_LINES: QuoteFn[] = [
  (player) => `${player} buries the overtime game-winner!`,
  (player) => `${player} hits the OT dagger at the buzzer!`,
  (player) => `${player} ends it in overtime — nothing but net!`,
  (player) => `${player} drills the extra-period game-winner!`,
]

const FINAL_CLOSER_LINES = [
  'Heart-stopping finish — every possession mattered.',
  'Instant classic — this one will be remembered.',
  'Pure Game 7 chaos — what a finish.',
  'The cap gods have spoken.',
  'That’s basketball at its absolute peak.',
  'Neither team deserved to lose — but someone had to win.',
]

function buildFinalHighlights(
  result: SimResult,
  roster: readonly Player[],
  champion: ChampionTeam,
  rng: SeededRandom,
): string[] {
  const team = championShortName(champion)
  const highlights: string[] = []
  const { finishDrama } = result
  const otPeriodCount = finishDrama.overtimePeriodCount ?? (finishDrama.overtime ? 1 : 0)

  if (finishDrama.overtime) {
    const otLeadIns = [
      'Triple overtime — someone has to win this.',
      'Triple OT — exhaustion everywhere, glory on the line.',
      'We’ve reached triple overtime — legendary territory.',
    ]
    const doubleOtLeadIns = [
      'Double overtime — both teams refuse to fold.',
      'Double OT — neither side will break.',
      'Two overtimes deep — this is absurd.',
    ]
    if (otPeriodCount >= 3) {
      highlights.push(pickFrom(otLeadIns, rng))
    } else if (otPeriodCount >= 2) {
      highlights.push(pickFrom(doubleOtLeadIns, rng))
    }
    if (finishDrama.gameWinner && finishDrama.winnerSide) {
      const winner =
        finishDrama.winnerSide === 'user'
          ? pickRosterName(roster, rng)
          : pickStarName(champion, rng)
      pickUniqueQuote(highlights, FINAL_OT_GAME_WINNER_LINES, winner, team, rng)
    } else if (finishDrama.winnerSide === 'user') {
      pickUniqueQuote(highlights, FINAL_WIN_LINES, pickRosterName(roster, rng), undefined, rng)
    } else if (finishDrama.winnerSide === 'champion') {
      pickUniqueQuote(highlights, FINAL_LOSS_LINES, pickStarName(champion, rng), team, rng)
    }
  } else if (finishDrama.gameWinner && finishDrama.winnerSide) {
    const winner =
      finishDrama.winnerSide === 'user'
        ? pickRosterName(roster, rng)
        : pickStarName(champion, rng)
    pickUniqueQuote(highlights, FINAL_GAME_WINNER_LINES, winner, team, rng)
  } else if (result.outcome === 'win') {
    pickUniqueQuote(highlights, FINAL_WIN_LINES, pickRosterName(roster, rng), undefined, rng)
  } else if (result.outcome === 'loss') {
    pickUniqueQuote(highlights, FINAL_LOSS_LINES, pickStarName(champion, rng), team, rng)
  } else {
    const pushLines = [
      'Both sides leave everything on the floor — a true Game 7 stalemate.',
      'Tied at the buzzer — an all-time classic deadlock.',
      'Neither team could finish it — pure chaos.',
    ]
    highlights.push(pickFrom(pushLines, rng))
  }

  highlights.push(
    result.margin <= 5 ? pickFrom(FINAL_CLOSER_LINES.slice(0, 3), rng) : pickFrom(FINAL_CLOSER_LINES, rng),
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
          : quarterHeadline(quarter.quarter, userPoints, championPoints, champion, roster, rng),
      highlights:
        isRegulationFinal && !result.finishDrama.overtime
          ? buildFinalHighlights(result, roster, champion, rng)
          : quarterResult.highlights,
      emphasis: isRegulationFinal && !result.finishDrama.overtime,
    })

    previousUser = quarter.user
    previousChampion = quarter.champion
  }

  if (result.finishDrama.overtime) {
    const otPeriods =
      result.overtimePeriods ??
      (result.regulationScore
        ? [{ user: result.userScore, champion: result.championScore }]
        : [])

    for (const [periodIndex, periodScores] of otPeriods.entries()) {
      const deltaUser = periodScores.user - previousUser
      const deltaChampion = periodScores.champion - previousChampion
      const isFinalPeriod = periodIndex === otPeriods.length - 1
      const quarter = overtimePeriodLabel(periodIndex)

      events.push({
        id: `evt-${events.length}`,
        kind: 'overtime',
        quarter,
        userScore: periodScores.user,
        championScore: periodScores.champion,
        deltaUser,
        deltaChampion,
        headline: isFinalPeriod
          ? result.outcome === 'win'
            ? `Final — you win ${result.userScore}-${result.championScore} in ${quarter === 'OT' ? 'overtime' : quarter}.`
            : result.outcome === 'loss'
              ? `Final — ${champion.name} wins ${result.championScore}-${result.userScore} in ${quarter}.`
              : `Final — push ${result.userScore}-${result.championScore} after ${quarter}.`
          : quarter === 'OT'
            ? `End of OT — tied ${periodScores.user}-${periodScores.champion}.`
            : quarter === '2OT'
              ? `End of 2OT — tied ${periodScores.user}-${periodScores.champion}.`
              : `End of ${quarter} — tied ${periodScores.user}-${periodScores.champion}.`,
        highlights: isFinalPeriod
          ? buildFinalHighlights(result, roster, champion, rng)
          : buildOvertimeHighlights(
              periodIndex,
              otPeriods.length,
              roster,
              champion,
              rng,
            ),
        emphasis: isFinalPeriod,
      })

      previousUser = periodScores.user
      previousChampion = periodScores.champion
    }
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
