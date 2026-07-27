import { useEffect, useMemo, useState } from 'react'
import { getEraConfig } from '../data/eras'
import { AnalyticsEvent, trackButtonClick } from '../lib/analytics'
import { getEraChallengeRecord } from '../lib/challengeProgress'
import { Button, IconToggle, RulesDialog, SegmentedControl } from '../ui'
import type { EraConfig, EraId } from '../types/game'
import { DRAFT_OFFERS_PER_SLOT } from '../types/game'
import styles from './StartScreen.module.css'

export interface StartScreenProps {
  eras: readonly EraConfig[]
  onStartChallenge: (era: EraId) => void
  muted: boolean
  onToggleMute: () => void
  defaultEra?: EraId
}

function formatEraStatus(eraId: EraId): string {
  const record = getEraChallengeRecord(eraId)
  if (record.totalClears > 0 && record.bestClearAttempts !== null) {
    return ` · Cleared in ${record.bestClearAttempts}`
  }
  if (record.attemptsSinceClear > 0) {
    return ` · Attempt ${record.attemptsSinceClear}`
  }
  return ''
}

export function StartScreen({
  eras,
  onStartChallenge,
  muted,
  onToggleMute,
  defaultEra,
}: StartScreenProps) {
  const [selectedEra, setSelectedEra] = useState<EraId>(
    defaultEra ?? eras[0]?.id ?? '2000s',
  )
  const eraConfig = getEraConfig(selectedEra)
  const eraRecord = useMemo(() => getEraChallengeRecord(selectedEra), [selectedEra])

  useEffect(() => {
    if (defaultEra) {
      setSelectedEra(defaultEra)
    }
  }, [defaultEra])

  const handleEraChange = (value: EraId) => {
    setSelectedEra(value)
    trackButtonClick(AnalyticsEvent.SELECT_ERA, { era: value })
  }

  return (
    <div className={styles.layout}>
      <section className={styles.root} aria-label="Start screen">
        <div className={styles.brand}>
          <h1 className={styles.title}>Cap God</h1>
          <p className={styles.tagline}>Game 7 Moneyball</p>
        </div>

        <div className={styles.toolbar}>
          <RulesDialog triggerLabel="Rules" title="How to Play">
            <ul className={styles.rulesList}>
              <li>
                Pick an era, draw one random NBA champion, draft your starting five, and win Game 7
                to clear the challenge.
              </li>
              <li>
                Draft in five rounds: PG → SG → SF → PF → C. Each position starts with{' '}
                {DRAFT_OFFERS_PER_SLOT} hidden-contract offers.
              </li>
              <li>
                Hit to discard the current card, Sign to flip the contract, then Next Position to
                lock the player in. After {DRAFT_OFFERS_PER_SLOT} free hits per position, extra hits
                cost cap space ($2M in the 2000s, $3M in the 2010s, $5M in the 2020s).
              </li>
              <li>
                Go over the cap for a soft bust (−20 rating, plus more the further you exceed it).
                Exact score ties are a push — try again with a fresh draft and a new opponent.
              </li>
            </ul>
          </RulesDialog>
          <IconToggle
            pressed={muted}
            onPressedChange={() => {
              trackButtonClick(AnalyticsEvent.CLICK_MUTE_TOGGLE, { muted: !muted })
              onToggleMute()
            }}
            label={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? '🔇' : '🔊'}
          </IconToggle>
        </div>

        <div className={styles.intro}>
          <p className={styles.kicker}>Choose Your Era</p>
          <p className={styles.description}>{eraConfig.description}</p>
          <p className={styles.description}>
            Beat one randomly drawn champion in Game 7 to clear the era. Lose or tie and you start
            over with a new draft and opponent.
          </p>
        </div>

        <SegmentedControl
          value={selectedEra}
          options={eras.map((era) => ({
            value: era.id,
            label: `${era.label}${formatEraStatus(era.id)}`,
          }))}
          onValueChange={handleEraChange}
          ariaLabel="Select era"
        />

        {eraRecord.totalClears > 0 ? (
          <p className={styles.resumeHint}>
            Cleared {eraRecord.totalClears} time{eraRecord.totalClears === 1 ? '' : 's'}
            {eraRecord.bestClearAttempts !== null
              ? ` · Best: ${eraRecord.bestClearAttempts} attempts`
              : ''}
          </p>
        ) : eraRecord.attemptsSinceClear > 0 ? (
          <p className={styles.resumeHint}>
            In progress — attempt {eraRecord.attemptsSinceClear} since your last clear.
          </p>
        ) : null}

        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={() => {
            trackButtonClick(AnalyticsEvent.CLICK_ENTER_DRAFT, {
              era: selectedEra,
            })
            onStartChallenge(selectedEra)
          }}
        >
          Start Challenge
        </Button>
      </section>
    </div>
  )
}
