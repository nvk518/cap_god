import {
  getEraSalaryCap,
  getSalaryTag,
  getSalaryTagLabel,
} from '../lib/draft'
import { formatSalary, formatStat } from '../lib/format'
import { formatPositions } from '../schemas/player'
import type { Player } from '../schemas/player'
import type { Difficulty, EraConfig } from '../types/game'
import styles from './DraftCard.module.css'

export interface DraftCardProps {
  player: Player
  salaryRevealed: boolean
  era: EraConfig
  difficulty: Difficulty
  activeSlot?: import('../types/game').LineupSlot
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function tagClass(tag: ReturnType<typeof getSalaryTag>): string | undefined {
  if (tag === 'cheap') {
    return styles.tagCheap
  }
  if (tag === 'bloat') {
    return styles.tagBloat
  }
  return undefined
}

export function DraftCard({ player, salaryRevealed, era, difficulty, activeSlot }: DraftCardProps) {
  const tagCap = era.id === 'timeMachine' ? getEraSalaryCap(player.era) : era.cap
  const salaryTag = getSalaryTag(player.salary, tagCap)
  const salaryLabel = getSalaryTagLabel(salaryTag)
  const hardBlind = difficulty === 'hard' && !salaryRevealed
  const showRating = difficulty === 'normal' || salaryRevealed

  return (
    <div className={styles.scene}>
      <div className={joinClasses(styles.card, hardBlind && styles.hardBlind)}>
        <div className={joinClasses(styles.cardInner, salaryRevealed && styles.revealed)}>
          <div className={styles.face}>
            <div className={styles.faceHeader}>
            <span className={styles.year}>
              {player.year}
              {showRating ? ` · ${player.rating}` : ''}
            </span>
          </div>
          <h2 className={joinClasses(styles.name, hardBlind && styles.nameCompact)}>{player.player}</h2>
          {hardBlind ? null : (
            <>
              {activeSlot ? (
                <p className={styles.positionLine}>Eligible for {activeSlot}</p>
              ) : (
                <p className={styles.positionLine}>{formatPositions(player.positions)}</p>
              )}
              <dl className={styles.stats}>
                <div className={styles.stat}>
                  <dt>PTS</dt>
                  <dd>{formatStat(player.pts)}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>AST</dt>
                  <dd>{formatStat(player.ast)}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>REB</dt>
                  <dd>{formatStat(player.trb)}</dd>
                </div>
              </dl>
            </>
          )}
          </div>

          <div className={styles.back}>
          <p className={styles.backLabel}>Contract Revealed</p>
          <p className={styles.salary}>{formatSalary(player.salary)}</p>
          {salaryRevealed && difficulty === 'hard' ? (
            <p className={styles.positionLine}>{formatPositions(player.positions)}</p>
          ) : null}
          {salaryLabel ? (
            <p className={joinClasses(styles.tag, tagClass(salaryTag))}>{salaryLabel}</p>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
