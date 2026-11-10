import { messages } from "@/lib/i18n"

export const STUDENT_ID_LENGTH = 17
const STORAGE_KEY = "school-admission.student-id"

/** Returns a user-facing problem with the value, or null when it is a valid 17-digit number. */
export function validateStudentId(value: string): string | null {
  const t = messages().studentId
  if (value.length === 0) return t.empty
  if (!/^\d+$/.test(value)) return t.digitsOnly
  if (value.length !== STUDENT_ID_LENGTH) return t.length(STUDENT_ID_LENGTH, value.length)
  return null
}

// Storage can be unavailable (private mode, blocked site data); the app still works without it.
export function loadStudentId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? ""
    return validateStudentId(stored) === null ? stored : ""
  } catch {
    return ""
  }
}

export function saveStudentId(value: string) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not persisted; the number still works for this session.
  }
}
