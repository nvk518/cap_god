import { getEraConfig } from '../data/eras'
import { ALL_BADGE_IDS, badgeLabel } from '../lib/badges'
import { AnalyticsEvent, trackButtonClick } from '../lib/analytics'
import type { Player } from '../schemas/player'
import type { BadgeId, ChampionTeam, EraId, SessionRecord, SimResult } from '../types/game'
import { LINEUP_SLOTS } from '../types/game'
import { Button } from '../ui/Button'
import { ShareResultButton } from './ShareResultButton'
import styles from './EraCompleteScreen.module.css'

export interface ChallengeClearScreenProps {
  era: EraId
  session: SessionRecord
  result: SimResult
  champion: ChampionTeam
  roster: readonly Player[]
  capSpend: number
  capLimit: number
  clearAttempts: number
  clearIsBest: boolean
  badgesEarned: readonly BadgeId[]
  badgeCounts: Record<BadgeId, number>
  onRunItBack: () => void
  onChangeEra: () => void
}

export function ChallengeClearScreen({
  era,
  session,
  result,
  champion,
  roster,
  capSpend,
  capLimit,
  clearAttempts,
  clearIsBest,
  badgesEarned,
  badgeCounts,
  onRunItBack,
  onChangeEra,
}: ChallengeClearScreenProps) {
  const eraConfig = getEraConfig(era)
  const totalBadges = ALL_BADGE_IDS.reduce((sum, id) => sum + badgeCounts[id], 0)

  return (
    <section className={styles.root} aria-label="Challenge cleared">
      <header className={styles.header}>
        <p className={styles.kicker}>{eraConfig.label} · Challenge Cleared</p>
        <h2 className={styles.title}>Cleared in {clearAttempts} Attempts</h2>
        <p className={styles.subtitle}>
          {clearIsBest ? 'New personal best! ' : ''}
          You beat {champion.name} {result.userScore}–{result.championScore} in Game 7.
        </p>
      </header>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{clearAttempts}</span>
          <span className={styles.statLabel}>Attempts this clear</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalBadges}</span>
          <span className={styles.statLabel}>Badges earned</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {session.streakType === 'win' ? session.streak : '—'}
          </span>
          <span className={styles.statLabel}>Win streak</span>
        </div>
      </div>

      {roster.length > 0 ? (
        <ul className={styles.rosterGrid} aria-label="Your starting five">
          {LINEUP_SLOTS.map((slot, index) => {
            const player = roster[index]
            if (!player) {
              return null
            }
            return (
              <li key={slot} className={styles.badge}>
                {slot} {player.player} ({player.rating})
                {result.overCap ? '' : ' · Under cap'}
              </li>
            )
          })}
        </ul>
      ) : null}

      {badgesEarned.length > 0 ? (
        <div className={styles.badges}>
          <h3 className={styles.badgesTitle}>Final Game Badges</h3>
          <ul className={styles.badgeList}>
            {badgesEarned.map((badge) => (
              <li key={badge} className={styles.badge}>
                {badgeLabel(badge)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.actions}>
        <ShareResultButton
          result={result}
          champion={champion}
          roster={roster}
          era={era}
          capSpend={capSpend}
          capLimit={capLimit}
        />
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={() => {
            trackButtonClick(AnalyticsEvent.CLICK_RUN_IT_BACK, { era })
            onRunItBack()
          }}
        >
          Run It Back
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            trackButtonClick(AnalyticsEvent.CLICK_CHANGE_ERA, { era })
            onChangeEra()
          }}
        >
          Choose Another Era
        </Button>
      </div>
    </section>
  )
}

/** @deprecated Use ChallengeClearScreen */
export const EraCompleteScreen = ChallengeClearScreen
