import type { Player } from '../schemas/player'
import { formatMillions } from './format'
import type { ChampionTeam, EraId, GameOutcome, SimResult } from '../types/game'
import { LINEUP_SLOTS } from '../types/game'

export interface ShareResultInput {
  result: SimResult
  champion: ChampionTeam
  roster: readonly Player[]
  era: EraId
  capSpend: number
  capLimit: number
  attemptNumber: number
}

export const SHARE_URL = 'https://nvk518.github.io/cap_god/'

function formatShareMillions(dollars: number): string {
  return formatMillions(dollars).replace(/\.0M$/, 'M')
}

export function formatShortSeason(year: string): string {
  const dashIndex = year.indexOf('-')
  if (dashIndex === -1) {
    return year
  }
  return `'${year.slice(dashIndex + 1)}`
}

export function formatShareOutcomeLetter(outcome: GameOutcome): string {
  if (outcome === 'win') {
    return 'W'
  }
  if (outcome === 'loss') {
    return 'L'
  }
  return 'T'
}

export function formatShareCapLine(spend: number, capLimit: number, era: EraId): string {
  if (era === 'timeMachine') {
    return `CAP ${spend}CP/${capLimit}CP`
  }
  return `CAP ${formatShareMillions(spend)}/${formatShareMillions(capLimit)}`
}

export function formatShareResult(input: ShareResultInput): string {
  const lines: string[] = [SHARE_URL]

  const outcome = formatShareOutcomeLetter(input.result.outcome)
  lines.push(
    `${outcome} ${input.result.userScore}–${input.result.championScore} vs ${input.champion.name}`,
  )

  lines.push(`Attempt #${input.attemptNumber}`)

  lines.push(formatShareCapLine(input.capSpend, input.capLimit, input.era))

  for (let index = 0; index < LINEUP_SLOTS.length; index += 1) {
    const slot = LINEUP_SLOTS[index]
    const player = input.roster[index]
    if (!slot || !player) {
      continue
    }
    lines.push(`${slot} ${player.player} ${formatShortSeason(player.year)}`)
  }

  return lines.join('\n')
}

export type ShareDelivery = 'shared' | 'copied'

export async function deliverShareText(text: string): Promise<ShareDelivery> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return 'copied'
  }

  throw new Error('Sharing is not available in this browser.')
}
