import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { StudentIdBar } from "@/components/admission/student-id-bar"

describe("StudentIdBar", () => {
  it("does not use a number until it has all 17 digits", async () => {
    const onChange = vi.fn()
    render(<StudentIdBar studentId="" onChange={onChange} />)

    await userEvent.type(screen.getByLabelText(/birth registration number/i), "12345")

    expect(screen.getByText("5/17")).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("uses a 17-digit number as soon as it is complete, with no button", async () => {
    const onChange = vi.fn()
    render(<StudentIdBar studentId="" onChange={onChange} />)

    await userEvent.type(screen.getByLabelText(/birth registration number/i), "20152691234567890")

    expect(onChange).toHaveBeenCalledWith("20152691234567890")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("drops the student when a digit is removed", async () => {
    const onChange = vi.fn()
    render(<StudentIdBar studentId="20152691234567890" onChange={onChange} />)

    await userEvent.type(screen.getByLabelText(/birth registration number/i), "{Backspace}")

    expect(onChange).toHaveBeenCalledWith("")
  })

  it("flags letters right away", async () => {
    render(<StudentIdBar studentId="" onChange={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/birth registration number/i), "2015a")

    expect(screen.getByRole("alert")).toHaveTextContent("digits only")
  })
})
