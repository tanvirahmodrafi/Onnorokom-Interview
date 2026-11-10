import * as React from "react"
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SchoolClass } from "@/lib/api"
import {
  type Applicant,
  type ApplicantDraft,
  type ApplicantErrors,
  validateApplicant,
} from "@/lib/applicant"
import { useT } from "@/lib/i18n"

type Props = {
  /** The class being applied for; null keeps the dialog closed. */
  schoolClass: SchoolClass | null
  studentId: string
  /** Pre-fills the form, e.g. from the student's last application. */
  initial?: Partial<Applicant>
  busy: boolean
  onCancel: () => void
  onSubmit: (applicant: Applicant) => void
}

/** The application form: the student's name and a contact number, then the seat is held. */
export function ApplyDialog({ schoolClass, studentId, initial, busy, onCancel, onSubmit }: Props) {
  return (
    <ModalOverlay
      isOpen={schoolClass !== null}
      onOpenChange={(open) => !open && !busy && onCancel()}
      isDismissable={!busy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <Modal className="w-full max-w-md rounded-3xl border bg-card p-5 text-card-foreground shadow-xl">
        <Dialog className="outline-none">
          {schoolClass && (
            // Keyed so the form starts fresh for each class.
            <ApplyForm
              key={schoolClass.id}
              schoolClass={schoolClass}
              studentId={studentId}
              initial={initial}
              busy={busy}
              onCancel={onCancel}
              onSubmit={onSubmit}
            />
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

function ApplyForm({
  schoolClass,
  studentId,
  initial,
  busy,
  onCancel,
  onSubmit,
}: Omit<Props, "schoolClass"> & { schoolClass: SchoolClass }) {
  const t = useT()
  const [draft, setDraft] = React.useState<ApplicantDraft>({
    studentName: initial?.studentName ?? "",
    contactNumber: initial?.contactNumber ?? "",
  })
  const [errors, setErrors] = React.useState<ApplicantErrors>({})
  const ids = { studentName: React.useId(), contactNumber: React.useId() }

  function change(field: keyof ApplicantDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = validateApplicant(draft)
    if (result.errors) setErrors(result.errors)
    else onSubmit(result.applicant)
  }

  const fields: {
    field: keyof ApplicantDraft
    label: string
    props: React.ComponentProps<typeof Input>
  }[] = [
    {
      field: "studentName",
      label: t.common.studentName,
      props: { autoComplete: "name", maxLength: 100 },
    },
    {
      field: "contactNumber",
      label: t.common.contactNumber,
      props: { inputMode: "tel", autoComplete: "tel", placeholder: "01712345678" },
    },
  ]

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-1">
        <Heading slot="title" className="text-base font-semibold">
          {t.apply.title(t.className(schoolClass.name))}
        </Heading>
        <p className="text-sm text-muted-foreground">
          {t.apply.forStudent} <span className="font-mono">{studentId}</span>. {t.apply.heldOnSubmit}
        </p>
      </div>

      {fields.map(({ field, label, props }) => (
        <div key={field} className="grid gap-1.5">
          <label htmlFor={ids[field]} className="text-sm font-medium">
            {label}
          </label>
          <Input
            id={ids[field]}
            value={draft[field]}
            onChange={(e) => change(field, e.target.value)}
            aria-invalid={errors[field] ? true : undefined}
            aria-describedby={errors[field] ? `${ids[field]}-error` : undefined}
            {...props}
          />
          {errors[field] && (
            <p id={`${ids[field]}-error`} className="text-sm text-destructive">
              {errors[field]}
            </p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="ghost" size="lg" isDisabled={busy} onPress={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" size="lg" isDisabled={busy}>
          {busy ? t.common.applying : "আবেদন জমা দিন"}
        </Button>
      </div>
    </form>
  )
}
