import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ApplicationPanel } from "@/components/admission/application-panel"
import { NoticeProvider } from "@/components/notices"
import type { Hold } from "@/lib/api"
import { json, mockFetch } from "@/test/fetch-mock"

const STUDENT = "20152691234567890"

function heldFor(ms: number): Hold {
  return {
    holdId: "h1",
    classId: "c1",
    className: "Class 6 - Morning Shift",
    studentId: STUDENT,
    status: "HELD",
    expiresAt: new Date(Date.now() + ms).toISOString(),
    createdAt: new Date().toISOString(),
    studentName: "Rahim",
    contactNumber: "01712345678",
  }
}

function renderPanel(hold: Hold, onChanged = vi.fn()) {
  render(
    <NoticeProvider>
      <ApplicationPanel hold={hold} studentId={STUDENT} onChanged={onChanged} />
    </NoticeProvider>
  )
  return onChanged
}

describe("ApplicationPanel", () => {
  it("counts down, then shows EXPIRED and disables pay without a reload", async () => {
    const hold = heldFor(1500)
    // The server keeps answering HELD; the UI must still switch at the expiry instant.
    mockFetch(() => json(hold))
    renderPanel(hold)

    const pay = screen.getByRole("button", { name: "ভর্তি ফি দিন" })
    expect(screen.getByText("HELD")).toBeInTheDocument()
    expect(pay).toBeEnabled()

    await waitFor(() => expect(screen.getByText("EXPIRED")).toBeInTheDocument(), { timeout: 3000 })
    expect(pay).toBeDisabled()
  })

  it("pays the fee and reports success", async () => {
    const hold = heldFor(600_000)
    const fetch = mockFetch((url, init) =>
      init.method === "POST" && url.endsWith("/holds/h1/confirm")
        ? json({ ...hold, status: "CONFIRMED", confirmedAt: new Date().toISOString() })
        : json(hold)
    )
    const onChanged = renderPanel(hold)

    await userEvent.click(screen.getByRole("button", { name: "ভর্তি ফি দিন" }))

    expect(await screen.findByText(/admission .* is confirmed/i)).toBeInTheDocument()
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/holds/h1/confirm"))).toBe(true)
    expect(onChanged).toHaveBeenCalled()
  })

  it("shows a readable error when payment is too late", async () => {
    const hold = heldFor(600_000)
    mockFetch((_url, init) =>
      init.method === "POST"
        ? json({ error: "HOLD_EXPIRED", message: "x" }, 409)
        : json(hold)
    )
    renderPanel(hold)

    await userEvent.click(screen.getByRole("button", { name: "ভর্তি ফি দিন" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/time ran out/i)
  })

  it("lets the parent cancel a confirmed admission after a warning", async () => {
    const confirmed: Hold = {
      ...heldFor(600_000),
      status: "CONFIRMED",
      confirmedAt: new Date().toISOString(),
    }
    const fetch = mockFetch((_url, init) =>
      init.method === "DELETE" ? new Response(null, { status: 204 }) : json(confirmed)
    )
    renderPanel(confirmed)

    expect(screen.getByRole("button", { name: "ভর্তি ফি দিন" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "বাতিল" }))
    expect(screen.getByRole("alert")).toHaveTextContent(/fee is already paid/i)
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }))

    expect(await screen.findByText(/admission to .* cancelled/i)).toBeInTheDocument()
    expect(fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true)
  })
})
