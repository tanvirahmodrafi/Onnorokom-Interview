import { describe, expect, it, vi } from "vitest"

import { api, ApiError } from "@/lib/api"
import { json, mockFetch } from "@/test/fetch-mock"

const STUDENT = "20152691234567890"
const APPLICANT = { studentName: "Rahim Uddin", contactNumber: "01712345678" }

describe("api", () => {
  it("sends the student ID header when applying", async () => {
    const fetch = mockFetch(() =>
      json({ holdId: "h1", classId: "c1", status: "HELD", expiresAt: "2026-11-01T04:10:00Z" }, 201)
    )

    await api.applyForSeat("c1", STUDENT, APPLICANT)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toMatch(/\/classes\/c1\/holds$/)
    expect(init?.method).toBe("POST")
    expect((init?.headers as Record<string, string>)["X-Student-Id"]).toBe(STUDENT)
    expect(JSON.parse(String(init?.body))).toEqual(APPLICANT)
  })

  it("turns a full class into a plain message", async () => {
    mockFetch(() => json({ error: "CLASS_FULL", message: "server text" }, 409))

    const error = await api.applyForSeat("c1", STUDENT, APPLICANT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: "CLASS_FULL", message: "No seats are left in this class." })
  })

  it("explains rate limiting and an overloaded server in plain words", async () => {
    mockFetch(() => json({ error: "TOO_MANY_REQUESTS", message: "server text" }, 429))
    await expect(api.listClasses()).rejects.toMatchObject({
      status: 429,
      message: "Too many requests from your network. Please wait a minute and try again.",
    })

    mockFetch(() => json({ error: "SERVER_BUSY", message: "server text" }, 503))
    await expect(api.listClasses()).rejects.toMatchObject({
      status: 503,
      message: "The server is very busy right now. Please try again in a moment.",
    })
  })

  it("falls back to the server message for codes it does not know", async () => {
    mockFetch(() => json({ error: "INVALID_TOTAL_SEATS", message: "Total seats must be between 1 and 100000." }, 400))

    await expect(api.createClass("A", 0)).rejects.toThrow("Total seats must be between 1 and 100000.")
  })

  it("explains a server error without a body", async () => {
    mockFetch(() => new Response("oops", { status: 500 }))

    await expect(api.listClasses()).rejects.toThrow(/server ran into a problem/i)
  })

  it("reports an unreachable server clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))))

    await expect(api.listClasses()).rejects.toThrow(/cannot reach the server/i)
  })

  it("treats 204 from cancel as success", async () => {
    mockFetch(() => new Response(null, { status: 204 }))

    await expect(api.cancel("h1", STUDENT)).resolves.toBeUndefined()
  })
})
