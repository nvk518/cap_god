import { useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../schemas/player'
import { buildSimTimeline } from '../lib/simTimeline'
import type { ChampionTeam, SimResult } from '../types/game'
import { Button } from '../ui/Button'
import styles from './SimTicker.module.css'

export interface SimTickerProps {
  result: SimResult
  champion: ChampionTeam
  roster: readonly Player[]
  onComplete: () => void
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function quarterLabel(
  quarter: 1 | 2 | 3 | 4 | 'OT',
  kind: 'tipoff' | 'quarter' | 'overtime',
  isFinalEvent: boolean,
): string {
  if (quarter === 'OT') {
    return 'OT'
  }
  if (isFinalEvent && kind !== 'tipoff') {
    return 'Final'
  }
  return `Q${quarter}`
}

export function SimTicker({ result, champion, roster, onComplete }: SimTickerProps) {
  const timeline = useMemo(() => buildSimTimeline(result, roster, champion), [champion, result, roster])
  const [activeIndex, setActiveIndex] = useState(0)
  const completedRef = useRef(false)
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const lastIndex = timeline.events.length - 1
  const current = timeline.events[activeIndex]
  const isFinalEvent = activeIndex >= lastIndex && current?.kind !== 'tipoff'
  const atEnd = activeIndex >= lastIndex
  const hasOvertime = result.finishDrama.overtime

  useEffect(() => {
    setActiveIndex(0)
    completedRef.current = false
  }, [timeline])

  useEffect(() => {
    if (reducedMotion || atEnd) {
      return
    }

    const delayMs = current?.kind === 'tipoff' ? 800 : 1200
    const timer = window.setTimeout(() => {
      setActiveIndex((value) => {
        if (value >= lastIndex) {
          return value
        }
        return value + 1
      })
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [activeIndex, atEnd, current?.kind, lastIndex, reducedMotion])

  const advance = () => {
    if (atEnd) {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    setActiveIndex((value) => value + 1)
  }

  const skip = () => {
    completedRef.current = true
    onComplete()
  }

  const nextLabel = atEnd
    ? 'See Result'
    : activeIndex === 0 && current?.kind === 'tipoff'
      ? 'Start Game'
      : current?.kind === 'overtime' || (isFinalEvent && !hasOvertime)
        ? 'Final Buzzer'
        : current?.quarter === 4 && hasOvertime
          ? 'Overtime'
          : 'Next Quarter'

  return (
    <section className={styles.root} aria-label="Game 7 simulation" aria-live="polite">
      <header className={styles.header}>
        <p className={styles.kicker}>Game 7 · {champion.seasonYear}</p>
        <h2 className={styles.matchup}>Your Squad vs {champion.name}</h2>
      </header>

      <ul className={styles.quarterTrack} aria-label="Quarter progress">
        {([1, 2, 3, 4] as const).map((quarter) => {
          const quarterEventIndex = timeline.events.findIndex(
            (event) => event.kind === 'quarter' && event.quarter === quarter,
          )
          const isComplete = quarterEventIndex >= 0 && activeIndex >= quarterEventIndex
          const isCurrent =
            current?.quarter === quarter ||
            (current?.kind === 'tipoff' && quarter === 1 && activeIndex === 0)

          return (
            <li
              key={quarter}
              className={joinClasses(
                styles.quarterDot,
                isComplete && styles.quarterDotActive,
                isCurrent && styles.quarterDotCurrent,
              )}
            >
              Q{quarter}
            </li>
          )
        })}
        {hasOvertime ? (
          <li
            className={joinClasses(
              styles.quarterDot,
              current?.quarter === 'OT' && styles.quarterDotCurrent,
              activeIndex >= lastIndex && styles.quarterDotActive,
            )}
          >
            OT
          </li>
        ) : null}
      </ul>

      <div className={styles.scoreboard}>
        <div className={styles.team}>
          <span className={styles.teamLabel}>You</span>
          <span className={joinClasses(styles.teamScore, current?.deltaUser ? styles.scorePulse : false)}>
            {Math.round(current?.userScore ?? 0)}
          </span>
        </div>
        <div className={styles.clock}>
          <span className={styles.quarter}>
            {quarterLabel(current?.quarter ?? 1, current?.kind ?? 'tipoff', isFinalEvent)}
          </span>
          <span className={styles.vs}>
            {current?.kind === 'tipoff'
              ? 'Opening tip'
              : current?.kind === 'overtime'
                ? 'Overtime'
                : current?.quarter === 4 && hasOvertime && activeIndex < lastIndex
                  ? 'End of regulation'
                  : isFinalEvent
                    ? 'Buzzer'
                    : 'Quarter break'}
          </span>
        </div>
        <div className={joinClasses(styles.team, styles.teamChampion)}>
          <span className={styles.teamLabel}>{champion.name}</span>
          <span
            className={joinClasses(styles.teamScore, current?.deltaChampion ? styles.scorePulse : false)}
          >
            {Math.round(current?.championScore ?? 0)}
          </span>
        </div>
      </div>

      <div className={styles.eventCard}>
        <p className={joinClasses(styles.eventHeadline, current?.emphasis && styles.eventEmphasis)}>
          {current?.headline ?? 'Tip-off'}
        </p>
        {current?.highlights && current.highlights.length > 0 ? (
          <ul className={styles.highlightList}>
            {current.highlights.map((line) => (
              <li key={line} className={styles.highlightItem}>
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.controls}>
        <Button variant="primary" fullWidth onClick={advance}>
          {nextLabel}
        </Button>
        {!reducedMotion ? (
          <Button variant="secondary" fullWidth onClick={skip}>
            Skip to Result
          </Button>
        ) : null}
      </div>
    </section>
  )
}
