import { getChampionsByEraOrdered } from '../data/champions'
import {
  getDefeatedChampions,
  getRemainingChampions,
  loadDefeatedChampions,
} from '../lib/eraProgress'
import type { EraId } from '../types/game'
import styles from './EraChampionSidebar.module.css'

export interface EraChampionSidebarProps {
  eraId: EraId
  defeatedIds?: readonly string[]
  compact?: boolean
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function EraChampionSidebar({
  eraId,
  defeatedIds,
  compact = false,
}: EraChampionSidebarProps) {
  const resolvedDefeatedIds = defeatedIds ?? loadDefeatedChampions(eraId)
  const defeated = getDefeatedChampions(eraId, resolvedDefeatedIds)
  const remaining = getRemainingChampions(eraId, resolvedDefeatedIds)
  const allChampions = getChampionsByEraOrdered(eraId)
  const nextUp = remaining[0]
  const preview = remaining.slice(0, compact ? 2 : remaining.length)

  return (
    <aside
      className={joinClasses(styles.root, compact && styles.rootCompact)}
      aria-label="Era champion progress"
    >
      <p className={styles.kicker}>Champion Run</p>
      <p className={styles.summary}>
        {defeated.length}/{allChampions.length} defeated
        {nextUp ? ` · Next: ${nextUp.seasonYear}` : ' · Era complete'}
      </p>

      {preview.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{compact ? 'Up Next' : 'Remaining'}</h3>
          <ul className={styles.list}>
            {preview.map((champion, index) => (
              <li
                key={champion.id}
                className={joinClasses(styles.item, index === 0 && styles.itemNext)}
              >
                <span className={styles.year}>{champion.seasonYear}</span>
                <span className={styles.name}>{champion.name}</span>
                <span className={styles.rating}>{champion.rating}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!compact && defeated.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Defeated</h3>
          <ul className={styles.list}>
            {defeated.map((champion) => (
              <li key={champion.id} className={joinClasses(styles.item, styles.itemDefeated)}>
                <span className={styles.year}>{champion.seasonYear}</span>
                <span className={styles.name}>{champion.name}</span>
                <span className={styles.rating}>{champion.rating}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  )
}
