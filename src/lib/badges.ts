import type { BadgeId } from '../types/game'

export function badgeLabel(badge: BadgeId): string {
  switch (badge) {
    case 'capGod':
      return 'Cap God'
    case 'luxuryTaxFraud':
      return 'Luxury Tax Fraud'
    case 'heartbreakLoss':
      return 'Heartbreak Loss'
    case 'dynastyKiller':
      return 'Dynasty Killer'
  }
}

export function badgeDescription(badge: BadgeId): string {
  switch (badge) {
    case 'capGod':
      return 'Won Game 7 while staying under the cap.'
    case 'luxuryTaxFraud':
      return 'Went over the cap — the league office is watching.'
    case 'heartbreakLoss':
      return 'Lost by three or fewer. So close.'
    case 'dynastyKiller':
      return 'Took down a dynasty-tier juggernaut.'
  }
}

export const ALL_BADGE_IDS: readonly BadgeId[] = [
  'capGod',
  'luxuryTaxFraud',
  'heartbreakLoss',
  'dynastyKiller',
]
