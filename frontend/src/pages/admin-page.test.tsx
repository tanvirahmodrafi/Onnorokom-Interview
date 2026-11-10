import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { AdminPage } from "@/pages/admin-page"
import { json, mockFetch } from "@/test/fetch-mock"

const CLASS = {
  id: "c1",
  name: "Class 6 - Morning Shift",
  totalSeats: 10,
  heldSeats: 1,
  confirmedSeats: 1,
  availableSeats: 8,
}
const future = new Date(Date.now() + 5 * 60_000).toISOString()
const hold = (studentId: string, status: string) => ({
  holdId: `h-${studentId}`,
  classId: "c1",
  className: CLASS.name,
  studentId,
  status,
  expiresAt: future,
  createdAt: new Date().toISOString(),
  studentName: `Student ${studentId.slice(-1)}`,
  contactNumber: "01712345678",
})
const HELD = "20150000000000001"
const PAID = "20150000000000002"

function backend() {
  const calls: string[] = []
  const fetch = mockFetch((url, init) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "")
    const method = init.method ?? "GET"
    calls.push(`${method} ${path}`)
    if (path === "/classes" && method === "GET") return json([CLASS])
    if (path === "/classes" && method === "POST") return json(CLASS, 201)
    if (path === "/classes/c1/students") return json([hold(HELD, "HELD"), hold(PAID, "CONFIRMED")])
    if (method === "DELETE") return new Response(null, { status: 204 })
    return json({ error: "NOPE" }, 404)
  })
  return { calls, fetch }
}

describe("AdminPage", () => {
  it("creates a class from the class and shift dropdowns", async () => {
    const { fetch } = backend()
    render(<AdminPage />)

    await userEvent.selectOptions(screen.getByLabelText("Class"), "3")
    await userEvent.selectOptions(screen.getByLabelText("Shift"), "Evening Shift")
    await userEvent.type(screen.getByLabelText("Total seats"), "40")
    await userEvent.click(screen.getByRole("button", { name: "Create class" }))

    const post = fetch.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      name: "Class 3 - Evening Shift",
      totalSeats: 40,
    })
  })

  it("asks for a shift before creating", async () => {
    backend()
    render(<AdminPage />)

    await userEvent.selectOptions(screen.getByLabelText("Class"), "3")
    await userEvent.click(screen.getByRole("button", { name: "Create class" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a shift")
  })

  it("shows capacity, confirmed and held in each box and opens the class on tap", async () => {
    backend()
    render(<AdminPage />)

    const box = await screen.findByRole("button", { name: /Class 6 - Morning Shift/ })
    expect(box).toHaveTextContent(/Capacity\s*10/)
    expect(box).toHaveTextContent(/Confirmed\s*1/)
    expect(box).toHaveTextContent(/Held\s*1/)

    await userEvent.click(box)

    expect(await screen.findByText(HELD)).toBeInTheDocument()
    expect(screen.getByText("Student 1")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "01712345678" })[0]).toHaveAttribute(
      "href",
      "tel:01712345678"
    )
    expect(screen.getByText(PAID)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: CLASS.name })).toBeInTheDocument()
  })

  it("removes a student only after confirming in the pop-up", async () => {
    const { calls } = backend()
    render(<AdminPage />)
    await userEvent.click(await screen.findByRole("button", { name: /Class 6 - Morning Shift/ }))

    await userEvent.click(await screen.findByRole("button", { name: `Remove ${PAID}` }))
    const dialog = screen.getByRole("alertdialog")
    expect(dialog).toHaveTextContent("Do you really want to remove")
    await userEvent.click(within(dialog).getByRole("button", { name: "No, keep it" }))
    expect(calls.some((c) => c.startsWith("DELETE"))).toBe(false)

    await userEvent.click(screen.getByRole("button", { name: `Remove ${PAID}` }))
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, remove" })
    )
    expect(calls).toContain(`DELETE /classes/c1/students/${PAID}`)
  })

  it("deletes the class only after confirming in the pop-up", async () => {
    const { calls } = backend()
    render(<AdminPage />)
    await userEvent.click(await screen.findByRole("button", { name: /Class 6 - Morning Shift/ }))

    await userEvent.click(screen.getByRole("button", { name: /Delete class/ }))
    const dialog = screen.getByRole("alertdialog")
    expect(dialog).toHaveTextContent("Do you really want to delete this class?")
    expect(dialog).toHaveTextContent("1 held and 1 confirmed students will lose their seat")

    await userEvent.click(within(dialog).getByRole("button", { name: "Yes, delete" }))

    expect(calls).toContain("DELETE /classes/c1")
    expect(await screen.findByRole("button", { name: "Create class" })).toBeInTheDocument()
  })
})
