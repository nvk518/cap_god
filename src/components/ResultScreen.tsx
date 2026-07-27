import { useState } from 'react'
import { ALL_BADGE_IDS, badgeDescription, badgeLabel } from '../lib/badges'
import { clearGameLogs, exportGameLogsCsv, exportGameLogsJson, loadGameLogs } from '../lib/gameLog'
import { AnalyticsEvent, trackButtonClick } from '../lib/analytics'
import type { Player } from '../schemas/player'
import { Button } from '../ui/Button'
import type { BadgeId, ChampionTeam, EraId, SessionRecord, SimResult } from '../types/game'
import { LINEUP_SLOTS } from '../types/game'
import { ShareResultButton } from './ShareResultButton'
import styles from './ResultScreen.module.css'

export interface ResultScreenProps {
  result: SimResult
  champion: ChampionTeam
  badges: readonly BadgeId[]
  era: EraId
  session: SessionRecord
  roster: readonly Player[]
  capSpend: number
  capLimit: number
  attemptNumber: number
  badgeCounts: Record<BadgeId, number>
  onTryAgain: () => void
  onPlayAgain: () => void
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function outcomeLabel(result: SimResult): string {
  if (result.outcome === 'push') {
    return 'Push — Exact Tie'
  }
  return 'You Lose'
}

function outcomeClass(result: SimResult): string {
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
  roster,
  capSpend,
  capLimit,
  attemptNumber,
  badgeCounts,
  onTryAgain,
  onPlayAgain,
}: ResultScreenProps) {
  const [showStats, setShowStats] = useState(false)
  const [logsCleared, setLogsCleared] = useState(false)

  return (
    <section className={styles.root} aria-label="Result screen">
      <header className={styles.header}>
        <h2 className={joinClasses(styles.outcome, outcomeClass(result))}>{outcomeLabel(result)}</h2>
        <p className={styles.subtitle}>
          vs {champion.name} · Attempt #{attemptNumber}
        </p>
      </header>

      <div className={styles.matchCard}>
        <div className={styles.scores}>
          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>Your Squad</span>
            <span className={styles.scoreValue}>{result.userScore}</span>
          </div>
          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>{champion.name}</span>
            <span className={styles.scoreValue}>{result.championScore}</span>
          </div>
        </div>

        {result.quarters.length > 0 ? (
          <div className={styles.quarterStrip} aria-label="Quarter scores">
            {result.quarters.map((quarter) => (
              <span key={quarter.quarter} className={styles.quarterCell}>
                <span className={styles.quarterLabel}>Q{quarter.quarter}</span>
                <span className={styles.quarterScore}>
                  {quarter.user}-{quarter.champion}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {roster.length > 0 ? (
          <ul className={styles.rosterGrid} aria-label="Your starting five">
            {LINEUP_SLOTS.map((slot, index) => {
              const player = roster[index]
              if (!player) {
                return null
              }
              return (
                <li key={slot} className={styles.rosterCell}>
                  <span className={styles.rosterSlot}>{slot}</span>
                  <span className={styles.rosterName}>{player.player}</span>
                  <span className={styles.rosterRating}>{player.rating}</span>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className={styles.meta}>
          <span>Rating {result.userRating}</span>
          <span>Champ {result.championEffectiveRating}</span>
          {result.overCap ? (
            <span className={styles.overCap}>Over cap −{result.breakdown.overCapPenalty}</span>
          ) : null}
        </div>
      </div>

      <p className={styles.nextGoal}>New opponent, new draft — win once to clear the challenge.</p>

      <div className={styles.badges}>
        <div className={styles.badgesHeader}>
          <h3 className={styles.sectionTitle}>Badges</h3>
        </div>

        {badges.length > 0 ? (
          <div className={styles.earnedBadges}>
            {badges.map((badge) => (
              <span key={badge} className={styles.earnedBadge} title={badgeDescription(badge)}>
                {badgeLabel(badge)}
              </span>
            ))}
          </div>
        ) : null}

        <div className={styles.badgeTotals}>
          {ALL_BADGE_IDS.map((badge) => (
            <span key={badge} className={styles.badgeTotal}>
              <span className={styles.badgeTotalName}>{badgeLabel(badge)}</span>
              <span className={styles.badgeTotalCount}>{badgeCounts[badge]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <ShareResultButton
          result={result}
          champion={champion}
          roster={roster}
          era={era}
          capSpend={capSpend}
          capLimit={capLimit}
          attemptNumber={attemptNumber}
          size="sm"
        />
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => {
            trackButtonClick(AnalyticsEvent.CLICK_TRY_AGAIN, {
              era,
              outcome: result.outcome,
              attempt: attemptNumber,
            })
            onTryAgain()
          }}
        >
          Try Again
        </Button>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          className={styles.changeEra}
          onClick={() => {
            trackButtonClick(AnalyticsEvent.CLICK_CHANGE_ERA, { era })
            onPlayAgain()
          }}
        >
          Choose Another Era
        </Button>
      </div>

      <div className={styles.statsToggle}>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={() => {
            const nextShowStats = !showStats
            trackButtonClick(AnalyticsEvent.CLICK_TOGGLE_STATS_EXPORT, {
              era,
              show_stats: nextShowStats,
            })
            setShowStats(nextShowStats)
          }}
        >
          {showStats ? 'Hide export' : 'Stats & export'}
        </Button>
      </div>

      {showStats ? (
        <div className={styles.logActions}>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => {
              trackButtonClick(AnalyticsEvent.CLICK_EXPORT_LOGS_JSON, { era })
              downloadText('cap-god-logs.json', exportGameLogsJson(loadGameLogs()), 'application/json')
            }}
          >
            Export JSON
          </Button>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => {
              trackButtonClick(AnalyticsEvent.CLICK_EXPORT_LOGS_CSV, { era })
              downloadText('cap-god-logs.csv', exportGameLogsCsv(loadGameLogs()), 'text/csv')
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="danger"
            size="sm"
            fullWidth
            onClick={() => {
              trackButtonClick(AnalyticsEvent.CLICK_CLEAR_LOGS, { era })
              clearGameLogs()
              setLogsCleared(true)
            }}
          >
            {logsCleared ? 'Logs cleared' : 'Clear logs'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
