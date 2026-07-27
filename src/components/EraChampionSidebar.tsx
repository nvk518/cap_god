import { getChampionsByEraOrdered } from '../data/champions'
import {
  getDefeatedChampions,
  getRemainingChampions,
  loadDefeatedChampions,
} from '../lib/eraProgress'
import type { ChampionTeam, EraId } from '../types/game'
import styles from './EraChampionSidebar.module.css'

export interface EraChampionSidebarProps {
  eraId: EraId
  defeatedIds?: readonly string[]
  compact?: boolean
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function ChampionRow({
  champion,
  variant,
}: {
  champion: ChampionTeam
  variant?: 'current' | 'defeated'
}) {
  return (
    <li
      className={joinClasses(
        styles.item,
        variant === 'current' && styles.itemCurrent,
        variant === 'defeated' && styles.itemDefeated,
      )}
    >
      <span className={styles.name}>{champion.name}</span>
      <span className={styles.rating}>{champion.rating}</span>
    </li>
  )
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
  const current = remaining[0]
  const upcoming = remaining.slice(1)
  const upcomingPreview = compact ? upcoming.slice(0, 2) : upcoming

  return (
    <aside
      className={joinClasses(styles.root, compact && styles.rootCompact)}
      aria-label="Era champion progress"
    >
      <p className={styles.kicker}>Champion Run</p>
      <p className={styles.summary}>
        {defeated.length}/{allChampions.length} defeated
        {!current ? ' · Era complete' : ''}
      </p>

      {current ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Current</h3>
          <ul className={styles.list}>
            <ChampionRow champion={current} variant="current" />
          </ul>
        </section>
      ) : null}

      {upcomingPreview.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Upcoming</h3>
          <ul className={styles.list}>
            {upcomingPreview.map((champion) => (
              <ChampionRow key={champion.id} champion={champion} />
            ))}
          </ul>
        </section>
      ) : null}

      {defeated.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Defeated</h3>
          <ul className={styles.list}>
            {defeated.map((champion) => (
              <ChampionRow key={champion.id} champion={champion} variant="defeated" />
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  )
}
