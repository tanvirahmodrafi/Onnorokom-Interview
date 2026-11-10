import type { SchoolClass } from "@/lib/api"

export const CLASS_NUMBERS = Array.from({ length: 10 }, (_, i) => i + 1)
export const SHIFTS = ["Morning Shift", "Evening Shift"] as const
export type Shift = (typeof SHIFTS)[number]

/** The name the admin's two dropdowns produce, e.g. "Class 6 - Morning Shift". */
export function classNameFor(classNumber: number, shift: Shift): string {
  return `Class ${classNumber} - ${shift}`
}

const PATTERN = /^Class\s+(\d+)\s*-\s*(Morning|Evening)\s+Shift$/i

function sortKey(name: string): [number, number] {
  const match = PATTERN.exec(name.trim())
  if (!match) return [Number.MAX_SAFE_INTEGER, 0]
  return [Number(match[1]), match[2].toLowerCase() === "morning" ? 0 : 1]
}

/**
 * Class 1 to 10, Morning before Evening. Names in any other format (created before the dropdowns)
 * go last, in the server's order (oldest first).
 */
export function sortClasses(classes: SchoolClass[]): SchoolClass[] {
  return classes
    .map((c, index) => ({ c, index, key: sortKey(c.name) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.index - b.index)
    .map(({ c }) => c)
}
