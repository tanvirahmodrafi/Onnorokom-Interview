import { Badge } from "@/components/ui/badge"
import type { HoldStatus } from "@/lib/api"
import { cn } from "cn"

const STYLES: Record<HoldStatus, string> = {
  HELD: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  CONFIRMED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  EXPIRED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  REMOVED: "bg-destructive/10 text-destructive",
}

export function StatusBadge({ status }: { status: HoldStatus }) {
  return <Badge className={cn("font-mono tracking-wide", STYLES[status])}>{status}</Badge>
}
