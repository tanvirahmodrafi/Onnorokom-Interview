import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ErrorBoundary } from "@/components/error-boundary"

function Boom(): never {
  throw new Error("render failed")
}

describe("ErrorBoundary", () => {
  it("shows a message instead of a blank page when rendering crashes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument()
  })
})
