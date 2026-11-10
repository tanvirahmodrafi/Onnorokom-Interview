import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { App } from "@/App"
import { ThemeProvider } from "@/components/theme-provider"
import { loadLanguage, setLanguage } from "@/lib/i18n"
import { json, mockFetch } from "@/test/fetch-mock"

function mockSystemTheme(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: dark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
}

describe("language", () => {
  afterEach(() => {
    window.location.hash = ""
  })

  it("is Bangla when nothing was chosen", () => {
    localStorage.clear()
    expect(loadLanguage()).toBe("bn")
  })

  it("switches between Bangla and English and remembers the choice", async () => {
    setLanguage("bn")
    mockFetch(() => json([]))
    render(<App />)

    expect(screen.getByRole("heading", { name: "স্কুল ভর্তি" })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe("bn")

    await userEvent.click(screen.getByRole("button", { name: "English" }))

    expect(screen.getByRole("heading", { name: "School Admission" })).toBeInTheDocument()
    expect(screen.getByLabelText(/birth registration number/i)).toBeInTheDocument()
    expect(loadLanguage()).toBe("en")

    await userEvent.click(screen.getByRole("button", { name: "বাংলা" }))

    expect(screen.getByLabelText("শিক্ষার্থীর জন্ম নিবন্ধন নম্বর")).toBeInTheDocument()
  })
})

describe("theme", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.classList.remove("light", "dark")
  })

  it("follows the system theme until the button is pressed", async () => {
    mockSystemTheme(true)
    mockFetch(() => json([]))
    render(
      <ThemeProvider disableTransitionOnChange={false}>
        <App />
      </ThemeProvider>
    )

    expect(document.documentElement).toHaveClass("dark")

    await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }))

    expect(document.documentElement).toHaveClass("light")
    expect(localStorage.getItem("theme")).toBe("light")
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument()
  })
})
