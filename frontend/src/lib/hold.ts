import type { Hold, HoldStatus } from "@/lib/api"

/** A HELD application whose timer has run out is shown as EXPIRED right away, before the server says so. */
export function displayStatus(hold: Hold, now: number): HoldStatus {
  return hold.status === "HELD" && now >= Date.parse(hold.expiresAt) ? "EXPIRED" : hold.status
}

export function msLeft(hold: Hold, now: number): number {
  return Math.max(0, Date.parse(hold.expiresAt) - now)
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}
