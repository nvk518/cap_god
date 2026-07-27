import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  fullWidth?: boolean | undefined
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        styles.button,
        styles[variant],
        size !== 'md' ? styles[size] : undefined,
        fullWidth ? styles.fullWidth : undefined,
        className,
      )}
      {...props}
    />
  )
}
