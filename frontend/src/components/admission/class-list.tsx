import { Info, WifiOff } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ApiError, Hold, SchoolClass } from "@/lib/api"
import { sortClasses } from "@/lib/class-name"
import { useT } from "@/lib/i18n"

type Props = {
  classes: SchoolClass[] | undefined
  error: ApiError | null
  loading: boolean
  myActiveHolds: Hold[]
  applyingClassId: string | null
  onApply: (schoolClass: SchoolClass) => void
}

export function ClassList({ classes, error, loading, myActiveHolds, applyingClassId, onApply }: Props) {
  const t = useT()
  // A student can be in one class only, so a live application anywhere blocks the others.
  const lockedIn = myActiveHolds[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.classList.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error && (
          <Alert variant="destructive">
            <WifiOff />
            <AlertTitle>{t.common.couldNotLoadClasses}</AlertTitle>
            <AlertDescription>
              {error.message}
              {classes && t.common.mayBeOutOfDate}
            </AlertDescription>
          </Alert>
        )}

        {lockedIn && (
          <Alert>
            <Info />
            <AlertTitle>{t.classList.oneClassTitle}</AlertTitle>
            <AlertDescription>
              {t.classList.oneClass(lockedIn.status === "CONFIRMED", t.className(lockedIn.className))}
            </AlertDescription>
          </Alert>
        )}

        {loading && !classes && <p className="text-sm text-muted-foreground">{t.common.loadingClasses}</p>}

        {classes?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t.classList.noClasses}
          </p>
        )}

        {classes && classes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">{t.common.class}</th>
                  <th className="px-2 py-2 text-right font-medium">{t.classList.total}</th>
                  <th className="px-2 py-2 text-right font-medium">{t.common.held}</th>
                  <th className="px-2 py-2 text-right font-medium">{t.common.confirmed}</th>
                  <th className="px-2 py-2 text-right font-medium">{t.common.available}</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {sortClasses(classes).map((c) => {
                  const mine = myActiveHolds.find((h) => h.classId === c.id)
                  const full = c.availableSeats <= 0
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{t.className(c.name)}</td>
                      <td className="px-2 text-right tabular-nums">{c.totalSeats}</td>
                      <td className="px-2 text-right tabular-nums">{c.heldSeats}</td>
                      <td className="px-2 text-right tabular-nums">{c.confirmedSeats}</td>
                      <td
                        className={`px-2 text-right font-semibold tabular-nums ${full ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}
                      >
                        {c.availableSeats}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        {mine ? (
                          <span className="text-xs text-muted-foreground">
                            {mine.status === "CONFIRMED" ? t.classList.admitted : t.classList.applied}
                          </span>
                        ) : lockedIn ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Button
                            size="sm"
                            isDisabled={applyingClassId !== null}
                            variant={full ? "outline" : "default"}
                            onPress={() => onApply(c)}
                          >
                            {applyingClassId === c.id ? t.common.applying : "আবেদন করুন"}
                          </Button>
                        )}
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
  )
}
