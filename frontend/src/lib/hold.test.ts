import { describe, expect, it } from "vitest"

import type { Hold } from "@/lib/api"
import { displayStatus, formatCountdown } from "@/lib/hold"

const hold = (status: Hold["status"], expiresAt: string): Hold => ({
  holdId: "h1",
  classId: "c1",
  className: "Class 6",
  studentId: "20152691234567890",
  status,
  expiresAt,
  createdAt: "2026-11-01T04:00:00Z",
  studentName: "Rahim",
  contactNumber: "01712345678",
})

describe("displayStatus", () => {
  const expiry = Date.parse("2026-11-01T04:10:00Z")

  it("shows HELD before expiry and EXPIRED from the expiry instant on", () => {
    const h = hold("HELD", "2026-11-01T04:10:00Z")
    expect(displayStatus(h, expiry - 1)).toBe("HELD")
    expect(displayStatus(h, expiry)).toBe("EXPIRED")
  })

  it("never changes a confirmed admission", () => {
    expect(displayStatus(hold("CONFIRMED", "2026-11-01T04:10:00Z"), expiry + 60_000)).toBe("CONFIRMED")
  })
})

describe("formatCountdown", () => {
  it.each([
    [600_000, "10:00"],
    [61_000, "01:01"],
    [1_500, "00:02"],
    [0, "00:00"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatCountdown(ms)).toBe(text)
  })
})
