import { describe, expect, it } from "vitest"

import { loadStudentId, saveStudentId, validateStudentId } from "@/lib/student-id"

describe("validateStudentId", () => {
  it("accepts exactly 17 digits", () => {
    expect(validateStudentId("20152691234567890")).toBeNull()
  })

  it.each([
    ["", /enter/i],
    ["2015269123456789", /exactly 17 digits \(you entered 16\)/],
    ["201526912345678901", /exactly 17 digits/],
    ["2015269123456789a", /digits only/],
    ["2015-269-123-4567", /digits only/],
  ])("rejects %j with a readable message", (value, message) => {
    expect(validateStudentId(value)).toMatch(message)
  })
})

describe("persistence", () => {
  it("round-trips a valid number through localStorage", () => {
    saveStudentId("20152691234567890")
    expect(loadStudentId()).toBe("20152691234567890")
  })

  it("ignores a stored value that is not valid", () => {
    localStorage.setItem("school-admission.student-id", "123")
    expect(loadStudentId()).toBe("")
  })
})
