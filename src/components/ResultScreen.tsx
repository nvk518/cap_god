import { useState } from 'react'
import { getChampionsByEraOrdered } from '../data/champions'
import { getEraConfig } from '../data/eras'
import { ALL_BADGE_IDS, badgeDescription, badgeLabel } from '../lib/badges'
import { clearGameLogs, exportGameLogsCsv, exportGameLogsJson, loadGameLogs } from '../lib/gameLog'
import { getRemainingChampions } from '../lib/eraProgress'
import type { Player } from '../schemas/player'
import { Button } from '../ui/Button'
import type { BadgeId, ChampionTeam, EraId, SessionRecord, SimResult } from '../types/game'
import { LINEUP_SLOTS } from '../types/game'
import styles from './ResultScreen.module.css'

export interface ResultScreenProps {
  result: SimResult
  champion: ChampionTeam
  badges: readonly BadgeId[]
  era: EraId
  session: SessionRecord
  roster: readonly Player[]
  seed: number
  defeatedIds: readonly string[]
  badgeCounts: Record<BadgeId, number>
  championAttempts: number
  onNextHand: () => void
  onPlayAgain: () => void
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function outcomeLabel(result: SimResult): string {
  if (result.outcome === 'win') {
    return 'You Win!'
  }
  if (result.outcome === 'push') {
    return 'Push — Exact Tie'
  }
  return 'You Lose'
}

function outcomeClass(result: SimResult): string {
  if (result.outcome === 'win') {
    return styles.win ?? ''
  }
  if (result.outcome === 'push') {
    return styles.push ?? ''
  }
  return styles.loss ?? ''
}

function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ResultScreen({
  result,
  champion,
  badges,
  era,
  session,
  roster,
  seed,
  defeatedIds,
  badgeCounts,
  championAttempts,
  onNextHand,
  onPlayAgain,
}: ResultScreenProps) {
  const eraConfig = getEraConfig(era)
  const [showStats, setShowStats] = useState(false)
  const [logsCleared, setLogsCleared] = useState(false)
  const remaining = getRemainingChampions(era, defeatedIds)
  const nextUp = remaining[0]
  const allChampions = getChampionsByEraOrdered(era)
  const bestSigning = [...roster].sort((a, b) => b.rating - a.rating)[0]
  const commentary = result.commentary.slice(0, 2)

  const nextGoal =
    result.outcome === 'win' && nextUp
      ? `Next up: ${nextUp.name} (${nextUp.rating})`
      : result.outcome !== 'win'
        ? `Rematch ${champion.name} to advance (${defeatedIds.length}/${allChampions.length} defeated)`
        : null

  return (
    <section className={styles.root} aria-label="Result screen">
      <header className={styles.header}>
        <p className={styles.kicker}>{eraConfig.label} · Final</p>
        <h2 className={joinClasses(styles.outcome, outcomeClass(result))}>{outcomeLabel(result)}</h2>
        <p className={styles.subtitle}>
          vs {champion.name} · Attempt #{championAttempts}
        </p>
        <p className={styles.sessionRecord}>
          Session {session.wins}-{session.losses}-{session.pushes}
          {session.streak > 0 && session.streakType
            ? ` · ${session.streak}${session.streakType === 'win' ? 'W' : session.streakType === 'loss' ? 'L' : 'P'} streak`
            : ''}
        </p>
      </header>

      <div className={styles.scoreCard}>
        <div className={styles.scoreRow}>
          <span className={styles.scoreLabel}>Your Squad</span>
          <span className={styles.scoreValue}>{result.userScore}</span>
        </div>
        <div className={styles.scoreRow}>
          <span className={styles.scoreLabel}>{champion.name}</span>
          <span className={styles.scoreValue}>{result.championScore}</span>
        </div>
        <div className={styles.meta}>
          <span>Rating {result.userRating}</span>
          <span>Champion Eff. {result.championEffectiveRating}</span>
          {result.overCap ? (
            <span className={styles.overCap}>Over Cap (−{result.breakdown.overCapPenalty})</span>
          ) : null}
        </div>
      </div>

      {result.quarters.length > 0 ? (
        <div className={styles.quarters}>
          <h3 className={styles.sectionTitle}>Quarter Line</h3>
          <table className={styles.quarterTable}>
            <thead>
              <tr>
                <th scope="col">Q</th>
                <th scope="col">You</th>
                <th scope="col">Opp</th>
              </tr>
            </thead>
            <tbody>
              {result.quarters.map((quarter) => (
                <tr key={quarter.quarter}>
                  <td>Q{quarter.quarter}</td>
                  <td>{quarter.user}</td>
                  <td>{quarter.champion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {roster.length > 0 ? (
        <div className={styles.roster}>
          <h3 className={styles.sectionTitle}>Your Starting Five</h3>
          <ul className={styles.rosterList}>
            {LINEUP_SLOTS.map((slot, index) => {
              const player = roster[index]
              if (!player) {
                return null
              }
              return (
                <li key={slot} className={styles.rosterItem}>
                  <span className={styles.rosterSlot}>{slot}</span>
                  <span className={styles.rosterName}>{player.player}</span>
                  <span className={styles.rosterMeta}>
                    {player.year} · {player.rating}
                  </span>
                </li>
              )
            })}
          </ul>
          {bestSigning ? (
            <p className={styles.rosterHighlight}>
              Top signing: {bestSigning.player} ({bestSigning.rating})
            </p>
          ) : null}
        </div>
      ) : null}

      {commentary.length > 0 ? (
        <div className={styles.commentary}>
          <h3 className={styles.sectionTitle}>Game Story</h3>
          <ul className={styles.commentaryList}>
            {commentary.map((line) => (
              <li key={line} className={styles.commentaryItem}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {badges.length > 0 ? (
        <div className={styles.badges}>
          <h3 className={styles.badgesTitle}>Badges Earned</h3>
          <ul className={styles.badgeList}>
            {badges.map((badge) => (
              <li key={badge} className={styles.badge}>
                <span className={styles.badgeName}>{badgeLabel(badge)}</span>
                <span className={styles.badgeDesc}>{badgeDescription(badge)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.noBadges}>No badges this run. Tighten the cap and run it back.</p>
      )}

      <div className={styles.collection}>
        <h3 className={styles.sectionTitle}>Badge Collection</h3>
        <ul className={styles.collectionList}>
          {ALL_BADGE_IDS.map((badge) => (
            <li key={badge} className={styles.collectionItem}>
              <span className={styles.collectionName}>{badgeLabel(badge)}</span>
              <span className={styles.collectionCount}>{badgeCounts[badge]}</span>
            </li>
          ))}
        </ul>
      </div>

      {nextGoal ? <p className={styles.nextGoal}>{nextGoal}</p> : null}

      <p className={styles.seed}>Seed {seed}</p>

      <div className={styles.actions}>
        <Button variant="primary" fullWidth size="lg" onClick={onNextHand}>
          {result.outcome === 'win' ? 'Next Year' : 'Try Again'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onPlayAgain}>
          Change Era
        </Button>
      </div>

      <div className={styles.statsToggle}>
        <Button variant="ghost" fullWidth onClick={() => setShowStats((value) => !value)}>
          {showStats ? 'Hide Stats Export' : 'Stats & Export'}
        </Button>
      </div>

      {showStats ? (
        <div className={styles.logActions}>
          <Button
            variant="secondary"
            fullWidth
            onClick={() =>
              downloadText('cap-god-logs.json', exportGameLogsJson(loadGameLogs()), 'application/json')
            }
          >
            Export Logs (JSON)
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() =>
              downloadText('cap-god-logs.csv', exportGameLogsCsv(loadGameLogs()), 'text/csv')
            }
          >
            Export Logs (CSV)
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              clearGameLogs()
              setLogsCleared(true)
            }}
          >
            {logsCleared ? 'Logs Cleared' : 'Clear Log History'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
