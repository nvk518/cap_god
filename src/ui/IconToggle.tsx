import type { ReactNode } from 'react'
import { Toggle } from '@base-ui/react/toggle'
import styles from './IconToggle.module.css'

export interface IconToggleProps {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  label: string
  children: ReactNode
  disabled?: boolean | undefined
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function IconToggle({
  pressed,
  onPressedChange,
  label,
  children,
  disabled = false,
}: IconToggleProps) {
  return (
    <Toggle
      pressed={pressed}
      disabled={disabled}
      aria-label={label}
      onPressedChange={onPressedChange}
      className={(state) =>
        joinClasses(
          styles.toggle,
          state.pressed ? styles.togglePressed : undefined,
          state.disabled ? styles.toggleDisabled : undefined,
        )
      }
    >
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
      <span className={styles.srOnly}>{label}</span>
    </Toggle>
  )
}
