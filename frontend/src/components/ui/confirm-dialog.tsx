import type * as React from "react"
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components"

import { Button } from "@/components/ui/button"

type Props = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  title: string
  children: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
}

/** A modal "are you sure?" pop-up for destructive actions. Focus is trapped; Escape closes it. */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel = "No, keep it",
  busy = false,
  onConfirm,
}: Props) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isKeyboardDismissDisabled={busy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <Modal className="w-full max-w-md rounded-3xl border bg-card p-5 text-card-foreground shadow-xl">
        <Dialog role="alertdialog" className="grid gap-3 outline-none">
          <Heading slot="title" className="text-base font-semibold">
            {title}
          </Heading>
          <div className="grid gap-2 text-sm text-muted-foreground">{children}</div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="ghost" size="lg" isDisabled={busy} onPress={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button variant="destructive" size="lg" isDisabled={busy} onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
