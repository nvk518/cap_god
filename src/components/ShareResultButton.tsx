import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import type { Player } from '../schemas/player'
import { deliverShareText, formatShareResult } from '../lib/shareResult'
import type { ChampionTeam, EraId, SimResult } from '../types/game'
import { Button } from '../ui/Button'
import styles from './ShareResultButton.module.css'

export interface ShareResultButtonProps {
  result: SimResult
  champion: ChampionTeam
  roster: readonly Player[]
  era: EraId
  capSpend: number
  capLimit: number
}

type ShareFeedback = 'shared' | 'copied' | null

export function ShareResultButton({
  result,
  champion,
  roster,
  era,
  capSpend,
  capLimit,
}: ShareResultButtonProps) {
  const [feedback, setFeedback] = useState<ShareFeedback>(null)
  const [error, setError] = useState<string | null>(null)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const clearResetTimer = (): void => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }

  const scheduleFeedbackReset = (): void => {
    clearResetTimer()
    resetTimerRef.current = window.setTimeout(() => {
      setFeedback(null)
      resetTimerRef.current = null
    }, 2000)
  }

  const handleShare = async (): Promise<void> => {
    clearResetTimer()
    setError(null)

    const text = formatShareResult({
      result,
      champion,
      roster,
      era,
      capSpend,
      capLimit,
    })

    try {
      const delivery = await deliverShareText(text)
      trackEvent('share_result', {
        era,
        outcome: result.outcome,
        method: delivery,
      })
      setFeedback(delivery)
      scheduleFeedbackReset()
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') {
        return
      }
      setFeedback(null)
      setError('Could not share result. Try again.')
    }
  }

  const statusMessage =
    feedback === 'shared'
      ? 'Shared!'
      : feedback === 'copied'
        ? 'Copied!'
        : error

  return (
    <div className={styles.root}>
      <Button variant="secondary" fullWidth onClick={() => void handleShare()}>
        Share Result
      </Button>
      <p className={styles.status} role="status" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  )
}
