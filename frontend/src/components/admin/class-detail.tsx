import * as React from "react"
import { ArrowLeft, Trash2, UserMinus } from "lucide-react"

import { StatusBadge } from "@/components/admission/status-badge"
import { useNotify } from "@/components/notices"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useNow, usePolling } from "@/hooks/use-polling"
import { api, type Hold, type SchoolClass, toApiError } from "@/lib/api"
import { displayStatus, formatCountdown, msLeft } from "@/lib/hold"
import { useT } from "@/lib/i18n"

const STUDENTS_POLL_MS = 3000

type Props = {
  schoolClass: SchoolClass
  onBack: () => void
  /** Called after a student is removed, so the seat counts refresh. */
  onChanged: () => void
  onDeleted: () => void
}

/** Everything about one class: seat totals, the students in it, and remove / delete actions. */
export function ClassDetail({ schoolClass: c, onBack, onChanged, onDeleted }: Props) {
  const t = useT()
  const name = t.className(c.name)
  const notify = useNotify()
  const now = useNow()
  const [removing, setRemoving] = React.useState<Hold | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const fetchStudents = React.useMemo(() => () => api.classStudents(c.id), [c.id])
  const students = usePolling(fetchStudents, STUDENTS_POLL_MS)
  // A hold whose timer ran out is no longer in the class, even before the next poll.
  const inClass = (students.data ?? []).filter((h) => {
    const status = displayStatus(h, now)
    return status === "HELD" || status === "CONFIRMED"
  })

  async function removeStudent(hold: Hold) {
    setBusy(true)
    try {
      await api.removeStudent(c.id, hold.studentId)
      notify("success", t.classDetail.removed(hold.studentId, name))
      setRemoving(null)
    } catch (e) {
      notify("error", toApiError(e).message)
    } finally {
      setBusy(false)
      void students.refresh()
      onChanged()
    }
  }

  async function deleteClass() {
    setBusy(true)
    try {
      await api.deleteClass(c.id)
      notify("success", t.classDetail.deleted(name))
      setDeleteOpen(false)
      onDeleted()
    } catch (e) {
      notify("error", toApiError(e).message)
      setBusy(false)
    }
  }

  const stats = [
    { label: t.common.held, value: c.heldSeats, tone: "text-amber-700 dark:text-amber-400" },
    { label: t.common.confirmed, value: c.confirmedSeats, tone: "text-emerald-700 dark:text-emerald-400" },
    { label: t.common.available, value: c.availableSeats, tone: "" },
  ]

  return (
    <section aria-labelledby="class-detail-heading" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft /> {t.classDetail.allClasses}
        </Button>
        <Button variant="destructive" onPress={() => setDeleteOpen(true)}>
          <Trash2 /> {t.classDetail.deleteClass}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="class-detail-heading">{name}</h2>
          </CardTitle>
          <CardDescription>{t.classDetail.capacity(c.totalSeats)}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className={`text-3xl font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.classDetail.students}</CardTitle>
          <CardDescription>{t.classDetail.studentsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {students.error && (
            <Alert variant="destructive">
              <AlertDescription>{students.error.message}</AlertDescription>
            </Alert>
          )}
          {students.loading && !students.data && (
            <p className="text-sm text-muted-foreground">{t.classDetail.loadingStudents}</p>
          )}
          {students.data && inClass.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.classDetail.noStudents}</p>
          )}
          {inClass.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">{t.classDetail.student}</th>
                    <th className="px-2 py-2 font-medium">{t.classDetail.contact}</th>
                    <th className="px-2 py-2 font-medium">{t.common.status}</th>
                    <th className="px-2 py-2 font-medium">{t.classDetail.applied}</th>
                    <th className="py-2 pl-3" />
                  </tr>
                </thead>
                <tbody>
                  {inClass.map((hold) => {
                    const status = displayStatus(hold, now)
                    return (
                      <tr key={hold.holdId} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{hold.studentName}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {hold.studentId}
                          </div>
                        </td>
                        <td className="px-2 whitespace-nowrap">
                          <a
                            className="underline-offset-4 hover:underline"
                            href={`tel:${hold.contactNumber}`}
                          >
                            {hold.contactNumber}
                          </a>
                        </td>
                        <td className="px-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={status} />
                            {status === "HELD" && (
                              <span className="font-mono text-xs tabular-nums">
                                {formatCountdown(msLeft(hold, now))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(hold.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={t.classDetail.removeLabel(hold.studentId)}
                            onPress={() => setRemoving(hold)}
                          >
                            <UserMinus /> {t.classDetail.remove}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t.classDetail.removeTitle}
        confirmLabel={busy ? t.classDetail.removing : t.classDetail.yesRemove}
        cancelLabel={t.common.keepIt}
        busy={busy}
        onConfirm={() => removing && void removeStudent(removing)}
      >
        <p>
          {removing &&
            t.classDetail.removeBody(removing.studentName, name, removing.status === "CONFIRMED")}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.classDetail.deleteTitle(name)}
        confirmLabel={busy ? t.classDetail.deleting : t.classDetail.yesDelete}
        cancelLabel={t.common.keepIt}
        busy={busy}
        onConfirm={() => void deleteClass()}
      >
        <p>{t.classDetail.deleteBody}</p>
        {c.heldSeats + c.confirmedSeats > 0 && (
          <p className="font-medium text-destructive">
            {t.classDetail.loseSeats(c.heldSeats, c.confirmedSeats)}
          </p>
        )}
      </ConfirmDialog>
    </section>
  )
}
