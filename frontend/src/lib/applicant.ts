import { messages } from "@/lib/i18n"

/** Details a parent gives when applying. Mirrors the backend's checks in AdmissionService. */
export interface Applicant {
  studentName: string
  contactNumber: string
}

export const MAX_NAME_LENGTH = 100

export type ApplicantDraft = { studentName: string; contactNumber: string }
export type ApplicantErrors = Partial<Record<keyof ApplicantDraft, string>>

/** Spaces and dashes are allowed while typing, e.g. "017-1234 5678". */
export function normalizeContact(value: string): string {
  return value.replace(/[\s-]/g, "")
}

/** Returns the cleaned details, or a message per field that needs fixing. */
export function validateApplicant(
  draft: ApplicantDraft
):
  | { applicant: Applicant; errors?: undefined }
  | { applicant?: undefined; errors: ApplicantErrors } {
  const errors: ApplicantErrors = {}
  const studentName = draft.studentName.trim()
  if (!studentName) errors.studentName = messages().apply.nameRequired
  else if (studentName.length > MAX_NAME_LENGTH)
    errors.studentName = messages().apply.nameTooLong(MAX_NAME_LENGTH)

  const contactNumber = normalizeContact(draft.contactNumber)
  if (!/^\+?\d{10,15}$/.test(contactNumber))
    errors.contactNumber = messages().apply.contactInvalid

  if (Object.keys(errors).length > 0) return { errors }
  return { applicant: { studentName, contactNumber } }
}
