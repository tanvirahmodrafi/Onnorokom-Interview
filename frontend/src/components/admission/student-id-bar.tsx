import * as React from "react"
import { IdCard } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { STUDENT_ID_LENGTH, validateStudentId } from "@/lib/student-id"

type Props = {
  studentId: string
  onChange: (studentId: string) => void
}

/**
 * The student's identity: their birth registration number, kept across reloads. There is no
 * submit button: the number is used as soon as it has 17 digits, and dropped while it doesn't.
 */
export function StudentIdBar({ studentId, onChange }: Props) {
  const t = useT()
  const [draft, setDraft] = React.useState(studentId)
  const inputId = React.useId()
  const errorId = React.useId()

  const value = draft.trim()
  // While the parent is still typing a short number, the counter is enough; anything else is an error.
  const error =
    /\D/.test(value) || value.length > STUDENT_ID_LENGTH ? validateStudentId(value) : null

  function change(next: string) {
    setDraft(next)
    const valid = validateStudentId(next.trim()) === null ? next.trim() : ""
    if (valid !== studentId) onChange(valid)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-medium">
        <IdCard className="size-4" />
        {t.studentId.label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => change(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t.studentId.placeholder(STUDENT_ID_LENGTH)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-9 max-w-xs flex-1 font-mono tracking-wider"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.length}/{STUDENT_ID_LENGTH}
        </span>
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        !studentId && (
          <p className="text-sm text-muted-foreground">
            {t.studentId.hint(STUDENT_ID_LENGTH)}
          </p>
        )
      )}
    </div>
  )
}
