import * as React from "react"
import { Clock } from "lucide-react"

import { useNotify } from "@/components/notices"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/admission/status-badge"
import { useNow, usePolling } from "@/hooks/use-polling"
import { api, type Hold, toApiError } from "@/lib/api"
import { displayStatus, formatCountdown, msLeft } from "@/lib/hold"
import { useT } from "@/lib/i18n"

type Props = {
  hold: Hold | undefined
  studentId: string
  onChanged: () => void
}

/** One application: live status, countdown, and the pay / cancel actions. */
export function ApplicationPanel({ hold: listed, studentId, onChanged }: Props) {
  const t = useT()
  const notify = useNotify()
  const now = useNow()
  const [busy, setBusy] = React.useState<"pay" | "cancel" | null>(null)
  const [confirmingCancelFor, setConfirmingCancelFor] = React.useState<string | null>(null)

  const holdId = listed?.holdId
  const fetchHold = React.useMemo(() => (holdId ? () => api.getHold(holdId) : null), [holdId])
  const { data: fresh, refresh } = usePolling(fetchHold, 3000)
  const hold = fresh?.holdId === holdId ? fresh : listed

  const status = hold ? displayStatus(hold, now) : undefined
  const expiredLocally = hold?.status === "HELD" && status === "EXPIRED"

  // When the timer reaches zero, ask the server straight away so the stored status catches up.
  React.useEffect(() => {
    if (expiredLocally) {
      void refresh()
      onChanged()
    }
  }, [expiredLocally, refresh, onChanged])

  if (!hold || !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.application.title}</CardTitle>
          <CardDescription>{t.application.empty}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const current = hold
  const confirmingCancel = confirmingCancelFor === current.holdId
  const left = msLeft(current, now)
  const className = t.className(current.className)
  const canPay = status === "HELD" && busy === null
  // A paid admission can be withdrawn too; it frees the seat so the student can apply elsewhere.
  const canCancel = (status === "HELD" || status === "CONFIRMED") && busy === null

  async function pay() {
    setBusy("pay")
    try {
      await api.payFee(current.holdId, studentId)
      notify("success", t.application.paid(className))
    } catch (e) {
      notify("error", toApiError(e).message)
    } finally {
      setBusy(null)
      void refresh()
      onChanged()
    }
  }

  async function cancel() {
    setBusy("cancel")
    setConfirmingCancelFor(null)
    try {
      await api.cancel(current.holdId, studentId)
      notify(
        "success",
        status === "CONFIRMED"
          ? t.application.admissionCancelled(className)
          : t.application.applicationCancelled(className)
      )
    } catch (e) {
      notify("error", toApiError(e).message)
    } finally {
      setBusy(null)
      void refresh()
      onChanged()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.application.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label={t.common.class}>{className}</Detail>
          <Detail label={t.common.status}>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              {status !== "CONFIRMED" && (
                <span className="text-muted-foreground">{t.status[status]}</span>
              )}
            </span>
          </Detail>
          <Detail label={t.common.studentName}>{current.studentName}</Detail>
          <Detail label={t.common.contactNumber}>{current.contactNumber}</Detail>
          {status === "CONFIRMED" && current.confirmedAt && (
            <Detail label={t.application.feePaid}>{new Date(current.confirmedAt).toLocaleString()}</Detail>
          )}
        </dl>

        {status === "HELD" && (
          <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3">
            <Clock className="size-5 text-amber-600" />
            <div>
              <div className="font-mono text-2xl font-semibold tabular-nums" aria-live="off">
                {formatCountdown(left)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.application.timeLeft(new Date(current.expiresAt).toLocaleTimeString())}
              </div>
            </div>
          </div>
        )}

        {confirmingCancel && status === "CONFIRMED" && (
          <p className="text-sm text-destructive" role="alert">
            {t.application.paidWarning}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="lg" isDisabled={!canPay} onPress={pay}>
            {busy === "pay" ? t.application.paying : "ভর্তি ফি দিন"}
          </Button>
          {confirmingCancel ? (
            <>
              <Button size="lg" variant="destructive" isDisabled={!canCancel} onPress={cancel}>
                {t.application.yesCancel}
              </Button>
              <Button size="lg" variant="ghost" onPress={() => setConfirmingCancelFor(null)}>
                {status === "CONFIRMED" ? t.application.keepAdmission : t.application.keepApplication}
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              variant="outline"
              isDisabled={!canCancel}
              onPress={() => setConfirmingCancelFor(current.holdId)}
            >
              {busy === "cancel" ? t.application.cancelling : "বাতিল"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
