import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import styles from './SegmentedControl.module.css'

export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
  disabled?: boolean | undefined
}

export interface SegmentedControlProps<T extends string> {
  value: T
  options: readonly SegmentedControlOption<T>[]
  onValueChange: (value: T) => void
  disabled?: boolean | undefined
  ariaLabel: string
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  disabled = false,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      className={styles.group}
      value={[value]}
      disabled={disabled}
      onValueChange={(next) => {
        const selected = next[0]
        if (selected) {
          onValueChange(selected as T)
        }
      }}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={disabled || option.disabled}
          className={(state) =>
            joinClasses(
              styles.item,
              state.pressed ? styles.itemPressed : undefined,
              state.disabled ? styles.itemDisabled : undefined,
            )
          }
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
