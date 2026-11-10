import { describe, expect, it } from "vitest"

import type { SchoolClass } from "@/lib/api"
import { classNameFor, sortClasses } from "@/lib/class-name"

const make = (name: string) =>
  ({ id: name, name, totalSeats: 1, heldSeats: 0, confirmedSeats: 0, availableSeats: 1 }) as SchoolClass

describe("class names", () => {
  it("builds the name from the two dropdowns", () => {
    expect(classNameFor(6, "Morning Shift")).toBe("Class 6 - Morning Shift")
  })

  it("sorts Class 1 to 10, Morning before Evening, other names last in server order", () => {
    const names = [
      "Old free-text class",
      "Class 10 - Morning Shift",
      "Class 2 - Evening Shift",
      "Class 2 - Morning Shift",
      "Another old class",
      "Class 1 - Evening Shift",
    ]
    expect(sortClasses(names.map(make)).map((c) => c.name)).toEqual([
      "Class 1 - Evening Shift",
      "Class 2 - Morning Shift",
      "Class 2 - Evening Shift",
      "Class 10 - Morning Shift",
      "Old free-text class",
      "Another old class",
    ])
  })
})
