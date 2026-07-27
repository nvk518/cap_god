import { getChampionsByEraOrdered } from '../data/champions'
import { getEraConfig } from '../data/eras'
import { ALL_BADGE_IDS, badgeLabel } from '../lib/badges'
import type { Player } from '../schemas/player'
import type { BadgeId, ChampionTeam, EraId, SessionRecord, SimResult } from '../types/game'
import { Button } from '../ui/Button'
import { ShareResultButton } from './ShareResultButton'
import styles from './EraCompleteScreen.module.css'

export interface EraCompleteScreenProps {
  era: EraId
  session: SessionRecord
  result: SimResult
  champion: ChampionTeam
  roster: readonly Player[]
  capSpend: number
  capLimit: number
  badgesEarned: readonly BadgeId[]
  badgeCounts: Record<BadgeId, number>
  onRunItBack: () => void
  onChangeEra: () => void
}

export function EraCompleteScreen({
  era,
  session,
  result,
  champion,
  roster,
  capSpend,
  capLimit,
  badgesEarned,
  badgeCounts,
  onRunItBack,
  onChangeEra,
}: EraCompleteScreenProps) {
  const eraConfig = getEraConfig(era)
  const totalChampions = getChampionsByEraOrdered(era).length
  const totalBadges = ALL_BADGE_IDS.reduce((sum, id) => sum + badgeCounts[id], 0)

  return (
    <section className={styles.root} aria-label="Era complete">
      <header className={styles.header}>
        <p className={styles.kicker}>{eraConfig.label} · Complete</p>
        <h2 className={styles.title}>Dynasty Run Complete</h2>
        <p className={styles.subtitle}>
          You defeated all {totalChampions} champions in the {eraConfig.label}.
        </p>
      </header>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{session.wins}</span>
          <span className={styles.statLabel}>Wins this run</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalBadges}</span>
          <span className={styles.statLabel}>Badges earned</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {session.streakType === 'win' ? session.streak : '—'}
          </span>
          <span className={styles.statLabel}>Final win streak</span>
        </div>
      </div>

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
        <Button variant="primary" fullWidth size="lg" onClick={onRunItBack}>
          Run It Back
        </Button>
        <Button variant="secondary" fullWidth onClick={onChangeEra}>
          Change Era
        </Button>
      </div>
    </section>
  )
}
