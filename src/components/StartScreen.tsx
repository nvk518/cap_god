import { useEffect, useMemo, useState } from 'react'
import { getEraConfig } from '../data/eras'
import { getEraProgressStats } from '../lib/eraProgress'
import { AnalyticsEvent, trackButtonClick } from '../lib/analytics'
import { loadSavedRun } from '../lib/savedRun'
import { Button, IconToggle, RulesDialog, SegmentedControl } from '../ui'
import type { Difficulty, EraConfig, EraId } from '../types/game'
import { DRAFT_OFFERS_PER_SLOT } from '../types/game'
import { EraChampionSidebar } from './EraChampionSidebar'
import styles from './StartScreen.module.css'

export interface StartScreenProps {
  eras: readonly EraConfig[]
  onSelectEra: (era: EraId) => void
  onSelectDifficulty: (difficulty: Difficulty) => void
  muted: boolean
  onToggleMute: () => void
  defaultEra?: EraId
  defaultDifficulty?: Difficulty
}

export function StartScreen({
  eras,
  onSelectEra,
  onSelectDifficulty,
  muted,
  onToggleMute,
  defaultEra,
  defaultDifficulty,
}: StartScreenProps) {
  const [selectedEra, setSelectedEra] = useState<EraId>(
    defaultEra ?? eras[0]?.id ?? '2000s',
  )
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty ?? 'normal')
  const eraConfig = getEraConfig(selectedEra)
  const eraProgress = useMemo(() => getEraProgressStats(selectedEra), [selectedEra])
  const savedRun = useMemo(() => loadSavedRun(), [])
  const canContinue =
    !eraProgress.complete &&
    (eraProgress.defeated > 0 || savedRun?.era === selectedEra)

  useEffect(() => {
    if (defaultEra) {
      setSelectedEra(defaultEra)
    }
  }, [defaultEra])

  useEffect(() => {
    if (defaultDifficulty) {
      setDifficulty(defaultDifficulty)
    }
  }, [defaultDifficulty])

  const handleDifficultyChange = (value: Difficulty) => {
    setDifficulty(value)
    trackButtonClick(AnalyticsEvent.SELECT_DIFFICULTY, { difficulty: value })
    onSelectDifficulty(value)
  }

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
                Face every NBA champion in your era, year by year — 2000 through 2009, 2010 through
                2019, or 2020 onward.
              </li>
              <li>
                Draft your starting five in five rounds: PG → SG → SF → PF → C. Each position starts
                with {DRAFT_OFFERS_PER_SLOT} hidden-contract offers.
              </li>
              <li>
                Hit to discard the current card, Sign to flip the contract, then Next Position to
                lock the player in. After {DRAFT_OFFERS_PER_SLOT} free hits per position, extra hits
                cost cap space ($2M in the 2000s, $3M in the 2010s, $5M in the 2020s).
              </li>
              <li>
                Go over the cap for a soft bust (−20 rating, plus more the further you exceed it).
                Exact score ties are a push.
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
        </div>

        <SegmentedControl
          value={selectedEra}
          options={eras.map((era) => {
            const progress = getEraProgressStats(era.id)
            const progressLabel =
              progress.defeated > 0 ? ` · ${progress.defeated}/${progress.total}` : ''
            return {
              value: era.id,
              label: `${era.label}${progressLabel}`,
            }
          })}
          onValueChange={handleEraChange}
          ariaLabel="Select era"
        />

        <SegmentedControl
          value={difficulty}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'hard', label: 'Hard' },
          ]}
          onValueChange={handleDifficultyChange}
          ariaLabel="Select difficulty"
        />

        {canContinue ? (
          <p className={styles.resumeHint}>
            {eraProgress.defeated > 0
              ? `${eraProgress.defeated}/${eraProgress.total} champions defeated — pick up where you left off.`
              : 'Resume your run in progress.'}
          </p>
        ) : null}

        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={() => {
            trackButtonClick(AnalyticsEvent.CLICK_ENTER_DRAFT, {
              era: selectedEra,
              difficulty,
              continue_run: canContinue,
            })
            onSelectEra(selectedEra)
          }}
        >
          {canContinue ? 'Continue Run' : 'Enter the Draft'}
        </Button>
      </section>

      <EraChampionSidebar key={selectedEra} eraId={selectedEra} />
    </div>
  )
}
