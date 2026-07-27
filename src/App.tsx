import type { EraId, SessionRecord } from './types/game'
import { ChallengeClearScreen } from './components/EraCompleteScreen'
import { OpponentReveal } from './components/OpponentReveal'
import { DraftPhase } from './components/DraftPhase'
import { ResultScreen } from './components/ResultScreen'
import { RunProgressHeader } from './components/RunProgressHeader'
import { SimTicker } from './components/SimTicker'
import { StartScreen } from './components/StartScreen'
import { getEraConfig, SELECTABLE_ERAS } from './data/eras'
import { useGameState } from './hooks/useGameState'
import { getDraftCapSpend, getFinalStarters } from './lib/draft'
import { AnalyticsEvent, trackButtonClick } from './lib/analytics'
import { Button } from './ui/Button'
import { CHALLENGE_DIFFICULTY } from './types/game'

function GameplayLayout({
  eraId,
  attemptNumber,
  session,
  children,
}: {
  eraId: EraId
  attemptNumber: number
  session: SessionRecord
  children: React.ReactNode
}) {
  return (
    <div className="gameLayout">
      <div className="gameLayout__main">
        <RunProgressHeader eraId={eraId} attemptNumber={attemptNumber} session={session} />
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const game = useGameState()
  const simRoster = game.draft ? getFinalStarters(game.draft) : []
  const simCapSpend =
    game.draft && game.era
      ? getDraftCapSpend(simRoster, game.era, game.draft.hitPenaltySpend)
      : 0
  const simCapLimit = game.era ? getEraConfig(game.era).cap : 0
  const showNav =
    !game.loading &&
    !game.error &&
    game.screen !== 'start'
  const showGameplayChrome =
    !game.loading &&
    !game.error &&
    game.era !== null &&
    (game.screen === 'champion' ||
      game.screen === 'draft' ||
      game.screen === 'sim' ||
      game.screen === 'result' ||
      game.screen === 'challengeClear')

  return (
    <div className="app">
      {showNav ? (
        <header className="app__header">
          <div className="app__headerActions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                trackButtonClick(AnalyticsEvent.CLICK_HOME, { era: game.era ?? undefined })
                game.onPlayAgain()
              }}
            >
              Home
            </Button>
            {game.era !== null && game.screen !== 'result' && game.screen !== 'challengeClear' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  trackButtonClick(AnalyticsEvent.CLICK_RESTART, {
                    era: game.era ?? undefined,
                    screen: game.screen,
                  })
                  game.onTryAgain()
                }}
              >
                Restart
              </Button>
            ) : null}
          </div>
        </header>
      ) : null}

      <main
        className={[
          'app__main',
          (game.screen === 'start' || showGameplayChrome) && 'app__main--wide',
          showGameplayChrome && 'app__main--gameplay',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {game.loading ? (
          <p className="app__placeholder" role="status">
            Loading player pool…
          </p>
        ) : null}

        {!game.loading && game.error ? (
          <div className="app__placeholder" role="alert">
            <p>{game.error}</p>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                trackButtonClick(AnalyticsEvent.CLICK_RETRY, { era: game.lastEra })
                game.onRetryLoad()
              }}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {!game.loading && !game.error && game.screen === 'start' ? (
          <StartScreen
            eras={SELECTABLE_ERAS}
            onStartChallenge={game.onStartChallenge}
            muted={game.muted}
            onToggleMute={game.onToggleMute}
            defaultEra={game.lastEra}
          />
        ) : null}

        {!game.loading && !game.error && showGameplayChrome && game.era ? (
          <GameplayLayout
            eraId={game.era}
            attemptNumber={game.attemptNumber}
            session={game.session}
          >
            {game.screen === 'champion' && game.champion ? (
              <OpponentReveal
                champion={game.champion}
                era={game.era}
                attemptNumber={game.attemptNumber}
                onStartDraft={game.onStartDraft}
              />
            ) : null}

            {game.screen === 'draft' && game.draft ? (
              <DraftPhase
                state={game.draft}
                era={getEraConfig(game.era)}
                difficulty={CHALLENGE_DIFFICULTY}
                onSign={game.onSign}
                onNextPosition={game.onNextPosition}
                onStartSim={game.onStartSim}
                onHit={game.onHit}
                muted={game.muted}
              />
            ) : null}

            {game.screen === 'sim' && game.simResult && game.champion ? (
              <SimTicker
                result={game.simResult}
                champion={game.champion}
                roster={simRoster}
                onComplete={game.onSimComplete}
              />
            ) : null}

            {game.screen === 'result' && game.simResult && game.champion ? (
              <ResultScreen
                result={game.simResult}
                champion={game.champion}
                badges={game.badges}
                era={game.era}
                session={game.session}
                roster={simRoster}
                capSpend={simCapSpend}
                capLimit={simCapLimit}
                attemptNumber={game.attemptNumber}
                badgeCounts={game.persistentProgress.badgeCounts}
                onTryAgain={game.onTryAgain}
                onPlayAgain={game.onPlayAgain}
              />
            ) : null}

            {game.screen === 'challengeClear' &&
            game.simResult &&
            game.champion &&
            game.clearAttempts !== null ? (
              <ChallengeClearScreen
                era={game.era}
                session={game.session}
                result={game.simResult}
                champion={game.champion}
                roster={simRoster}
                capSpend={simCapSpend}
                capLimit={simCapLimit}
                clearAttempts={game.clearAttempts}
                clearIsBest={game.clearIsBest}
                badgesEarned={game.badges}
                badgeCounts={game.persistentProgress.badgeCounts}
                onRunItBack={game.onRunItBack}
                onChangeEra={game.onPlayAgain}
              />
            ) : null}
          </GameplayLayout>
        ) : null}
      </main>
    </div>
  )
}
