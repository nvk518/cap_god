import type { EraId, SessionRecord } from './types/game'
import { EraChampionSidebar } from './components/EraChampionSidebar'
import { EraCompleteScreen } from './components/EraCompleteScreen'
import { OpponentReveal } from './components/OpponentReveal'
import { DraftPhase } from './components/DraftPhase'
import { ResultScreen } from './components/ResultScreen'
import { RunProgressHeader } from './components/RunProgressHeader'
import { SimTicker } from './components/SimTicker'
import { StartScreen } from './components/StartScreen'
import { getEraConfig, SELECTABLE_ERAS } from './data/eras'
import { useGameState } from './hooks/useGameState'
import { getDraftCapSpend, getFinalStarters } from './lib/draft'
import { Button } from './ui/Button'

function GameplayLayout({
  eraId,
  defeatedIds,
  session,
  children,
}: {
  eraId: EraId
  defeatedIds: readonly string[]
  session: SessionRecord
  children: React.ReactNode
}) {
  return (
    <div className="gameLayout">
      <div className="gameLayout__main">
        <RunProgressHeader eraId={eraId} defeatedIds={defeatedIds} session={session} />
        {children}
      </div>
      <EraChampionSidebar eraId={eraId} defeatedIds={defeatedIds} compact />
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
      game.screen === 'eraComplete')

  return (
    <div className="app">
      {showNav ? (
        <header className="app__header">
          <div className="app__headerActions">
            <Button variant="ghost" size="sm" onClick={game.onPlayAgain}>
              Home
            </Button>
            {game.era !== null && game.screen !== 'result' && game.screen !== 'eraComplete' ? (
              <Button variant="ghost" size="sm" onClick={game.onNextHand}>
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
            <Button variant="primary" fullWidth onClick={game.onRetryLoad}>
              Retry
            </Button>
          </div>
        ) : null}

        {!game.loading && !game.error && game.screen === 'start' ? (
          <StartScreen
            eras={SELECTABLE_ERAS}
            onSelectEra={game.onSelectEra}
            onSelectDifficulty={game.onSelectDifficulty}
            muted={game.muted}
            onToggleMute={game.onToggleMute}
            defaultEra={game.lastEra}
            defaultDifficulty={game.lastDifficulty}
          />
        ) : null}

        {!game.loading && !game.error && showGameplayChrome && game.era ? (
          <GameplayLayout
            eraId={game.era}
            defeatedIds={game.defeatedChampionIds}
            session={game.session}
          >
            {game.screen === 'champion' && game.champion ? (
              <OpponentReveal
                champion={game.champion}
                era={game.era}
                onStartDraft={game.onStartDraft}
              />
            ) : null}

            {game.screen === 'draft' && game.draft ? (
              <DraftPhase
                state={game.draft}
                era={getEraConfig(game.era)}
                difficulty={game.difficulty}
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
                seed={game.seed}
                defeatedIds={game.defeatedChampionIds}
                badgeCounts={game.persistentProgress.badgeCounts}
                championAttempts={game.championAttempts}
                onNextHand={game.onNextHand}
                onPlayAgain={game.onPlayAgain}
              />
            ) : null}

            {game.screen === 'eraComplete' && game.simResult && game.champion ? (
              <EraCompleteScreen
                era={game.era}
                session={game.session}
                result={game.simResult}
                champion={game.champion}
                roster={simRoster}
                capSpend={simCapSpend}
                capLimit={simCapLimit}
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
