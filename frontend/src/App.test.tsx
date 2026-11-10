import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { App } from "@/App"
import { json, mockFetch } from "@/test/fetch-mock"

const CLASSES = [
  {
    id: "c1",
    name: "Class 6 - Morning Shift",
    totalSeats: 10,
    heldSeats: 2,
    confirmedSeats: 3,
    availableSeats: 5,
  },
]

describe("App view switch", () => {
  afterEach(() => {
    window.location.hash = ""
  })

  it("opens on the parent side, with applying and no class creation", async () => {
    mockFetch(() => json(CLASSES))
    render(<App />)

    expect(await screen.findByText("Class 6 - Morning Shift")).toBeInTheDocument()
    expect(screen.getByLabelText(/birth registration number/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "আবেদন করুন" })).toBeInTheDocument()
    expect(screen.queryByText("Create class", { selector: "button" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /parents/i })).toHaveAttribute("aria-current", "page")
  })

  it("switches to the admin side from the header and back", async () => {
    mockFetch(() => json(CLASSES))
    render(<App />)
    const nav = screen.getByRole("navigation", { name: /switch view/i })

    await userEvent.click(within(nav).getByRole("link", { name: /admin/i }))

    expect(await screen.findByRole("button", { name: "Create class" })).toBeInTheDocument()
    expect(window.location.hash).toBe("#/admin")
    expect(screen.queryByLabelText(/birth registration number/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "আবেদন করুন" })).not.toBeInTheDocument()
    expect(await screen.findByRole("button", { name: /Class 6 - Morning Shift/ })).toBeInTheDocument()

    await userEvent.click(within(nav).getByRole("link", { name: /parents/i }))

    expect(await screen.findByLabelText(/birth registration number/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create class" })).not.toBeInTheDocument()
  })
})

describe("Parent sidebar", () => {
  afterEach(() => {
    window.location.hash = ""
  })

  it("shows Class List, Admission Request and My Admission as separate screens", async () => {
    mockFetch(() => json(CLASSES))
    render(<App />)
    const menu = screen.getByRole("navigation", { name: /parent menu/i })

    expect(within(menu).getByRole("link", { name: /class list/i })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(await screen.findByRole("button", { name: "আবেদন করুন" })).toBeInTheDocument()

    await userEvent.click(within(menu).getByRole("link", { name: /admission request/i }))
    expect(await screen.findByText("No admission request yet")).toBeInTheDocument()
    expect(window.location.hash).toBe("#/request")
    expect(screen.queryByRole("button", { name: "আবেদন করুন" })).not.toBeInTheDocument()

    await userEvent.click(within(menu).getByRole("link", { name: /my admission/i }))
    expect(await screen.findByText("My applications")).toBeInTheDocument()
    expect(window.location.hash).toBe("#/my-admission")
    expect(screen.queryByText("No admission request yet")).not.toBeInTheDocument()
  })

  it("goes to Admission Request after applying for a seat", async () => {
    localStorage.setItem("school-admission.student-id", "20150000000000001")
    const hold = {
      holdId: "h1",
      classId: "c1",
      className: CLASSES[0].name,
      studentId: "20150000000000001",
      status: "HELD",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      createdAt: new Date().toISOString(),
      studentName: "Rahim Uddin",
      contactNumber: "01712345678",
    }
    let applied = false
    const fetch = mockFetch((url, init) => {
      if (url.endsWith("/holds") && init.method === "POST") {
        applied = true
        return json(hold, 201)
      }
      if (url.endsWith("/me/holds")) return json(applied ? [hold] : [])
      if (url.endsWith("/holds/h1")) return json(hold)
      return json(CLASSES)
    })
    render(<App />)

    await userEvent.click(await screen.findByRole("button", { name: "আবেদন করুন" }))
    const form = await screen.findByRole("dialog")
    await userEvent.type(within(form).getByLabelText("Student's name"), "Rahim Uddin")
    await userEvent.type(within(form).getByLabelText("Contact number"), "017-1234 5678")
    await userEvent.click(within(form).getByRole("button", { name: "আবেদন জমা দিন" }))

    expect(await screen.findByRole("button", { name: "ভর্তি ফি দিন" })).toBeInTheDocument()
    expect(window.location.hash).toBe("#/request")
    const post = fetch.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      studentName: "Rahim Uddin",
      contactNumber: "01712345678",
    })
  })

  it("does not apply until the form is filled in correctly", async () => {
    localStorage.setItem("school-admission.student-id", "20150000000000001")
    const fetch = mockFetch((url) => json(url.endsWith("/me/holds") ? [] : CLASSES))
    render(<App />)

    await userEvent.click(await screen.findByRole("button", { name: "আবেদন করুন" }))
    const form = await screen.findByRole("dialog")
    await userEvent.type(within(form).getByLabelText("Contact number"), "12345")
    await userEvent.click(within(form).getByRole("button", { name: "আবেদন জমা দিন" }))

    expect(within(form).getByText("Enter the student's name.")).toBeInTheDocument()
    expect(within(form).getByText(/10 to 15 digits/)).toBeInTheDocument()
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)
  })

  it("blocks applying to a second class once the student has one", async () => {
    localStorage.setItem("school-admission.student-id", "20150000000000001")
    const other = { ...CLASSES[0], id: "c2", name: "Class 7 - Evening Shift" }
    const confirmed = {
      holdId: "h1",
      classId: "c1",
      className: CLASSES[0].name,
      studentId: "20150000000000001",
      status: "CONFIRMED",
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      studentName: "Rahim",
      contactNumber: "01712345678",
    }
    mockFetch((url) => {
      if (url.endsWith("/me/holds")) return json([confirmed])
      if (url.endsWith("/holds/h1")) return json(confirmed)
      return json([CLASSES[0], other])
    })
    render(<App />)

    expect(await screen.findByText("One class per student")).toBeInTheDocument()
    expect(screen.getByText("Admitted")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "আবেদন করুন" })).not.toBeInTheDocument()
  })
})
