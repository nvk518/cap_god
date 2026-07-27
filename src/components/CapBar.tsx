import { CapProgress } from '../ui/CapProgress'
import type { CapProgressTone } from '../ui/CapProgress'
import { formatCapLimit, formatCapSpend } from '../lib/format'
import type { EraId } from '../types/game'
import styles from './CapBar.module.css'

export interface CapBarProps {
  spent: number
  limit: number
  eraId: EraId
  tone: CapProgressTone
}

export function CapBar({ spent, limit, eraId, tone }: CapBarProps) {
  const valueText = `${formatCapSpend(spent, eraId)} / ${formatCapLimit(limit, eraId)}`

  return (
    <div className={styles.root}>
      <CapProgress
        label="Salary Cap"
        value={spent}
        max={limit}
        valueText={valueText}
        tone={tone}
      />
    </div>
  )
}
