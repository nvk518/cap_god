import { useEffect, useRef } from 'react'
import { playCashRegisterChirp } from '../lib/audio'
import {
  canAdvance,
  canFlip,
  canHit,
  computeOverCapPenalty,
  getCapTone,
  getDraftCapSpend,
  getNextHitPenalty,
  getOverCapAmount,
  isDraftComplete,
  isOverCap,
} from '../lib/draft'
import { formatCapSpend } from '../lib/format'
import { Button } from '../ui/Button'
import type { Difficulty, DraftState, EraConfig, LineupSlot } from '../types/game'
import { DRAFT_OFFERS_PER_SLOT, LINEUP_SLOTS } from '../types/game'
import { CapBar } from './CapBar'
import { DraftCard } from './DraftCard'
import styles from './DraftPhase.module.css'

export interface DraftPhaseProps {
  state: DraftState
  era: EraConfig
  difficulty: Difficulty
  onSign: () => void
  onNextPosition: () => void
  onStartSim: () => void
  onHit: () => void
  muted: boolean
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function DraftPhase({
  state,
  era,
  difficulty,
  onSign,
  onNextPosition,
  onStartSim,
  onHit,
  muted,
}: DraftPhaseProps) {
  const previousRevealed = useRef(state.salaryRevealed)

  useEffect(() => {
    if (state.salaryRevealed && !previousRevealed.current) {
      void playCashRegisterChirp(muted)
    }
    previousRevealed.current = state.salaryRevealed
  }, [muted, state.salaryRevealed])

  const starters = LINEUP_SLOTS.map((slot) => state.starters[slot]).filter(Boolean) as import('../schemas/player').Player[]
  const rosterSpend = getDraftCapSpend(starters, era.id, state.hitPenaltySpend)
  const projectedSpend = state.currentOffer
    ? getDraftCapSpend(
        [...starters, state.currentOffer] as import('../schemas/player').Player[],
        era.id,
        state.hitPenaltySpend,
      )
    : rosterSpend
  const nextHitCost = getNextHitPenalty(state, era.id)
  const tone = getCapTone(rosterSpend, era.cap)
  const flipped = state.salaryRevealed
  const draftComplete = isDraftComplete(state)
  const hardBlindCard = difficulty === 'hard' && !flipped && !draftComplete
  const overCap = draftComplete && isOverCap(starters, era.id, era.cap, state.hitPenaltySpend)
  const overCapAmount = overCap ? getOverCapAmount(rosterSpend, era.cap) : 0
  const overCapPenalty = draftComplete
    ? computeOverCapPenalty(starters, era.id, era.cap, state.hitPenaltySpend)
    : 0

  return (
    <section className={styles.root} aria-label="Draft phase">
      <header className={styles.header}>
        <div className={styles.meta}>
          {draftComplete ? (
            <span className={styles.metaItem}>Roster locked · 5/5</span>
          ) : (
            <>
              <span className={styles.metaItem}>
                Round {state.slotIndex + 1}/5 · {state.activeSlot}
              </span>
              <span className={styles.metaItem}>
                Card {state.offerIndex}
                {state.offerIndex <= DRAFT_OFFERS_PER_SLOT
                  ? `/${DRAFT_OFFERS_PER_SLOT}`
                  : ' (extra)'}
              </span>
            </>
          )}
        </div>
        <CapBar spent={rosterSpend} limit={era.cap} eraId={era.id} tone={tone} />
      </header>

      <div className={styles.roster} aria-label="Starting lineup">
        {LINEUP_SLOTS.map((slot) => (
          <RosterSlot
            key={slot}
            slot={slot}
            player={state.starters[slot]}
            active={slot === state.activeSlot}
            pending={
              slot === state.activeSlot && flipped && state.currentOffer !== null
            }
            pendingPlayer={slot === state.activeSlot ? state.currentOffer : null}
          />
        ))}
      </div>

      {draftComplete ? (
        <p className={joinClasses(styles.forcedBanner, overCap && styles.overCapBanner)} role="status">
          {overCap
            ? `Over cap by ${formatCapSpend(overCapAmount, era.id)} — −${overCapPenalty} rating in Game 7.`
            : 'Under the cap. No luxury-tax penalty.'}
        </p>
      ) : null}

      {!draftComplete && state.forcedSign ? (
        <p className={styles.forcedBanner} role="status">
          No more offers for {state.activeSlot} — sign this card to continue.
        </p>
      ) : null}

      {!draftComplete && !state.forcedSign && canHit(state) && nextHitCost > 0 ? (
        <p className={styles.forcedBanner} role="status">
          Next hit costs {formatCapSpend(nextHitCost, era.id)} in cap space.
        </p>
      ) : null}

      <div className={joinClasses(styles.cardArea, hardBlindCard && styles.cardAreaCompact)}>
        {draftComplete ? (
          <p className={styles.completeMessage}>Your starting five is set. Review the cap, then tip off.</p>
        ) : state.currentOffer ? (
          <DraftCard
            player={state.currentOffer}
            salaryRevealed={state.salaryRevealed}
            era={era}
            difficulty={difficulty}
            activeSlot={state.activeSlot}
          />
        ) : (
          <p className={styles.completeMessage}>Locking in your five…</p>
        )}
      </div>

      {!draftComplete && flipped && state.currentOffer ? (
        <p className={styles.projectedSpend} role="status">
          Projected spend if signed: {projectedSpend.toLocaleString()} / {era.cap.toLocaleString()}
        </p>
      ) : null}

      <div className={draftComplete || flipped ? styles.actionsSingle : styles.actions}>
        {draftComplete ? (
          <Button variant="primary" fullWidth onClick={onStartSim}>
            Start Game 7
          </Button>
        ) : !flipped ? (
          <>
            <Button variant="danger" fullWidth disabled={!canHit(state)} onClick={onHit}>
              Hit
            </Button>
            <Button variant="success" fullWidth disabled={!canFlip(state)} onClick={onSign}>
              Sign
            </Button>
          </>
        ) : (
          <Button variant="primary" fullWidth disabled={!canAdvance(state)} onClick={onNextPosition}>
            Next Position
          </Button>
        )}
      </div>
    </section>
  )
}

function RosterSlot({
  slot,
  player,
  active,
  pending,
  pendingPlayer,
}: {
  slot: LineupSlot
  player: import('../schemas/player').Player | undefined
  active: boolean
  pending: boolean
  pendingPlayer: import('../schemas/player').Player | null
}) {
  const displayPlayer = player ?? (pending ? pendingPlayer : null)

  return (
    <div className={joinClasses(styles.rosterSlot, active && styles.rosterSlotActive)}>
      <span className={styles.rosterSlotLabel}>{slot}</span>
      {displayPlayer ? (
        <>
          <span className={styles.rosterSlotName}>{displayPlayer.player}</span>
          <span className={styles.rosterSlotMeta}>
            {displayPlayer.year} · {displayPlayer.rating}
          </span>
        </>
      ) : (
        <span className={styles.rosterSlotEmpty}>{active ? 'Drafting…' : '—'}</span>
      )}
    </div>
  )
}
