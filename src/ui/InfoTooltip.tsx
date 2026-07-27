import type { ReactNode } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import styles from './InfoTooltip.module.css'

export interface InfoTooltipProps {
  content: string
  label?: string | undefined
}

function joinClasses(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function InfoTooltip({ content, label = 'More information' }: InfoTooltipProps): ReactNode {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-label={label}
          className={(state) =>
            joinClasses(styles.trigger, state.open ? styles.triggerOpen : undefined)
          }
        >
          ?
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner className={styles.positioner} sideOffset={8}>
            <Tooltip.Popup className={styles.popup}>
              <Tooltip.Arrow className={styles.arrow} />
              {content}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
