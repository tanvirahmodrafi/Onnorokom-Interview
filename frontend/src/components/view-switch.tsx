import { ShieldCheck, Users } from "lucide-react"
import { cn } from "cn"

import { VIEW_HREF, type View } from "@/hooks/use-view"
import { type Messages, useT } from "@/lib/i18n"

const OPTIONS: { view: View; label: (t: Messages) => string; Icon: typeof Users }[] = [
  { view: "parent", label: (t) => t.app.parents, Icon: Users },
  { view: "admin", label: (t) => t.app.admin, Icon: ShieldCheck },
]

/** Top-right switch between the parent side and the school admin side. */
export function ViewSwitch({ view }: { view: View }) {
  const t = useT()
  return (
    <nav aria-label={t.app.switchView} className="flex rounded-2xl border bg-muted p-0.5">
      {OPTIONS.map(({ view: option, label, Icon }) => {
        const active = option === view
        return (
          <a
            key={option}
            href={VIEW_HREF[option]}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-[0.875rem] px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label(t)}
          </a>
        )
      })}
    </nav>
  )
}
