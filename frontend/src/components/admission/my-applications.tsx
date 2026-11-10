import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { StatusBadge } from "@/components/admission/status-badge"
import { useNow } from "@/hooks/use-polling"
import type { ApiError, Hold } from "@/lib/api"
import { displayStatus, formatCountdown, msLeft } from "@/lib/hold"
import { useT } from "@/lib/i18n"
import { cn } from "cn"

type Props = {
  hasStudent: boolean
  holds: Hold[] | undefined
  error: ApiError | null
  loading: boolean
  selectedHoldId: string | null
  onSelect: (holdId: string) => void
}

export function MyApplications({ hasStudent, holds, error, loading, selectedHoldId, onSelect }: Props) {
  const t = useT()
  const now = useNow()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.myApplications.title}</CardTitle>
        {!hasStudent && (
          <CardDescription>{t.myApplications.enterNumber}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="grid gap-2">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {hasStudent && loading && !holds && (
          <p className="text-sm text-muted-foreground">{t.myApplications.loading}</p>
        )}
        {holds?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.myApplications.none}</p>
        )}
        {holds?.map((hold) => {
          const status = displayStatus(hold, now)
          const selected = hold.holdId === selectedHoldId
          return (
            <button
              key={hold.holdId}
              type="button"
              onClick={() => onSelect(hold.holdId)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border p-3 text-left text-sm transition-colors hover:bg-muted",
                selected && "border-ring bg-muted"
              )}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{t.className(hold.className)}</div>
                <div className="text-xs text-muted-foreground">
                  {t.myApplications.applied(new Date(hold.createdAt).toLocaleString())}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {status === "HELD" && (
                  <span className="font-mono text-xs tabular-nums">
                    {formatCountdown(msLeft(hold, now))}
                  </span>
                )}
                <StatusBadge status={status} />
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
