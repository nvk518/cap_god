import { getEraConfig } from '../data/eras'
import { Button } from '../ui/Button'
import type { ChampionTeam, EraId } from '../types/game'
import styles from './OpponentReveal.module.css'

export interface OpponentRevealProps {
  champion: ChampionTeam
  era: EraId
  onStartDraft: () => void
}

export function OpponentReveal({ champion, era, onStartDraft }: OpponentRevealProps) {
  const eraConfig = getEraConfig(era)

  return (
    <section className={styles.root} aria-label="Opponent reveal">
      <p className={styles.kicker}>
        {eraConfig.label} · {champion.seasonYear} · Game 7
      </p>

      <div className={styles.matchup}>
        <div className={styles.side}>
          <span className={styles.sideLabel}>You</span>
          <span className={styles.sideValue}>GM</span>
        </div>
        <span className={styles.versus} aria-hidden="true">
          vs
        </span>
        <div className={styles.side}>
          <span className={styles.sideLabel}>Champion</span>
          <span className={styles.sideValue}>{champion.name}</span>
        </div>
      </div>

      <div className={styles.ratingCard}>
        <span className={styles.ratingLabel}>Championship Rating</span>
        <span className={styles.ratingValue}>{champion.rating}</span>
        <p className={styles.ratingHint}>
          Build a five-man roster under the cap, then survive the sim.
        </p>
      </div>

      <Button variant="primary" fullWidth size="lg" onClick={onStartDraft}>
        Start Draft
      </Button>
    </section>
  )
}
