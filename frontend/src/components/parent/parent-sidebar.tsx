import { BadgeCheck, ClipboardList, School } from "lucide-react"
import { cn } from "cn"

import { ROUTE_HREF, type ParentScreen } from "@/hooks/use-view"
import { type Messages, useT } from "@/lib/i18n"

const ITEMS: { screen: ParentScreen; label: (t: Messages) => string; Icon: typeof School }[] = [
  { screen: "classes", label: (t) => t.parent.classList, Icon: School },
  { screen: "request", label: (t) => t.parent.admissionRequest, Icon: ClipboardList },
  { screen: "admissions", label: (t) => t.parent.myAdmission, Icon: BadgeCheck },
]

type Props = {
  screen: ParentScreen
  /** Small counters next to an item, e.g. how many requests are waiting for payment. */
  counts?: Partial<Record<ParentScreen, number>>
}

/** The parent side's menu: a column on the left on wide screens, a row of tabs on phones. */
export function ParentSidebar({ screen, counts = {} }: Props) {
  const t = useT()
  return (
    <nav aria-label={t.parent.menu}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {ITEMS.map(({ screen: item, label, Icon }) => {
          const active = item === screen
          const count = counts[item] ?? 0
          return (
            <li key={item} className="shrink-0">
              <a
                href={ROUTE_HREF[item]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{label(t)}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-muted text-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
