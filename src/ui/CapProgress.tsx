import { Progress } from '@base-ui/react/progress'
import styles from './CapProgress.module.css'

export type CapProgressTone = 'safe' | 'warn' | 'danger'

export interface CapProgressProps {
  value: number
  max: number
  label?: string | undefined
  valueText?: string | undefined
  tone?: CapProgressTone | undefined
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function toneClass(tone: CapProgressTone): string | undefined {
  if (tone === 'warn') {
    return styles.toneWarn
  }
  if (tone === 'danger') {
    return styles.toneDanger
  }
  return undefined
}

export function CapProgress({
  value,
  max,
  label,
  valueText,
  tone = 'safe',
}: CapProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), max)
  const displayValue = valueText ?? `${clampedValue} / ${max}`

  return (
    <Progress.Root
      className={joinClasses(styles.root, toneClass(tone))}
      value={clampedValue}
      max={max}
      aria-valuetext={displayValue}
    >
      <div className={styles.header}>
        {label ? <span className={styles.label}>{label}</span> : <span />}
        <Progress.Value className={styles.value}>
          {(formattedValue, currentValue) => {
            if (valueText) {
              return valueText
            }
            if (formattedValue !== null && currentValue !== null) {
              return `${formattedValue} / ${max}`
            }
            return displayValue
          }}
        </Progress.Value>
      </div>
      <Progress.Track className={styles.track}>
        <Progress.Indicator className={styles.indicator} />
      </Progress.Track>
    </Progress.Root>
  )
}
