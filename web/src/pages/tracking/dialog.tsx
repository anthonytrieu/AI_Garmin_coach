import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** Native modal focus containment, Escape handling, and focus restoration. */
export function TrackingDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => { document.body.style.overflow = overflow; dialog.close(); previous?.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="exercise-dialog" aria-label={title} onCancel={onClose}>{children}</dialog>
}
