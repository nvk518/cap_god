import { getChampionsByEraOrdered } from '../data/champions'
import { getEraConfig } from '../data/eras'
import type { EraId, SessionRecord } from '../types/game'
import styles from './RunProgressHeader.module.css'

export interface RunProgressHeaderProps {
  eraId: EraId
  defeatedIds: readonly string[]
  session: SessionRecord
}

export function RunProgressHeader({ eraId, defeatedIds, session }: RunProgressHeaderProps) {
  const eraConfig = getEraConfig(eraId)
  const allChampions = getChampionsByEraOrdered(eraId)

  const streakLabel =
    session.streak > 0 && session.streakType
      ? `${session.streak}${session.streakType === 'win' ? 'W' : session.streakType === 'loss' ? 'L' : 'P'} streak`
      : null

  return (
    <header className={styles.root} aria-label="Run progress">
      <div className={styles.row}>
        <span className={styles.era}>{eraConfig.label}</span>
        <span className={styles.progress}>
          {defeatedIds.length}/{allChampions.length} champions
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.session}>
          Session {session.wins}-{session.losses}-{session.pushes}
          {streakLabel ? ` · ${streakLabel}` : ''}
        </span>
      </div>
    </header>
  )
}
