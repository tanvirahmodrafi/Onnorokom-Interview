import { WifiOff } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { ApiError, SchoolClass } from "@/lib/api"
import { sortClasses } from "@/lib/class-name"
import { useT } from "@/lib/i18n"

type Props = {
  classes: SchoolClass[] | undefined
  error: ApiError | null
  loading: boolean
  onOpen: (classId: string) => void
}

/** One box per class, three to a row, Class 1 to 10. Tapping a box opens its details. */
export function ClassGrid({ classes, error, loading, onOpen }: Props) {
  const t = useT()
  return (
    <section aria-labelledby="classes-heading" className="grid gap-3">
      <h2 id="classes-heading" className="text-base font-semibold">
        {t.classList.title}
      </h2>

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
      {loading && !classes && <p className="text-sm text-muted-foreground">{t.common.loadingClasses}</p>}
      {classes?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t.classGrid.noClasses}
        </p>
      )}

      {classes && classes.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortClasses(classes).map((c) => (
            <li key={c.id}>
              <ClassBox schoolClass={c} onOpen={() => onOpen(c.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ClassBox({ schoolClass: c, onOpen }: { schoolClass: SchoolClass; onOpen: () => void }) {
  const t = useT()
  const filled = c.totalSeats > 0 ? (c.confirmedSeats + c.heldSeats) / c.totalSeats : 0
  const stats = [
    { label: t.classGrid.capacity, value: c.totalSeats, tone: "" },
    { label: t.common.confirmed, value: c.confirmedSeats, tone: "text-emerald-700 dark:text-emerald-400" },
    { label: t.common.held, value: c.heldSeats, tone: "text-amber-700 dark:text-amber-400" },
  ]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid h-full w-full gap-3 rounded-3xl border bg-card p-4 text-left shadow-sm transition-colors outline-none hover:border-ring hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <span className="font-semibold">{t.className(c.name)}</span>
      <dl className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className={`text-xl font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, filled * 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {t.classGrid.footer(c.availableSeats)}
      </span>
    </button>
  )
}
