import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import styles from './RulesDialog.module.css'

export interface RulesDialogProps {
  triggerLabel: string
  title: string
  children: ReactNode
}

export function RulesDialog({ triggerLabel, title, children }: RulesDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={styles.trigger}>{triggerLabel}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Viewport className={styles.viewport}>
          <Dialog.Popup className={styles.popup}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Description className={styles.body} render={<div />}>
              {children}
            </Dialog.Description>
            <div className={styles.footer}>
              <Dialog.Close className={styles.close}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
